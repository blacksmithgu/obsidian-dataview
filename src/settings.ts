////////////////////
// Query Settings //
////////////////////

export interface QuerySettings {
    /** What to render 'null' as in tables. Defaults to '-'. */
    renderNullAs: string;
    /** If enabled, tasks in Dataview views will automatically have their completion date appended when they are checked. */
    taskCompletionTracking: boolean;
    /** If enabled, automatic completions will use emoji shorthand ✅ YYYY-MM-DD instead of [completion:: date]. */
    taskCompletionUseEmojiShorthand: boolean;
    /** The name of the inline field to be added as a task's completion when checked. Only used if completionTracking is enabled and emojiShorthand is not. */
    taskCompletionText: string;
    /** Date format of the task's completion timestamp. Only used if completionTracking is enabled and emojiShorthand is not. */
    taskCompletionDateFormat: string;
    /** Whether or not subtasks should be recursively completed in addition to their parent task. */
    recursiveSubTaskCompletion: boolean;
    /** If true, render a modal which shows no results were returned. */
    warnOnEmptyResult: boolean;
    /** Whether or not automatic view refreshing is enabled. */
    refreshEnabled: boolean;
    /** The interval that views are refreshed, by default. */
    refreshInterval: number;
    /** The default format that dates are rendered in (using luxon's moment-like formatting). */
    defaultDateFormat: string;
    /** The default format that date-times are rendered in (using luxon's moment-like formatting). */
    defaultDateTimeFormat: string;
    /** Maximum depth that objects will be expanded when being rendered recursively. */
    maxRecursiveRenderDepth: number;
    /** The name of the default ID field ('File'). */
    tableIdColumnName: string;
    /** The name of default ID fields on grouped data ('Group'). */
    tableGroupColumnName: string;
    /** Include the result count as part of the output. */
    showResultCount: boolean;
}

export const DEFAULT_QUERY_SETTINGS: QuerySettings = {
    renderNullAs: "\\-",
    taskCompletionTracking: false,
    taskCompletionUseEmojiShorthand: false,
    taskCompletionText: "completion",
    taskCompletionDateFormat: "yyyy-MM-dd",
    recursiveSubTaskCompletion: false,
    warnOnEmptyResult: true,
    refreshEnabled: true,
    refreshInterval: 2500,
    defaultDateFormat: "MMMM dd, yyyy",
    defaultDateTimeFormat: "h:mm a - MMMM dd, yyyy",
    maxRecursiveRenderDepth: 4,

    tableIdColumnName: "File",
    tableGroupColumnName: "Group",
    showResultCount: true,
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
    /** Enable or disable regular inline queries. */
    enableInlineDataview: boolean;
    /** Enable or disable executing inline DataviewJS queries. */
    enableInlineDataviewJs: boolean;
    /** Enable or disable rendering inline fields prettily in Reading View. */
    prettyRenderInlineFields: boolean;
    /** Enable or disable rendering inline fields prettily in Live Preview. */
    prettyRenderInlineFieldsInLivePreview: boolean;
    /** The keyword for DataviewJS blocks. */
    dataviewJsKeyword: string;
}

/** Default settings for dataview on install. */
export const DEFAULT_SETTINGS: DataviewSettings = {
    ...DEFAULT_QUERY_SETTINGS,
    ...DEFAULT_EXPORT_SETTINGS,
    ...{
        inlineQueryPrefix: "=",
        inlineJsQueryPrefix: "$=",
        inlineQueriesInCodeblocks: true,
        enableInlineDataview: true,
        enableDataviewJs: false,
        enableInlineDataviewJs: false,
        prettyRenderInlineFields: true,
        prettyRenderInlineFieldsInLivePreview: true,
        dataviewJsKeyword: "dataviewjs",
    },
};
