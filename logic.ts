/*
 * HideSelectedFriends — pure logic with no Vencord imports, so it can be unit tested.
 * Copyright (C) 2026 HajiLight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

/** Discord snowflakes are decimal strings; 15 is the lower bound of pre-2015 accounts. */
export const ID_PATTERN = /^\d{15,20}$/;

/** Mention syntax `<@id>` and `<@!id>` maps onto the same ID. */
const TOKEN_PATTERN = /^(?:<@!?)?(\d{15,20})>?$/;

/** Object keys the Active Now party payload can nest users under. Nothing else is traversed,
 *  which is what keeps channel, guild and application IDs out of the result. */
const USER_CONTAINERS = [
    "party",
    "priorityMembers",
    "partiedMembers",
    "currentActivities",
    "playingMembers",
    "voiceChannels",
    "members",
    "applicationStreams",
    "streamUser",
    "activityUser",
    "user",
    "users"
] as const;

const MAX_DEPTH = 6;

function isUserLike(value: Record<string, unknown>): boolean {
    return (
        typeof value.username === "string" ||
        typeof value.globalName === "string" ||
        typeof value.discriminator === "string" ||
        typeof value.avatar === "string"
    );
}

/**
 * Parse the settings textarea into a set of user IDs.
 * Anything that is not an ID or a mention is dropped instead of being fuzzy matched:
 * display names change, IDs do not.
 */
export function parseHiddenUsers(raw?: unknown): ReadonlySet<string> {
    const ids = new Set<string>();
    if (typeof raw !== "string") return ids;

    for (const token of raw.split(/[\s,;]+/)) {
        const match = token.match(TOKEN_PATTERN);
        if (match) ids.add(match[1]);
    }

    return ids;
}

/** Collect every user ID reachable from an Active Now card. */
export function collectUserIds(root: unknown): string[] {
    const found = new Set<string>();
    const seen = new Set<object>();
    const queue: Array<[unknown, number]> = [[root, 0]];

    while (queue.length > 0) {
        const [value, depth] = queue.pop()!;

        if (value === null || typeof value !== "object" || depth > MAX_DEPTH || seen.has(value)) continue;
        seen.add(value);

        if (Array.isArray(value)) {
            for (const item of value) queue.push([item, depth + 1]);
            continue;
        }

        const record = value as Record<string, unknown>;

        if (typeof record.id === "string" && ID_PATTERN.test(record.id) && isUserLike(record)) {
            found.add(record.id);
        }

        for (const key of USER_CONTAINERS) {
            if (key in record) queue.push([record[key], depth + 1]);
        }
    }

    return [...found];
}

/** Drop the cards that contain at least one hidden user. */
export function withoutHiddenUsers<T>(cards: readonly T[], hidden: ReadonlySet<string>): T[] {
    if (hidden.size === 0) return cards as T[];

    return cards.filter(card => !collectUserIds(card).some(id => hidden.has(id)));
}
