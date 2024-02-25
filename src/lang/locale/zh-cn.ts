export default {
  // General Settings
  'General Settings': '常规设置',

  'Enable Inline Queries': '启用行内查询',
  'Description of Enable Inline Queries': '启用或禁用执行常规 Dataview 行内查询',

  'Enable JavaScript Queries': '启用 JavaScript 查询',
  'Description of Enable JavaScript Queries': '启用或禁用执行 DataviewJS 查询',

  'Enable Inline JavaScript Queries': '启用行内 JavaScript 查询',
  'Description of Enable Inline JavaScript Queries': '启用或禁用执行行内 DataviewJS 查询。需要启用 DataviewJS 查询',

  'Enable Inline Field Highlighting in Reading View': '在阅读视图中高亮行内字段',
  'Description of Enable Inline Field Highlighting in Reading View': '在阅读视图中，启用或禁用行内字段的渲染。',

  'Enable Inline Field Highlighting in Live Preview': '在实时预览中高亮行内字段',
  'Description of Enable Inline Field Highlighting in Live Preview': '在实时预览中，启用或禁用行内字段的渲染。',

  // Codeblock Settings
  'Codeblock Settings': '代码块设置',

  'DataviewJS Keyword': 'DataviewJS 关键字',
  "Description of DataviewJS Keyword": "DataviewJS 代码块的关键字. 默认是 'dataviewjs'. 需要重启 Obsidian 才能生效.",

  'Inline Query Prefix': '行内查询的前缀',
  "Description of Inline Query Prefix": "行内查询的前缀 (用来标识 Dataview 查询)，默认为 '='。",

  'JavaScript Inline Query Prefix': 'JavaScript 行内查询的前缀',
  "Description of JavaScript Inline Query Prefix": "JavaScript 行内查询的前缀 (用来标识 DataviewJS 查询)，默认为 '$='.",

  'Codeblock Inline Queries': '代码块行内查询',
  'Description of Codeblock Inline Queries': '如果启用，行内查询也可以在代码块查询中生效',

  // View Settings
  'View Settings': '视图设置',

  // General
  'General': '常规',
  'Display result count': '显示结果数量',
  'Description of Display result count': '如果关闭，TASK 和 TABLE 查询结果开头处的小数字将被隐藏。',

  'Warn on Empty Result': '空结果警告',
  'Description of Warn on Empty Result': '如果设置，查询到 0 个结果的查询将会变为警告消息',

  'Render Null As': '空值渲染为',
  'Description of Render Null As': '默认情况下，表中应该显示 null 以及不存在的内容。支持 Markdown 语法',

  'Automatic View Refreshing': '自动刷新视图',
  'Description of Automatic View Refreshing': '如果启用，当库中的文件更改时，视图将自动刷新。这会产生负面影响',

  'Refresh Interval': '刷新间隔',
  'Description of Refresh Interval': '文件更改完成后，需要等待多长时间再更新视图 (单位: 毫秒)',

  'Date Format': '日期格式',
  'Description of Date Format': "默认日期的格式 (参见 Luxon 日期格式)" + " 当前: ",
  'Onchage Description of Date Format': "默认日期的格式(参见 Luxon 日期格式)" + " 当前: ",

  'Date + Time Format': '日期 + 时间格式',
  'Description of Date + Time Format': "默认的日期和时间的格式 (参见 Luxon 日期格式)" + " 当前: ",
  'Onchage Description of Date + Time Format': "默认的日期和时间的格式(参见 Luxon 日期格式)" + " 当前: ",

  // Table Setting
  "Table Settings": "表格视图设置",

  "Primary Column Name": "主列名称",
  "Description of Primary Column Name": "表格自动生成的第一列默认的 ID 的名称。内容为链接到源文件的链接。",

  "Grouped Column Name": "成组的列的名称",
  "Description of Grouped Column Name": "指当表格有内容成组后，表格自动生成的第一列的默认 ID 的名称。内容为链接到源文件的链接。",

  // Task Settings
  "Task Settings": "任务视图设置",

  "Automatic Task Completion Tracking": "自动任务完成跟踪",
  "Description[0] of Automatic Task Completion Tracking": "如果启用，当在 Dataview 查询结果中点击完成任务时，Dataview 将自动给任务附加及其完成日期。",
  "Description[1] of Automatic Task Completion Tracking": "用默认字段和默认日期格式举例: - [x] 我的任务 [completion:: 2022-01-01]",

  "Use Emoji Shorthand for Completion": "完成时用 Emoji 简写",
  "Description[0] of Use Emoji Shorthand for Completion": '如果启用，将使用 emoji 简写替代行内任务字段 "completion".',
  "Description[1] of Use Emoji Shorthand for Completion": "例子: - [x] 我的任务 ✅ 2022-01-01",
  "Description[2] of Use Emoji Shorthand for Completion": "如果想自定义完成日期格式或字段名称，或使用 Dataview 内联字段格式，请禁用此功能",
  "Description[3] of Use Emoji Shorthand for Completion": '只有启用 "自动任务完成跟踪" 之后才可启用此功能',

  "Completion Field Name": "完成字段的名称",
  "Description[0] of Completion Field Name": "当你在 dataview 视图中完成任务时，在任务末尾添加的完成时间的字段的名称",
  "Description[1] of Completion Field Name": '只有启用 "自动任务完成跟踪"，并且关闭 “完成时用 Emoji 简写” 之后才可启用此功能',

  "Completion Date Format": "完成字段的日期格式",
  "Description[0] of Completion Date Format": "当你在 dataview 视图中完成任务时，在任务末尾添加的完成时间的日期格式（参见 Luxon 日期格式）",
  "Description[1] of Completion Date Format": '只有启用 "自动任务完成跟踪"，并且关闭 “完成时用 Emoji 简写” 之后才可启用此功能',
  "Description[2] of Completion Date Format": "当前: ",

  "Recursive Sub-Task Completion": "递归完成子任务",
  "Description of Recursive Sub-Task Completion": "如果启用，当你在 dataview 视图中完成某任务，该任务的所有子任务也会一并完成",
};
