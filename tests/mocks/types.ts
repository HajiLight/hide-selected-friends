export enum OptionType {
    STRING = 0,
    NUMBER = 1,
    BOOLEAN = 2,
    SELECT = 3,
    SLIDER = 4,
    COMPONENT = 5,
    COLOR = 6,
    CUSTOM = 7,
}

export default function definePlugin<T>(plugin: T): T {
    return plugin;
}
