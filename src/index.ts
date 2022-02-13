export { DvAPIInterface as DataviewAPI } from "./typings/api";

// Data Types
export type { DateTime, Duration } from "luxon";
export type {
    Link,
    DataObject,
    LiteralType,
    Literal as LiteralValue,
    LiteralRepr,
    WrappedLiteral as WrappedLiteralValue,
    LiteralWrapper as LiteralValueWrapper,
} from "data-model/value";

export type { ListItem } from "data-model/markdown";

// Dataview Index.
export type { FullIndex, PrefixIndex, IndexMap } from "data-index/index";

import "obsidian";
import { App } from "obsidian";
import { DvAPIInterface } from "./typings/api";
import { DvEventFullName, IndexEvtFullName } from "./typings/events";

// EVENTS

declare module "obsidian" {
    interface MetadataCache {
        /**
         * @deprecated Not required anymore, though holding onto it for backwards-compatibility.
         */
        on(name: DvEventFullName<"api-ready">, callback: (api: DvAPIInterface) => void): EventRef;
        /** Index events: Called when dataview metadata for a file changes. */
        on(name: IndexEvtFullName, callback: (type: "rename", file: TAbstractFile, oldPath: string) => void): EventRef;
        /** Index events: Called when a file is deleted from the dataview index. */
        on(name: IndexEvtFullName, callback: (type: "delete" | "update", file: TFile) => void): EventRef;
    }
}

// UTIL FUNCTIONS

export const getAPI = (app?: App): DvAPIInterface | undefined => {
    if (app) return app.plugins.plugins.dataview?.api;
    else return window["DataviewAPI"];
};

export const isPluginEnabled = (app: App) => app.plugins.enabledPlugins.has("dataview");
