export { DataviewAPIInterface as DataviewAPI } from "./types/api";

// Data Types
export type { DateTime, Duration } from "luxon";
export type {
    Link,
    Task,
    DataObject,
    LiteralType,
    LiteralValue,
    LiteralRepr,
    WrappedLiteralValue,
    LiteralValueWrapper,
} from "data/value";

// Dataview Index.
export type { FullIndex, PrefixIndex, IndexMap } from "data/index";

import "obsidian";
import { App } from "obsidian";
import { DataviewAPIInterface, DVEventPrefix, DataviewEvents } from "./types/api";

// EVENTS

type OnArgs<T> = T extends [infer A, ...infer B]
    ? A extends string
        ? [name: `${typeof DVEventPrefix}${A}`, callback: (...args: B) => any]
        : never
    : never;
declare module "obsidian" {
    interface MetadataCache {
        on(...args: OnArgs<DataviewEvents>): EventRef;
    }
}

// UTIL FUNCTIONS

export const getAPI = (app?: App): DataviewAPIInterface | undefined => {
    if (app) return app.plugins.plugins.dataview?.api;
    else return window["DataviewAPI"];
};

export const isPluginEnabled = (app: App) => app.plugins.enabledPlugins.has("dataview");
