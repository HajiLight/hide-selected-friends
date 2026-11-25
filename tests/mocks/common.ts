// Stand-in for Vencord's @webpack/common in unit tests: the plugin only reaches for
// RelationshipStore.emitChange to force the friends list to recompute.
export const RelationshipStore = {
    emitChange() {}
};
