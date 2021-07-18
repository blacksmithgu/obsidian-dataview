////////////////////
// Query Settings //
////////////////////

export interface QuerySettings {
    renderNullAs: string;
    warnOnEmptyResult: boolean;
    refreshInterval: number;
}

export const DEFAULT_QUERY_SETTINGS: QuerySettings = {
    renderNullAs: "\\-",
    warnOnEmptyResult: true,
    refreshInterval: 1000
};

///////////////////////////////
// General Dataview Settings //
///////////////////////////////

export interface DataviewSettings extends QuerySettings {
	/** What to render 'null' as in tables. Defaults to '-'. */
	renderNullAs: string;
	/** If true, render a modal which shows no results were returned. */
	warnOnEmptyResult: boolean;
	/** The prefix for inline queries by default. */
	inlineQueryPrefix: string;
    /** The prefix for inline JS queries by default. */
    inlineJsQueryPrefix: string;
	/** The interval that views are refreshed, by default. */
	refreshInterval: number;
	/** Enable or disable executing DataviewJS queries. */
	enableDataviewJs: boolean;

	// Internal properties //

	/** A monotonically increasing version which tracks what schema we are on, used for migrations. */
	schemaVersion: number;
}

/** Default settings for dataview on install. */
export const DEFAULT_SETTINGS: DataviewSettings = {
	renderNullAs: "\\-",
	warnOnEmptyResult: true,
	inlineQueryPrefix: "=",
    inlineJsQueryPrefix: "$=",
	refreshInterval: 1000,
	enableDataviewJs: true,
	schemaVersion: 1
}
