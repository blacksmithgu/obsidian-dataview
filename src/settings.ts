////////////////////
// Query Settings //
////////////////////

export interface QuerySettings {
    /** What to render 'null' as in tables. Defaults to '-'. */
    renderNullAs: string;
    /** If enabled, tasks in Dataview views will automatically have their completion date appended when they are checked. */
    taskCompletionTracking: boolean;
    /** The name of the inline field to be added as a task's completion when checked */
    taskCompletionText: string;
    /** Date format of the task's completion timestamp */
    taskCompletionDateFormat: string;
    /** If true, render a modal which shows no results were returned. */
    warnOnEmptyResult: boolean;
    /** Whether or not automatic view refreshing is enabled. */
    refreshEnabled: boolean;
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
    taskCompletionTracking: false,
    taskCompletionText: "completion",
    taskCompletionDateFormat: "yyyy-MM-dd",
    warnOnEmptyResult: true,
    refreshEnabled: true,
    refreshInterval: 2500,
    defaultDateFormat: "MMMM dd, yyyy",
    defaultDateTimeFormat: "h:mm a - MMMM dd, yyyy",
    maxRecursiveRenderDepth: 4,

    tableIdColumnName: "File",
    tableGroupColumnName: "Group",
};

/////////////////////
// Export Settings //
/////////////////////

export interface ExportSettings {
    /** Whether or not HTML should be used for formatting in exports. */
    allowHtml: boolean;
}

export const DEFAULT_EXPORT_SETTINGS: ExportSettings = {
    allowHtml: true,
};

///////////////////////////////
// General Dataview Settings //
///////////////////////////////

export interface DataviewSettings extends QuerySettings, ExportSettings {
    /** The prefix for inline queries by default. */
    inlineQueryPrefix: string;
    /** The prefix for inline JS queries by default. */
    inlineJsQueryPrefix: string;
    /** If true, inline queries are also evaluated in full codeblocks. */
    inlineQueriesInCodeblocks: boolean;
    /** Enable or disable executing DataviewJS queries. */
    enableDataviewJs: boolean;
    /** Enable or disable executing inline DataviewJS queries. */
    enableInlineDataviewJs: boolean;
    /** Enable or disable rendering inline fields prettily. */
    prettyRenderInlineFields: boolean;
}

/** Default settings for dataview on install. */
export const DEFAULT_SETTINGS: DataviewSettings = {
    ...DEFAULT_QUERY_SETTINGS,
    ...DEFAULT_EXPORT_SETTINGS,
    ...{
        inlineQueryPrefix: "=",
        inlineJsQueryPrefix: "$=",
        inlineQueriesInCodeblocks: true,
        enableDataviewJs: false,
        enableInlineDataviewJs: false,
        prettyRenderInlineFields: true,
    },
};
