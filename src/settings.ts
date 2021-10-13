////////////////////
// Query Settings //
////////////////////

export interface QuerySettings {
    /** What to render 'null' as in tables. Defaults to '-'. */
    renderNullAs: string;
    /** If true, render a modal which shows no results were returned. */
    warnOnEmptyResult: boolean;
    /** The interval that views are refreshed, by default. */
    refreshInterval: number;
    /** The default format that dates are rendered in (using luxon's moment-like formatting). */
    defaultDateFormat: string;
    /** The default format that date-times are rendered in (using luxons moment-like formatting). */
    defaultDateTimeFormat: string;
    /** Maximum depth that objects will be expanded when being rendered recursively. */
    maxRecursiveRenderDepth: number;

    /** The name of the default ID field ('File'). */
    tableIdColumnName: string;
    /** The name of default ID fields on grouped data ('Group'). */
    tableGroupColumnName: string;
}

export const DEFAULT_QUERY_SETTINGS: QuerySettings = {
    renderNullAs: "\\-",
    warnOnEmptyResult: true,
    refreshInterval: 1000,
    defaultDateFormat: "MMMM dd, yyyy",
    defaultDateTimeFormat: "h:mm a - MMMM dd, yyyy",
    maxRecursiveRenderDepth: 6,

    tableIdColumnName: "File",
    tableGroupColumnName: "Group",
};

///////////////////////////////
// General Dataview Settings //
///////////////////////////////

export interface DataviewSettings extends QuerySettings {
    /** The prefix for inline queries by default. */
    inlineQueryPrefix: string;
    /** The prefix for inline JS queries by default. */
    inlineJsQueryPrefix: string;
    /** Enable or disable executing DataviewJS queries. */
    enableDataviewJs: boolean;
    /** Enable or disable executing inline DataviewJS queries. */
    enableInlineDataviewJs: boolean;
    /** Enable or disable rendering inline fields prettily. */
    prettyRenderInlineFields: boolean;

    // Internal properties //

    /** A monotonically increasing version which tracks what schema we are on, used for migrations. */
    schemaVersion: number;
}

/** Default settings for dataview on install. */
export const DEFAULT_SETTINGS: DataviewSettings = {
    ...DEFAULT_QUERY_SETTINGS,
    ...{
        inlineQueryPrefix: "=",
        inlineJsQueryPrefix: "$=",
        enableDataviewJs: false,
        enableInlineDataviewJs: false,
        prettyRenderInlineFields: true,
        schemaVersion: 1,
    },
};
