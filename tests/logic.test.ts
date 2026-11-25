/*
 * HideSelectedFriends — unit tests for the pure logic.
 * Copyright (C) 2026 HajiLight
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { describe, expect, it } from "vitest";

import { collectUserIds, parseHiddenUsers, withoutHiddenUsers } from "../logic";

const ALICE = "111111111111111111";
const BOB = "222222222222222222";

/** Shape of a card returned by `NowPlayingViewStore.nowPlayingCards`. */
function card(users: { id: string; username: string }[]) {
    return {
        type: 1,
        party: {
            id: "party-1",
            priorityMembers: users.slice(0, 1).map(user => ({ user })),
            partiedMembers: users,
            currentActivities: [
                {
                    activity: { application_id: "999999999999999999", name: "Some Game" },
                    application: { id: "999999999999999999" },
                    playingMembers: users,
                    activityUser: users[0]
                }
            ],
            voiceChannels: [
                {
                    channel: { id: "333333333333333333" },
                    guild: { id: "444444444444444444" },
                    members: users
                }
            ],
            applicationStreams: [
                {
                    stream: { ownerId: "555555555555555555" },
                    streamUser: users[0]
                }
            ],
            guildContext: { id: "444444444444444444", name: "Some Guild" }
        }
    };
}

const alice = { id: ALICE, username: "alice" };
const bob = { id: BOB, username: "bob" };

describe("parseHiddenUsers", () => {
    it("returns an empty set for empty or blank input", () => {
        expect(parseHiddenUsers("").size).toBe(0);
        expect(parseHiddenUsers("   \n\t  ").size).toBe(0);
    });

    it("accepts every documented separator", () => {
        const ids = parseHiddenUsers(`${ALICE}\n${BOB},${ALICE}; ${BOB}`);

        expect([...ids].sort()).toEqual([ALICE, BOB].sort());
    });

    it("accepts mentions, with and without the nickname marker", () => {
        expect([...parseHiddenUsers(`<@${ALICE}> <@!${BOB}>`)]).toEqual([ALICE, BOB]);
    });

    it("ignores anything that is not an ID instead of guessing", () => {
        const ids = parseHiddenUsers("alice\nnot-an-id\n123\n" + BOB);

        expect([...ids]).toEqual([BOB]);
    });

    it("does not treat a longer number with a suffix as an ID", () => {
        expect(parseHiddenUsers(`${ALICE}abc`).size).toBe(0);
    });

    it("respects snowflake length bounds (15 to 20 digits)", () => {
        const id14 = "12345678901234";
        const id15 = "123456789012345";
        const id20 = "12345678901234567890";
        const id21 = "123456789012345678901";

        const parsed = parseHiddenUsers(`${id14} ${id15} ${id20} ${id21}`);
        expect(parsed.has(id14)).toBe(false);
        expect(parsed.has(id15)).toBe(true);
        expect(parsed.has(id20)).toBe(true);
        expect(parsed.has(id21)).toBe(false);
    });

    it("drops role and channel mentions", () => {
        const parsed = parseHiddenUsers(`<@&${ALICE}> <#${BOB}>`);
        expect(parsed.size).toBe(0);
    });

    it("returns an empty set for undefined, null, or non-string input", () => {
        expect(parseHiddenUsers().size).toBe(0);
        expect(parseHiddenUsers(undefined).size).toBe(0);
        expect(parseHiddenUsers(null).size).toBe(0);
        expect(parseHiddenUsers(12345).size).toBe(0);
    });
});

describe("collectUserIds", () => {
    it("finds users nested in the party payload", () => {
        expect(collectUserIds(card([alice, bob])).sort()).toEqual([ALICE, BOB].sort());
    });

    it("never picks up channel, guild, application or stream IDs", () => {
        const ids = collectUserIds(card([alice]));

        for (const foreign of ["333333333333333333", "444444444444444444", "999999999999999999", "555555555555555555"]) {
            expect(ids).not.toContain(foreign);
        }
    });

    it("survives cyclic payloads", () => {
        const cyclic: Record<string, unknown> = { id: ALICE, username: "alice", user: {} };
        cyclic.user = cyclic;

        expect(collectUserIds(cyclic)).toEqual([ALICE]);
    });

    it("ignores primitives and null", () => {
        expect(collectUserIds(null)).toEqual([]);
        expect(collectUserIds(undefined)).toEqual([]);
        expect(collectUserIds("nope")).toEqual([]);
        expect(collectUserIds(12345)).toEqual([]);
        expect(collectUserIds(true)).toEqual([]);
    });

    it("recognizes users with alternative user-like properties (globalName, discriminator, avatar)", () => {
        const withGlobal = { id: ALICE, globalName: "Alice Global" };
        const withDiscriminator = { id: BOB, discriminator: "1234" };
        const withAvatar = { id: "333333333333333333", avatar: "avatar_hash" };

        expect(collectUserIds({ members: [withGlobal, withDiscriminator, withAvatar] }).sort()).toEqual(
            [ALICE, BOB, "333333333333333333"].sort()
        );
    });

    it("does not collect container IDs just because they have a .user property", () => {
        const channelWithUser = { id: "444444444444444444", user: { id: ALICE, username: "alice" } };
        const containerWithEmptyUser = { id: "555555555555555555", user: {} };
        const containerWithNullUser = { id: "666666666666666666", user: null };

        expect(
            collectUserIds({ members: [channelWithUser, containerWithEmptyUser, containerWithNullUser] })
        ).toEqual([ALICE]);
    });

    it("ignores objects with snowflake ID that lack user-like properties", () => {
        const nonUserObject = { id: ALICE, channelName: "general", topic: "chat" };
        expect(collectUserIds({ members: [nonUserObject] })).toEqual([]);
    });

    it("collects users from the 'users' container key", () => {
        expect(collectUserIds({ users: [alice] })).toEqual([ALICE]);
    });

    it("stops traversal beyond MAX_DEPTH (6)", () => {
        // Build a tree of depth 8
        let current: Record<string, unknown> = { id: ALICE, username: "alice" };
        for (let d = 0; d < 8; d++) {
            current = { party: current };
        }
        // At depth > 6, traversal should skip and not collect Alice
        expect(collectUserIds(current)).toEqual([]);
    });
});

describe("withoutHiddenUsers", () => {
    it("drops a card that contains a hidden user", () => {
        const cards = [card([alice, bob]), card([bob])];
        const visible = withoutHiddenUsers(cards, parseHiddenUsers(ALICE));

        expect(visible).toHaveLength(1);
        expect(collectUserIds(visible[0])).toEqual([BOB]);
    });

    it("drops a group card as a whole, including the people who are not hidden", () => {
        const visible = withoutHiddenUsers([card([alice, bob])], parseHiddenUsers(ALICE));

        expect(visible).toHaveLength(0);
    });

    it("returns the original array when nothing is hidden", () => {
        const cards = [card([alice])];

        expect(withoutHiddenUsers(cards, parseHiddenUsers(""))).toBe(cards);
    });

    it("handles empty cards list", () => {
        expect(withoutHiddenUsers([], parseHiddenUsers(ALICE))).toEqual([]);
    });

    it("keeps all cards when none match hidden users", () => {
        const cards = [card([bob])];
        const visible = withoutHiddenUsers(cards, parseHiddenUsers(ALICE));
        expect(visible).toHaveLength(1);
        expect(visible[0]).toBe(cards[0]);
    });

    it("drops all cards when every card contains hidden users", () => {
        const cards = [card([alice]), card([alice, bob])];
        const visible = withoutHiddenUsers(cards, parseHiddenUsers(ALICE));
        expect(visible).toHaveLength(0);
    });
});
