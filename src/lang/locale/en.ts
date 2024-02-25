export default {
  // General Settings
  'General Settings': 'General Settings',

  'Enable Inline Queries': 'Enable Inline Queries',
  'Description of Enable Inline Queries': 'Enable or disable executing regular inline Dataview queries.',

  'Enable JavaScript Queries': 'Enable JavaScript Queries',
  'Description of Enable JavaScript Queries': 'Enable or disable executing DataviewJS queries.',

  'Enable Inline JavaScript Queries': 'Enable Inline JavaScript Queries',
  'Description of Enable Inline JavaScript Queries': 'Enable or disable executing inline DataviewJS queries. Requires that DataviewJS queries are enabled.',

  'Enable Inline Field Highlighting in Reading View': 'Enable Inline Field Highlighting in Reading View',
  'Description of Enable Inline Field Highlighting in Reading View': 'Enables or disables visual highlighting / pretty rendering for inline fields in Reading View.',

  'Enable Inline Field Highlighting in Live Preview': 'Enable Inline Field Highlighting in Live Preview',
  'Description of Enable Inline Field Highlighting in Live Preview': 'Enables or disables visual highlighting / pretty rendering for inline fields in Live Preview.',

  // Codeblock Settings
  'Codeblock Settings': 'Codeblock Settings',

  'DataviewJS Keyword': 'DataviewJS Keyword',
  "Description of DataviewJS Keyword": "Keyword for DataviewJS blocks. Defaults to 'dataviewjs'. Reload required for changes to take effect.",
  
  'Inline Query Prefix': 'Inline Query Prefix',
  "Description of Inline Query Prefix": "The prefix to inline queries (to mark them as Dataview queries). Defaults to '='.",

  'JavaScript Inline Query Prefix': 'JavaScript Inline Query Prefix',
  "Description of JavaScript Inline Query Prefix": "The prefix to JavaScript inline queries (to mark them as DataviewJS queries). Defaults to '$='.",

  'Codeblock Inline Queries': 'Codeblock Inline Queries',
  'Description of Codeblock Inline Queries': 'If enabled, inline queries will also be evaluated inside full codeblocks.',

  // View Settings
  'View Settings': 'View Settings',

  // General
  'General': 'General',
  'Display result count': 'Display result count',
  'Description of Display result count': 'If toggled off, the small number in the result header of TASK and TABLE Queries will be hidden.',
  
  'Warn on Empty Result': 'Warn on Empty Result',
  'Description of Warn on Empty Result': 'If set, queries which return 0 results will render a warning message.',
  
  'Render Null As': 'Render Null As',
  'Description of Render Null As': 'What null/non-existent should show up as in tables, by default. This supports Markdown notation.',
  
  'Automatic View Refreshing': 'Automatic View Refreshing',
  'Description of Automatic View Refreshing': 'If enabled, views will automatically refresh when files in your vault change; this can negatively affect',

  'Refresh Interval': 'Refresh Interval',
  'Description of Refresh Interval': 'How long to wait (in milliseconds) for files to stop changing before updating views.',

  'Date Format': 'Date Format',
  'Description of Date Format': "The default date format (see Luxon date format options)." + " Currently: ",
  'Onchange Description of Date Format': "The default date format (see Luxon date format options)." + " Currently: ",

  'Date + Time Format': 'Date + Time Format',
  'Description of Date + Time Format': "The default date and time format (see Luxon date format options)." + " Currently: ",
  'Onchange Description of Date + Time Format': "The default date and time format (see Luxon date format options)." + " Currently: ",

  // Table Setting
  "Table Settings": "Table Settings",

  "Primary Column Name": "Primary Column Name",
  "Description of Primary Column Name": "The name of the default ID column in tables; this is the auto-generated first column that links to the source file.",

  "Grouped Column Name": "Grouped Column Name",
  "Description of Grouped Column Name": 
    "The name of the default ID column in tables, when the table is on grouped data; this is the auto-generated first column" +
    "that links to the source file/group.",
  
  // Task Settings
  "Task Settings": "Task Settings",

  "Automatic Task Completion Tracking": "Automatic Task Completion Tracking",
  "Description[0] of Automatic Task Completion Tracking": "If enabled, Dataview will automatically append tasks with their completion date when they are checked in Dataview views.",
  "Description[1] of Automatic Task Completion Tracking": "Example with default field name and date format: - [x] my task [completion:: 2022-01-01]",

  "Use Emoji Shorthand for Completion": "Use Emoji Shorthand for Completion",
  "Description[0] of Use Emoji Shorthand for Completion": 'If enabled, will use emoji shorthand instead of inline field formatting to fill out implicit task field "completion".',
  "Description[1] of Use Emoji Shorthand for Completion": "Example: - [x] my task ✅ 2022-01-01",
  "Description[2] of Use Emoji Shorthand for Completion": "Disable this to customize the completion date format or field name, or to use Dataview inline field formatting.",
  "Description[3] of Use Emoji Shorthand for Completion": 'Only available when "Automatic Task Completion Tracking" is enabled.',

  "Completion Field Name": "Completion Field Name",
  "Description[0] of Completion Field Name": "Text used as inline field key for task completion date when toggling a task's checkbox in a dataview view.",
  "Description[1] of Completion Field Name": 'Only available when "Automatic Task Completion Tracking" is enabled and "Use Emoji Shorthand for Completion" is disabled.',

  "Completion Date Format": "Completion Date Format",
  "Description[0] of Completion Date Format": "Date-time format for task completion date when toggling a task's checkbox in a dataview view (see Luxon date format options).",
  "Description[1] of Completion Date Format": 'Only available when "Automatic Task Completion Tracking" is enabled and "Use Emoji Shorthand for Completion" is disabled.',
  "Description[2] of Completion Date Format": "Currently: ",

  "Recursive Sub-Task Completion": "Recursive Sub-Task Completion",
  "Description of Recursive Sub-Task Completion": "If enabled, completing a task in a DataView will automatically complete its subtasks too.",
};
