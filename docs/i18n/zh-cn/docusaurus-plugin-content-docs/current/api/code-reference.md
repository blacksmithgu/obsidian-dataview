---
sidebar_position: 3
---
# 代码块参考

Dataview JavaScript Codeblocks是使用`dataviewjs`语言规范创建的一个代码块。

~~~
```dataviewjs
dv.table([], ...)
```
~~~

API是通过隐含提供的`dv`（或`dataview`）变量来实现的，通过它可以查询信息，渲染HTML，并配置视图。

## 查询

### `dv.current()`

获取脚本当前执行的页面信息（`dv.page()`）。

### `dv.pages(source)`

接受一个字符串参数，`source`，与[查询语言来源](/docs/query/sources)的形式相同。返回一个[数据数组](/docs/api/data-array)的页面对象，它是以所有页面字段为值的普通对象。

```js
dv.pages("#books") => all pages with tag 'books'
dv.pages('"folder"') => all pages from folder "folder"
dv.pages("#yes or -#no") => all pages with tag #yes, or which DON'T have tag #no
```

### `dv.pagePaths(source)`

和`dv.pages`一样，但只是返回一个[数据数组](/docs/api/data-array)，其中包括符合给定来源的页面路径。

```js
dv.pagePaths("#books") => the paths of pages with tag 'books'
```

### `dv.page(path)`

将一个简单的路径映射到完整的页面对象，其中包括所有的页面字段。自动进行链接解析，如果不存在，会自动进行扩展。

```js
dv.page("Index") => The page object for /Index
dv.page("books/The Raisin.md") => The page object for /books/The Raisin.md
```

## 渲染

### `dv.header(level, text)`

用给定的文本渲染1 - 6级标题。

```js
dv.header(1, "Big!");
dv.header(6, "Tiny");
```

### `dv.paragraph(text)`

在段落中渲染任意文本。

```js
dv.paragraph("This is some text");
```

## Dataviews

### `dv.list(elements)`

渲染一个dataview的元素列表；接受vanilla数组和数据数组。

```js
dv.list([1, 2, 3]) => list of 1, 2, 3
dv.list(dv.pages().file.name) => list of all file names
dv.list(dv.pages().file.link) => list of all file links
dv.list(dv.pages("#book").where(p => p.rating > 7)) => list of all books with rating greater than 7
```

### `dv.taskList(tasks, groupByFile)`

渲染一个由`page.file.tasks`获得的`Task`对象的dataview任务列表。第一个参数是必需的；如果提供第二个参数`groupByFile`(须为真)，那么将会按照文件的来源对任务列表进行分组。

```js
// List all tasks from pages marked '#project'
dv.taskList(dv.pages("#project").file.tasks)

// List all *uncompleted* tasks from pages marked #project
dv.taskList(dv.pages("#project").file.tasks
    .where(t => !t.completed))

// List all tasks tagged with '#tag' from pages marked #project
dv.taskList(dv.pages("#project").file.tasks
    .where(t => t.text.includes("#tag")))
```

### `dv.table(headers, elements)`

用给定的标题列表和2维数组渲染一个dataview表格。

```js
// Render a simple table of book info sorted by rating.
dv.table(["File", "Genre", "Time Read", "Rating"], dv.pages("#book")
    .sort(b => b.rating)
    .map(b => [b.file.link, b.genre, b["time-read"], b.rating]))
```

## 工具

### `dv.array(value)`

将一个给定的值或数组转换成Dataview [数据数组](data-array)。如果该值已经是一个数据数组，则返回它，不作任何改变。

```js
dv.array([1, 2, 3]) => dataview data array [1, 2, 3]
```

### `dv.compare(a, b)`

根据dataview的默认比较规则，比较两个任意的JavaScript值；如果你打算写一个自定义的比较器并且不想影响正常代码，那非常有用。如果`a < b`返回-1，如果`a = b`返回0，如果`a > b`返回1。

```
dv.compare(1, 2) = -1
dv.compare("yes", "no") = 1
dv.compare({ what: 0 }, { what: 0 }) = 0
```

### `dv.equal(a, b)`

比较两个任意的JavaScript值，如果根据Dataview的默认比较规则是相等的，则返回true。

```
dv.equal(1, 2) = false
dv.equal(1, 1) = true
```