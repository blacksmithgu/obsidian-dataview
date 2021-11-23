import { Events, MetadataCache } from "obsidian";
import { OverloadedParameters } from "./utils";

// Events helpers

export type DvEventPrefix = "dataview:";
// Util type to get dataview event full name

export type DvEventFullName<T extends string> = `${DvEventPrefix}${T}`;
// Index Event Types

export type IndexEvtName = "metadata-change";
export type IndexEvtFullName = DvEventFullName<IndexEvtName>;
type MetaCacheOnParams = OverloadedParameters<MetadataCache["on"]>;
type TriggerArgsFrom<T extends Parameters<Events["on"]>> = T extends [
    name: infer FullName,
    callback: (...data: infer Args) => any
]
    ? FullName extends `${DvEventPrefix}${infer _Name}`
        ? [name: FullName, ...args: Args]
        : never
    : never;
// Extract from all metadataCache events prefixed with "dataview:"

export type DvEvtTriggerArgs = TriggerArgsFrom<MetaCacheOnParams>;
type ExtractEvtCallbackArgs<Name extends string, TArgs extends DvEvtTriggerArgs> = TArgs extends [
    name: Name,
    ...args: infer Args
]
    ? Args
    : never;
export type IndexEvtTriggerArgs = ExtractEvtCallbackArgs<IndexEvtFullName, DvEvtTriggerArgs>;
