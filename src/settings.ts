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
}

export const DEFAULT_QUERY_SETTINGS: QuerySettings = {
    renderNullAs: "\\-",
    warnOnEmptyResult: true,
    refreshInterval: 1000,
    defaultDateFormat: "MMMM dd, yyyy",
    defaultDateTimeFormat: "h:mm a - MMMM dd, yyyy"
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

	// Internal properties //

	/** A monotonically increasing version which tracks what schema we are on, used for migrations. */
	schemaVersion: number;
}

/** Default settings for dataview on install. */
export const DEFAULT_SETTINGS: DataviewSettings = {...DEFAULT_QUERY_SETTINGS, ...{
	inlineQueryPrefix: "=",
    inlineJsQueryPrefix: "$=",
	enableDataviewJs: true,
	schemaVersion: 1
}};
