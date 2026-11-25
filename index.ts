/*
 * HideSelectedFriends — hide selected friends from the Online tab and the Active Now panel.
 * Copyright (C) 2026 HajiLight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings, SettingsStore } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { RelationshipStore } from "@webpack/common";

import { parseHiddenUsers, withoutHiddenUsers } from "./logic";

const settings = definePluginSettings({
    hiddenUsers: {
        type: OptionType.STRING,
        description: "User IDs to hide. Separate them with new lines, spaces, commas or semicolons. Mentions such as <@123456789012345678> are accepted too.",
        placeholder: "123456789012345678",
        multiline: true,
        default: "",
        onChange() {
            invalidate();
        }
    },
    hideInOnlineTab: {
        type: OptionType.BOOLEAN,
        description: "Hide them in the Online tab of the friends list",
        default: true,
        // The friends list memoises its filtered rows; without this the toggle does nothing until
        // the user switches tabs.
        onChange() {
            invalidate();
        }
    },
    hideInActiveNow: {
        type: OptionType.BOOLEAN,
        description: "Hide their cards in the Active Now panel. A group card disappears as a whole, including the other people on it.",
        default: true,
        onChange() {
            invalidate();
        }
    }
}).withPrivateSettings<{ enabled?: boolean }>();

/**
 * The settings textarea is a string, and the patches run on every render, so the parsed
 * set is cached until the raw value actually changes.
 */
let lastRaw: string | undefined;
let hiddenIds: ReadonlySet<string> = new Set();

/** `nowPlayingCards` is read through a React store selector: returning a fresh array on every
 *  read makes React think the snapshot changed. Cache by input identity and by the identity of
 *  the hidden set: another plugin, a sync, or a direct runtime write can change the hidden users
 *  without going through our onChange, and the same cards array must then be filtered again. */
let lastCards: readonly unknown[] | undefined;
let lastCardsHidden: ReadonlySet<string> | undefined;
let visibleCards: unknown[] = [];

/**
 * Bumped on every settings change. The friends list memoises its filtered rows on
 * `[rows, query, section]`, so without this the list keeps rendering the old set until the
 * user switches tabs. Exposed on the plugin object as `$self.state.version`.
 */
const state = { version: 0 };

function invalidate() {
    lastRaw = undefined;
    lastCards = undefined;
    lastCardsHidden = undefined;
    state.version++;
    // The friends list memoises its filtered rows. Bumping our version only helps when the
    // useMemo patch is applied; emitting the store change makes the next render recompute the
    // rows even if that patch ever stops matching, so a toggle takes effect without a tab switch.
    RelationshipStore?.emitChange?.();
}

function currentHiddenIds(): ReadonlySet<string> {
    const raw = settings.store.hiddenUsers;
    if (raw !== lastRaw) {
        lastRaw = raw;
        hiddenIds = parseHiddenUsers(raw);
    }
    return hiddenIds;
}

/** Called from the patched friends list filter. `$self.isHidden(...)` */
function isHidden(userId: unknown): boolean {
    if (!settings.store.enabled || !settings.store.hideInOnlineTab || typeof userId !== "string") return false;

    const ids = currentHiddenIds();
    return ids.size > 0 && ids.has(userId);
}

/** Called from the patched `NowPlayingViewStore.nowPlayingCards` getter. `$self.filterCards(...)` */
function filterCards(cards: unknown): unknown {
    if (!settings.store.enabled || !Array.isArray(cards) || !settings.store.hideInActiveNow) return cards;

    const ids = currentHiddenIds();
    if (ids.size === 0) return cards;

    if (cards === lastCards && ids === lastCardsHidden) return visibleCards;

    lastCards = cards;
    lastCardsHidden = ids;
    visibleCards = withoutHiddenUsers(cards, ids);
    return visibleCards;
}

export default definePlugin({
    name: "HideSelectedFriends",
    description: "Hides selected friends from the Online tab and the Active Now panel.",
    authors: [{ name: "HajiLight", id: 304361389659783168n }],
    tags: ["Friends", "Appearance"],
    settings,

    patches: [
        {
            // The friends list store filters its rows per tab. Appending a check to the ONLINE
            // branch removes the row before it is ever rendered, so the section count, the tab
            // badge and the virtualised list all stay consistent.
            find: /\.\i\.ONLINE:return \i\.type===\i\.\i\.FRIEND&&\i\.status!==\i\.\i\.OFFLINE/,
            replacement: {
                match: /\.filter\((\i)=>\{switch\(\i\)\{case (\i)\.\i\.ONLINE:return \1\.type===\2\.\i\.FRIEND&&\1\.status!==\2\.\i\.OFFLINE/,
                replace: (match, row) => `${match}&&!$self.isHidden(${row}.userId)`
            }
        },
        {
            // The Active Now panel renders whatever this store getter returns.
            find: '"NowPlayingViewStore"',
            replacement: {
                match: /get nowPlayingCards\(\)\{return (\i)\}/,
                replace: (_match, cards) => `get nowPlayingCards(){return $self.filterCards(${cards})}`
            }
        },
        {
            // The friends list memoises its filtered rows on [rows, query, section], so a settings
            // change alone would not be picked up until the user switches tabs. Our own counter in
            // the dependency list makes the next render apply it.
            //
            // Do not key on the useMemo shape alone: an unrelated module with the same
            // `useMemo(() => rows.filter(fn, queryMap[section]), [...])` shape could consume the
            // patch and leave the real friends list stale. The FRIENDS_LIST analytics location
            // immediately before the rows/section subscription identifies the right component.
            // Verified against Discord Stable 1.0.9269 (web.fce32372e0848f7d.js).
            find: /FRIENDS_LIST[\s\S]{0,1500}?useMemo\(\(\)=>\i\.filter\(\i,\i\[\i\]\),\[\i,\i,\i\]\)/,
            replacement: {
                match: /(useMemo\(\(\)=>\i\.filter\(\i,\i\[\i\]\),\[\i,\i,\i)\](\))/,
                replace: (_match, head, tail) => `${head},$self.state.version]${tail}`
            }
        }
    ],

    // Lifecycle hooks: ensure toggling the plugin enabled/disabled at runtime invalidates
    // the friends-list useMemo cache immediately.
    start() {
        SettingsStore.addChangeListener("plugins.HideSelectedFriends.enabled", invalidate);
        invalidate();
    },

    stop() {
        SettingsStore.removeChangeListener("plugins.HideSelectedFriends.enabled", invalidate);
        invalidate();
    },

    // Referenced by the patches above through $self
    isHidden,
    filterCards,
    state
});
