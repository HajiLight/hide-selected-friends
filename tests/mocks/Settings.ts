export interface MockDefinedSettings<T extends Record<string, any>, P extends object = {}> {
    def: T;
    store: Record<string, any> & P;
    withPrivateSettings<NewP extends object>(): MockDefinedSettings<T, NewP>;
}

const pathListeners = new Map<string, Set<(data: any) => void>>();

export const SettingsStore = {
    addChangeListener(path: string, cb: (data: any) => void) {
        const set = pathListeners.get(path) ?? new Set();
        set.add(cb);
        pathListeners.set(path, set);
    },
    removeChangeListener(path: string, cb: (data: any) => void) {
        const set = pathListeners.get(path);
        if (!set) return;
        set.delete(cb);
        if (set.size === 0) pathListeners.delete(path);
    },
    notify(path: string, value: any) {
        pathListeners.get(path)?.forEach(cb => cb(value));
    }
};

export function definePluginSettings<T extends Record<string, any>>(def: T): MockDefinedSettings<T> {
    const rawStore: Record<string, any> = { enabled: true };
    for (const [key, value] of Object.entries(def)) {
        rawStore[key] = value.default;
    }
    const store = new Proxy(rawStore, {
        set(target, prop, value) {
            const changed = target[prop as string] !== value;
            target[prop as string] = value;
            if (changed && prop === "enabled") {
                SettingsStore.notify("plugins.HideSelectedFriends.enabled", value);
            }
            return true;
        }
    });
    const settings: MockDefinedSettings<T> = {
        def,
        store,
        withPrivateSettings<NewP extends object>() {
            return settings as unknown as MockDefinedSettings<T, NewP>;
        }
    };
    return settings;
}
