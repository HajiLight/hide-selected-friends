import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RelationshipStore } from "@webpack/common";

import plugin from "../index";

const ALICE = "111111111111111111";
const BOB = "222222222222222222";

describe("HideSelectedFriends plugin", () => {
    beforeEach(() => {
        // Reset settings store to defaults
        plugin.settings.store.enabled = true;
        plugin.settings.store.hiddenUsers = "";
        plugin.settings.store.hideInOnlineTab = true;
        plugin.settings.store.hideInActiveNow = true;
        plugin.settings.def.hiddenUsers.onChange();
    });

    afterEach(() => {
        plugin.stop?.();
        vi.restoreAllMocks();
    });

    describe("metadata", () => {
        it("exports standard Vencord plugin metadata", () => {
            expect(plugin.name).toBe("HideSelectedFriends");
            expect(plugin.description).toContain("Online tab");
            expect(plugin.authors).toEqual([{ name: "HajiLight", id: 304361389659783168n }]);
            expect(plugin.tags).toEqual(["Friends", "Appearance"]);
        });

        it("defines the expected settings defaults", () => {
            expect(plugin.settings.def.hiddenUsers.default).toBe("");
            expect(plugin.settings.def.hideInOnlineTab.default).toBe(true);
            expect(plugin.settings.def.hideInActiveNow.default).toBe(true);
        });

        it("increments version on every settings onChange call", () => {
            const v0 = plugin.state.version;
            plugin.settings.def.hiddenUsers.onChange();
            expect(plugin.state.version).toBe(v0 + 1);

            plugin.settings.def.hideInOnlineTab.onChange();
            expect(plugin.state.version).toBe(v0 + 2);

            plugin.settings.def.hideInActiveNow.onChange();
            expect(plugin.state.version).toBe(v0 + 3);
        });

        it("registers and cleans up the runtime enabled listener via start/stop", () => {
            const beforeStart = plugin.state.version;
            plugin.start?.();
            expect(plugin.state.version).toBe(beforeStart + 1);
            const v0 = plugin.state.version;

            plugin.settings.store.enabled = false;
            expect(plugin.state.version).toBe(v0 + 1);

            plugin.settings.store.enabled = true;
            expect(plugin.state.version).toBe(v0 + 2);

            plugin.stop?.();
            const v1 = plugin.state.version;

            plugin.settings.store.enabled = false;
            expect(plugin.state.version).toBe(v1);

            // Re-enabling in the same session invalidates stale Online tab memo state immediately.
            plugin.settings.store.enabled = true;
            plugin.start?.();
            expect(plugin.state.version).toBe(v1 + 1);
        });

        it("emits RelationshipStore.emitChange on settings changes and lifecycle transitions", () => {
            const emitChange = vi.spyOn(RelationshipStore, "emitChange");
            emitChange.mockClear();

            plugin.settings.def.hiddenUsers.onChange();
            expect(emitChange).toHaveBeenCalledTimes(1);

            plugin.settings.def.hideInOnlineTab.onChange();
            plugin.settings.def.hideInActiveNow.onChange();
            expect(emitChange).toHaveBeenCalledTimes(3);

            plugin.start?.();
            expect(emitChange).toHaveBeenCalledTimes(4);

            plugin.stop?.();
            expect(emitChange).toHaveBeenCalledTimes(5);
        });
    });

    describe("isHidden", () => {
        it("returns false when the plugin is disabled at runtime", () => {
            plugin.settings.store.hiddenUsers = ALICE;
            plugin.settings.store.enabled = false;

            expect(plugin.isHidden(ALICE)).toBe(false);
        });

        it("returns false if hideInOnlineTab is disabled", () => {
            plugin.settings.store.hiddenUsers = ALICE;
            plugin.settings.store.hideInOnlineTab = false;

            expect(plugin.isHidden(ALICE)).toBe(false);
        });

        it("returns false if userId is not a string", () => {
            plugin.settings.store.hiddenUsers = ALICE;

            expect(plugin.isHidden(null)).toBe(false);
            expect(plugin.isHidden(undefined)).toBe(false);
            expect(plugin.isHidden(123456789012345678)).toBe(false);
            expect(plugin.isHidden({})).toBe(false);
        });

        it("returns false when no users are hidden", () => {
            plugin.settings.store.hiddenUsers = "";

            expect(plugin.isHidden(ALICE)).toBe(false);
        });

        it("returns true only for hidden users", () => {
            plugin.settings.store.hiddenUsers = `${ALICE}, <@${BOB}>`;

            expect(plugin.isHidden(ALICE)).toBe(true);
            expect(plugin.isHidden(BOB)).toBe(true);
            expect(plugin.isHidden("333333333333333333")).toBe(false);
        });

        it("reuses cached hidden IDs when raw string does not change", () => {
            plugin.settings.store.hiddenUsers = ALICE;
            expect(plugin.isHidden(ALICE)).toBe(true);
            // Calling again with same raw value hits cache branch
            expect(plugin.isHidden(ALICE)).toBe(true);
        });
    });

    describe("filterCards", () => {
        const aliceCard = {
            party: {
                members: [{ id: ALICE, username: "alice" }]
            }
        };
        const bobCard = {
            party: {
                members: [{ id: BOB, username: "bob" }]
            }
        };

        it("returns cards untouched if not an array", () => {
            expect(plugin.filterCards(null)).toBeNull();
            expect(plugin.filterCards(undefined)).toBeUndefined();
            expect(plugin.filterCards("string")).toBe("string");
            expect(plugin.filterCards({ length: 0 })).toEqual({ length: 0 });
        });

        it("returns cards untouched if the plugin is disabled at runtime", () => {
            plugin.settings.store.hiddenUsers = ALICE;
            plugin.settings.store.enabled = false;

            const cards = [aliceCard, bobCard];
            expect(plugin.filterCards(cards)).toBe(cards);
        });

        it("returns cards untouched if hideInActiveNow is disabled", () => {
            plugin.settings.store.hiddenUsers = ALICE;
            plugin.settings.store.hideInActiveNow = false;

            const cards = [aliceCard, bobCard];
            expect(plugin.filterCards(cards)).toBe(cards);
        });

        it("returns cards untouched if hiddenUsers is empty", () => {
            plugin.settings.store.hiddenUsers = "";

            const cards = [aliceCard, bobCard];
            expect(plugin.filterCards(cards)).toBe(cards);
        });

        it("filters out cards containing hidden users", () => {
            plugin.settings.store.hiddenUsers = ALICE;

            const cards = [aliceCard, bobCard];
            const filtered = plugin.filterCards(cards) as typeof cards;

            expect(filtered).toHaveLength(1);
            expect(filtered[0]).toBe(bobCard);
        });

        it("returns cached result when passed the same cards array reference", () => {
            plugin.settings.store.hiddenUsers = ALICE;

            const cards = [aliceCard, bobCard];
            const firstResult = plugin.filterCards(cards);
            const secondResult = plugin.filterCards(cards);

            expect(secondResult).toBe(firstResult);
        });

        it("recomputes cached cards when the hidden set changes without onChange", () => {
            plugin.settings.store.hiddenUsers = ALICE;

            const cards = [aliceCard, bobCard];
            const firstResult = plugin.filterCards(cards) as typeof cards;
            expect(firstResult).toEqual([bobCard]);

            // Another plugin, a sync, or a direct runtime write can replace the setting without
            // going through our onChange. The cache key includes the parsed hidden set so the
            // already-cached cards array must be filtered again with BOB.
            plugin.settings.store.hiddenUsers = BOB;
            const secondResult = plugin.filterCards(cards) as typeof cards;

            expect(secondResult).toEqual([aliceCard]);
            expect(secondResult).not.toBe(firstResult);
        });

        it("recomputes when settings onChange invalidates the cache", () => {
            plugin.settings.store.hiddenUsers = ALICE;

            const cards = [aliceCard, bobCard];
            const firstResult = plugin.filterCards(cards);

            // Invalidate cache
            plugin.settings.def.hideInActiveNow.onChange();

            const secondResult = plugin.filterCards(cards);
            expect(secondResult).not.toBe(firstResult);
            expect(secondResult).toEqual(firstResult);
        });

        it("immediately stops filtering cached cards when disabled at runtime", () => {
            plugin.settings.store.hiddenUsers = ALICE;

            const cards = [aliceCard, bobCard];
            const filtered = plugin.filterCards(cards) as typeof cards;
            expect(filtered).toHaveLength(1);

            plugin.settings.store.enabled = false;
            expect(plugin.filterCards(cards)).toBe(cards);
        });
    });

    describe("patches", () => {
        function canonicalizeVencordMatch(re: RegExp): RegExp {
            const source = re.source.replaceAll(/(\\*)\\i/g, (match, leadingEscapes: string) =>
                leadingEscapes.length % 2 === 0
                    ? `${leadingEscapes}(?:[A-Za-z_$][\\w$]*)`
                    : match.slice(1)
            );
            return new RegExp(source, re.flags);
        }

        it("has 3 patches", () => {
            expect(plugin.patches).toHaveLength(3);
        });

        it("patch 0 uses Vencord \\i tokens and injects isHidden check into friends list row filter", () => {
            const patch = plugin.patches[0];
            expect(patch.find).toBeInstanceOf(RegExp);

            const findSource = (patch.find as RegExp).source;
            const replacement = patch.replacement as { match: RegExp; replace: (match: string, row: string) => string };
            expect(findSource).not.toMatch(/m3P|eA\$|clD/);
            expect(replacement.match.source).not.toMatch(/m3P|eA\$|clD/);

            const canonicalFind = canonicalizeVencordMatch(patch.find as RegExp);
            const canonicalMatch = canonicalizeVencordMatch(replacement.match);

            const legacyChunk = `.filter(i=>{switch(i){case i.m3P.ONLINE:return i.type===i.eA$.FRIEND&&i.status!==i.clD.OFFLINE`;
            expect(canonicalFind.test(legacyChunk)).toBe(true);
            expect(legacyChunk.replace(canonicalMatch, replacement.replace)).toBe(
                `${legacyChunk}&&!$self.isHidden(i.userId)`
            );

            const arbitraryChunk = `.filter(row=>{switch(sec){case $ns.abc.ONLINE:return row.type===$ns._x1.FRIEND&&row.status!==$ns.Z9$.OFFLINE`;
            expect(canonicalFind.test(arbitraryChunk)).toBe(true);
            expect(arbitraryChunk.replace(canonicalMatch, replacement.replace)).toBe(
                `${arbitraryChunk}&&!$self.isHidden(row.userId)`
            );
        });

        it("patch 1 wraps nowPlayingCards getter with filterCards", () => {
            const patch = plugin.patches[1];
            expect(patch.find).toBe('"NowPlayingViewStore"');

            const rawChunk = `get nowPlayingCards(){return i}`;
            const replacement = patch.replacement as { match: RegExp; replace: (match: string, cards: string) => string };
            const replaced = rawChunk.replace(replacement.match, replacement.replace);
            expect(replaced).toBe("get nowPlayingCards(){return $self.filterCards(i)}");
        });

        it("patch 2 anchors on the friends list module, not on a bare useMemo shape", () => {
            const patch = plugin.patches[2];
            expect(patch.find).toBeInstanceOf(RegExp);

            const canonicalFind = canonicalizeVencordMatch(patch.find as RegExp);
            const replacement = patch.replacement as {
                match: RegExp;
                replace: (match: string, head: string, tail: string) => string;
            };
            const canonicalMatch = canonicalizeVencordMatch(replacement.match);

            // Verbatim excerpt from Discord Stable 1.0.9269's web bundle
            // (web.fce32372e0848f7d.js). The FRIENDS_LIST analytics location and the
            // rows/section store subscription are what identify the friends list component.
            const friendsListModule = `let AJ=function(e){let{titleId:t}=e,{analyticsLocations:i}=(0,rH.Ay)(nc.A.FRIENDS_LIST),{rows:r,section:a}=(0,eu.cf)([EO.Ay],()=>EO.Ay.getState()),s=(0,eu.bG)([tD.A],()=>tD.A.isFocused()),{relationshipCount:l,hasBlockedOrIgnored:o}=(0,eu.cf)([iW.A],()=>({relationshipCount:iW.A.getRelationshipCount(),hasBlockedOrIgnored:iW.A.getBlockedOrIgnoredIDs().size>0})),[d,c]=ef.useState(()=>{let e={};for(let t of Object.values(V.m3P))e[t]="";return e}),[u,_]=ef.useState(!1),E=ef.useCallback((e,t)=>{let{key:n,...r}=e;switch(a){case V.m3P.PENDING:return(0,b.jsx)(AD,{...r,isFocused:s},n);case V.m3P.SUGGESTIONS:return(0,b.jsx)(AX,{...r,isFocused:s},n);case V.m3P.ALL:return(0,b.jsx)(Ao,{...r,isFocused:s,analyticsLocations:i,sectionIndex:t},\`\${t}-\${n}\`);case V.m3P.ONLINE:default:return(0,b.jsx)(Ao,{...r,isFocused:s,analyticsLocations:i},n)}},[a,s,i]),A=ef.useCallback(e=>{c({...d,[a]:e})},[d,a]),f=ef.useCallback(()=>{c({...d,[a]:""})},[d,a]),h=ef.useMemo(()=>a===V.m3P.PENDING&&(r.filter(V.m3P.SPAM).length>0||r.filter(V.m3P.PENDING_IGNORED).length>0),[r,a]),I=ef.useMemo(()=>r.filter(a,d[a]),[r,d,a]);`;

            expect(canonicalFind.test(friendsListModule)).toBe(true);
            const replaced = friendsListModule.replace(canonicalMatch, replacement.replace);
            expect(replaced).toContain("I=ef.useMemo(()=>r.filter(a,d[a]),[r,d,a,$self.state.version])");

            // The same bare useMemo shape in an unrelated module must not consume the patch and
            // leave the real friends list without the state.version dependency.
            const unrelatedModule = `ef.useMemo(()=>rows.filter(fn,obj[key]),[rows,query,section])`;
            expect(canonicalFind.test(unrelatedModule)).toBe(false);
        });
    });
});
