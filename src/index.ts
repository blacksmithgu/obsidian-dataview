export type { DataviewApi } from "api/plugin-api";

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

// Dummy property to avoid some rollup warnings about an "empty chunk" (since this is only typings).
export const DATAVIEW_PLACEHOLDER_VALUE = null;
