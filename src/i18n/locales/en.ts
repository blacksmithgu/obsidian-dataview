const en = {
    settings: {
        enableInlineQueries: {
            name: "Enable inline queries",
            desc: "Enable or disable executing regular inline Dataview queries.",
        },
        enableJsQueries: {
            name: "Enable JavaScript queries",
            desc: "Enable or disable executing DataviewJS queries.",
        },
        enableInlineJsQueries: {
            name: "Enable inline JavaScript queries",
            desc: "Enable or disable executing inline DataviewJS queries. Requires that DataviewJS queries are enabled.",
        },
        enableInlineFieldHighlightingReadingView: {
            name: "Enable inline field highlighting in reading view",
            desc: "Enables or disables visual highlighting / pretty rendering for inline fields in reading view.",
        },
        enableInlineFieldHighlightingLivePreview: {
            name: "Enable inline field highlighting in Live Preview",
            desc: "Enables or disables visual highlighting / pretty rendering for inline fields in Live Preview.",
        },
        codeblocks: {
            heading: "Codeblocks",
        },
        dataviewJsKeyword: {
            name: "DataviewJS keyword",
            desc: "Keyword for DataviewJS blocks. Defaults to 'dataviewjs'. Reload required for changes to take effect.",
        },
        inlineQueryPrefix: {
            name: "Inline query prefix",
            desc: "The prefix to inline queries (to mark them as Dataview queries). Defaults to '='.",
        },
        inlineJsQueryPrefix: {
            name: "JavaScript inline query prefix",
            desc: "The prefix to JavaScript inline queries (to mark them as DataviewJS queries). Defaults to '$='.",
        },
        inlineQueriesInCodeblocks: {
            name: "Code block inline queries",
            desc: "If enabled, inline queries will also be evaluated inside full code blocks.",
        },
        view: {
            heading: "View",
        },
        showResultCount: {
            name: "Display result count",
            desc: "If toggled off, the small number in the result header of TASK and TABLE queries will be hidden.",
        },
        warnOnEmptyResult: {
            name: "Warn on empty result",
            desc: "If set, queries which return 0 results will render a warning message.",
        },
        renderNullAs: {
            name: "Render null as",
            desc: "What null/non-existent should show up as in tables, by default. This supports Markdown notation.",
        },
        refreshEnabled: {
            name: "Automatic view refreshing",
            desc: "If enabled, views will automatically refresh when files in your vault change; this can negatively affect some functionality like embeds in views, so turn it off if such functionality is not working.",
        },
        refreshInterval: {
            name: "Refresh interval",
            desc: "How long to wait (in milliseconds) for files to stop changing before updating views.",
        },
        defaultDateFormat: {
            name: "Date format",
            desc: "The default date format (see Luxon date format options). Currently: {0}",
        },
        defaultDateTimeFormat: {
            name: "Date + time format",
            desc: "The default date and time format (see Luxon date format options). Currently: {0}",
        },
        tables: {
            heading: "Tables",
        },
        tableIdColumnName: {
            name: "Primary column name",
            desc: "The name of the default ID column in tables; this is the auto-generated first column that links to the source file.",
        },
        tableGroupColumnName: {
            name: "Grouped column name",
            desc: "The name of the default ID column in tables, when the table is on grouped data; this is the auto-generated first column that links to the source file/group.",
        },
        tasks: {
            heading: "Tasks",
        },
        taskCompletionTracking: {
            name: "Automatic task completion tracking",
            desc1: "If enabled, Dataview will automatically append tasks with their completion date when they are checked in Dataview views.",
            desc2: "Example with default field name and date format: - [x] my task [completion:: 2022-01-01]",
        },
        taskCompletionUseEmojiShorthand: {
            name: "Use emoji shorthand for completion",
            desc1: 'If enabled, will use emoji shorthand instead of inline field formatting to fill out implicit task field "completion".',
            desc2: "Example: - [x] my task ✅ 2022-01-01",
            desc3: "Disable this to customize the completion date format or field name, or to use Dataview inline field formatting.",
            desc4: 'Only available when "automatic task completion tracking" is enabled.',
            descDisabled: 'Only available when "automatic task completion tracking" is enabled.',
        },
        taskCompletionText: {
            name: "Completion field name",
            desc1: "Text used as inline field key for task completion date when toggling a task's checkbox in a Dataview view.",
            desc2: 'Only available when "automatic task completion tracking" is enabled and "use emoji shorthand for completion" is disabled.',
            descDisabled:
                'Only available when "automatic task completion tracking" is enabled and "use emoji shorthand for completion" is disabled.',
        },
        taskCompletionDateFormat: {
            name: "Completion date format",
            desc1: "Date-time format for task completion date when toggling a task's checkbox in a Dataview view (see Luxon date format options).",
            desc2: 'Only available when "automatic task completion tracking" is enabled and "use emoji shorthand for completion" is disabled.',
            desc3: "Currently: {0}",
            descDisabled:
                'Only available when "automatic task completion tracking" is enabled and "use emoji shorthand for completion" is disabled.',
        },
        recursiveSubTaskCompletion: {
            name: "Recursive sub-task completion",
            desc: "If enabled, completing a task in a Dataview will automatically complete its subtasks too.",
        },
    },
    views: {
        loading: "Loading...",
        jsDisabled: "Dataview JS queries are disabled. You can enable them in the Dataview settings.",
        inlineJsDisabled: "(disabled; enable in settings)",
        evaluationError: "Evaluation Error: {0}",
        noResultsList: "Dataview: No results to show for list query.",
        noResultsTable: "Dataview: No results to show for table query.",
        noResultsTask: "Dataview: No results to show for task query.",
        noResultsCalendar: "Dataview: Query returned 0 results.",
        inlineQueryError: "Dataview (for inline query '{0}'): {1}",
        inlineJsQueryError: "Dataview (for inline JS query '{0}'): {1}",
        unrecognizedValue: "Unrecognized: {0}",
        calendarError: "Dataview: {0}",
    },
    query: {
        limitError: "Failed to execute 'limit' statement: {0}",
        unrecognizedOperation: "Unrecognized query operation '{0}'",
    },
};

export default en;
