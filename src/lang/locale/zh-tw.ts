export default {
  // General Settings
  'General Settings': '常規設置',

  'Enable Inline Queries': '啓用行內查詢',
  'Description of Enable Inline Queries': '啓用或禁用執行常規 Dataview 行內查詢',

  'Enable JavaScript Queries': '啓用 JavaScript 查詢',
  'Description of Enable JavaScript Queries': '啓用或禁用執行 DataviewJS 查詢',

  'Enable Inline JavaScript Queries': '啓用行內 JavaScript 查詢',
  'Description of Enable Inline JavaScript Queries': '啓用或禁用執行行內 DataviewJS 查詢。需要啓用 DataviewJS 查詢',

  'Enable Inline Field Highlighting in Reading View': '在閱讀視圖中高亮行內字段',
  'Description of Enable Inline Field Highlighting in Reading View': '在閱讀視圖中，啓用或禁用行內字段的渲染。',

  'Enable Inline Field Highlighting in Live Preview': '在實時預覽中高亮行內字段',
  'Description of Enable Inline Field Highlighting in Live Preview': '在實時預覽中，啓用或禁用行內字段的渲染。',

  // Codeblock Settings
  'Codeblock Settings': '代碼塊設置',

  'DataviewJS Keyword': 'DataviewJS 關鍵字',
  "Description of DataviewJS Keyword": "DataviewJS 代碼塊的關鍵字. 默認是 'dataviewjs'. 需要重啓 Obsidian 才能生效.",

  'Inline Query Prefix': '行內查詢的前綴',
  "Description of Inline Query Prefix": "行內查詢的前綴 (用來標識 Dataview 查詢)，默認爲 '='。",

  'JavaScript Inline Query Prefix': 'JavaScript 行內查詢的前綴',
  "Description of JavaScript Inline Query Prefix": "JavaScript 行內查詢的前綴 (用來標識 DataviewJS 查詢)，默認爲 '$='.",

  'Codeblock Inline Queries': '代碼塊行內查詢',
  'Description of Codeblock Inline Queries': '如果啓用，行內查詢也可以在代碼塊查詢中生效',

  // View Settings
  'View Settings': '視圖設置',

  // General
  'General': '常規',
  'Display result count': '顯示結果數量',
  'Description of Display result count': '如果關閉，TASK 和 TABLE 查詢結果開頭處的小數字將被隱藏。',

  'Warn on Empty Result': '空結果警告',
  'Description of Warn on Empty Result': '如果設置，查詢到 0 個結果的查詢將會變爲警告消息',

  'Render Null As': '空值渲染爲',
  'Description of Render Null As': '默認情況下，表中應該顯示 null 以及不存在的內容。支持 Markdown 語法',

  'Automatic View Refreshing': '自動刷新視圖',
  'Description of Automatic View Refreshing': '如果啓用，當庫中的文件更改時，視圖將自動刷新。這會產生負面影響',

  'Refresh Interval': '刷新間隔',
  'Description of Refresh Interval': '文件更改完成後，需要等待多長時間再更新視圖 (單位: 毫秒)',

  'Date Format': '日期格式',
  'Description of Date Format': "默認的日期和時間的格式 (參見Luxon日期格式)" + " 當前: ",
  'Onchage Description of Date Format': "默認的日期和時間的格式 (參見Luxon日期格式)" + " 當前: ",

  'Date + Time Format': '日期 + 时间格式',
  'Description of Date + Time Format': "默認的日期和時間的格式 (參見Luxon日期格式)" + " 當前: ",
  'Onchage Description of Date + Time Format': "默認的日期和時間的格式 (參見Luxon日期格式)" + " 當前: ",

  // Table Setting
  "Table Settings": "表格視圖設置",

  "Primary Column Name": "主列名稱",
  "Description of Primary Column Name": "表格自動生成的第一列的默認 ID 的名稱。內容為鏈接到源文件的鏈接。",

  "Grouped Column Name": "成組的列的名稱",
  "Description of Grouped Column Name": "指當表格有內容成組後，表格自動生成的第一列的默認 ID 的名稱。內容爲鏈接到源文件的鏈接。",

  // Task Settings
  "Task Settings": "任務視圖設置",

  "Automatic Task Completion Tracking": "自動任務完成跟蹤",
  "Description[0] of Automatic Task Completion Tracking": "如果啓用，當在 Dataview 查詢結果中點擊完成任務時，Dataview 將自動給任務附加及其完成日期。",
  "Description[1] of Automatic Task Completion Tracking": "用默認字段和默認日期格式舉例: - [x] 我的任務 [completion:: 2022-01-01]",

  "Use Emoji Shorthand for Completion": "完成時用 Emoji 簡寫",
  "Description[0] of Use Emoji Shorthand for Completion": '如果啓用，將使用 emoji 簡寫替代行內任務字段 "completion".',
  "Description[1] of Use Emoji Shorthand for Completion": "例子: - [x] 我的任務 ✅ 2022-01-01",
  "Description[2] of Use Emoji Shorthand for Completion": "如果想自定義完成日期格式或字段名稱，或使用 Dataview 內聯字段格式，請禁用此功能",
  "Description[3] of Use Emoji Shorthand for Completion": '只有啓用 "自動任務完成跟蹤" 之後纔可啓用此功能',

  "Completion Field Name": "完成字段的名稱",
  "Description[0] of Completion Field Name": "當你在 dataview 視圖中完成任務時，在任務末尾添加的完成時間的字段的名稱",
  "Description[1] of Completion Field Name": '只有啓用 "自動任務完成跟蹤"，並且關閉 “完成時用 Emoji 簡寫” 之後纔可啓用此功能',

  "Completion Date Format": "完成字段的日期格式",
  "Description[0] of Completion Date Format": "當你在 dataview 視圖中完成任務時，在任務末尾添加的完成時間的日期格式 (參見 Luxon 日期格式)",
  "Description[1] of Completion Date Format": '只有啓用 "自動任務完成跟蹤"，並且關閉 “完成時用 Emoji 簡寫” 之後纔可啓用此功能',
  "Description[2] of Completion Date Format": "當前: ",

  "Recursive Sub-Task Completion": "遞歸完成子任務",
  "Description of Recursive Sub-Task Completion": "如果啓用，當你在 dataview 視圖中完成某任務，該任務的所有子任務也會一併完成",
};
