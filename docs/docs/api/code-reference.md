# Codeblock Reference

Dataview JavaScript Codeblocks are created using the `dataviewjs` language specification for a codeblock:

~~~
```dataviewjs
dv.table([], ...)
```
~~~

The API is available through the implicitly provided `dv` (or `dataview`) variable, through which you can query for
information, render HTML, and configure the view.

Asynchronous API calls are marked with `⌛`.

## Query
Query methods allow you to query the Dataview index for page metadata; to render this data, use the methods in the [render section](#render).

### `dv.current()`

Get page information (via `dv.page()`) for the page the script is currently executing on.

### `dv.pages(source)`

Take a single string argument, `source`, which is the same form as a [query language source](../reference/sources.md).
Return a [data array](data-array.md) of page objects, which are plain objects with all of the page fields as
values.

```js
dv.pages() => all pages in your vault
dv.pages("#books") => all pages with tag 'books'
dv.pages('"folder"') => all pages from folder "folder"
dv.pages("#yes or -#no") => all pages with tag #yes, or which DON'T have tag #no
dv.pages('"folder" or #tag') => all pages with tag #tag, or from folder "folder"
```

Note that folders need to be double-quoted inside the string (i.e., `dv.pages("folder")` does not work, but
`dv.pages('"folder"')` does) - this is to exactly match how sources are written in the query language.

### `dv.pagePaths(source)`

As with `dv.pages`, but just returns a [data array](data-array.md) of paths of pages that match the given source.

```js
dv.pagePaths("#books") => the paths of pages with tag 'books'
```

### `dv.page(path)`

Map a simple path or link to the full page object, which includes all of the pages fields. Automatically does link resolution,
and will figure out the extension automatically if not present.

```js
dv.page("Index") => The page object for /Index
dv.page("books/The Raisin.md") => The page object for /books/The Raisin.md
```

## Render

### `dv.el(element, text)`

Render arbitrary text in the given html element.
```js
dv.el("b", "This is some bold text");
```

You can specify custom classes to add to the element via `cls`, and additional attributes via `attr`:

```js
dv.el("b", "This is some text", { cls: "dataview dataview-class", attr: { alt: "Nice!" } });
```

### `dv.header(level, text)`

Render a header of level 1 - 6 with the given text.

```js
dv.header(1, "Big!");
dv.header(6, "Tiny");
```

### `dv.paragraph(text)`

Render arbitrary text in a paragraph.

```js
dv.paragraph("This is some text");
```

### `dv.span(text)`

Render arbitrary text in a span (no padding above/below, unlike a paragraph).

```js
dv.span("This is some text");
```

### `dv.execute(source)`

Execute an arbitrary dataview query and embed the view into the current page.

```js
dv.execute("LIST FROM #tag");
dv.execute("TABLE field1, field2 FROM #thing");
```

### `dv.executeJs(source)`

Execute an arbitrary DataviewJS query and embed the view into the current page.

```js
dv.executeJs("dv.list([1, 2, 3])");
```

### `dv.view(path, input)`

Complex function which allows for custom views. Will attempt to load a JavaScript file at the given path, passing it
`dv` and `input` and allowing it to execute. This allows for you to re-use custom view code across multiple pages. Note
that this is an asynchronous function since it involves file I/O - make sure to `await` the result!


```js
await dv.view("views/custom", { arg1: ..., arg2: ... });
```

If you want to also include custom CSS in your view, you can instead pass a path to a folder containing `view.js` and
`view.css`; the CSS will be added to the view automatically:

```
views/custom
 -> view.js
 -> view.css
```

View scripts have access to the `dv` object (the API object), and an `input` object which is exactly whatever the second
argument of `dv.view()` was.

Bear in mind, `dv.view()` cannot read from directories starting with a dot, like `.views`. Example of an incorrect usage:

```js
await dv.view(".views/view1", { arg1: 'a', arg2: 'b' });
```
Attempting this will yield the following exception:

```
Dataview: custom view not found for '.views/view1/view.js' or '.views/view1.js'.
```

Also note, directory paths always originate from the vault root.

#### Example
In this example, we have a custom script file named `view1.js` in the `scripts` directory. 

**File:** `scripts/view1.js`
```js
console.log(`Loading view1`);

function foo(...args) {
  console.log('foo is called with args', ...args);
}
foo(input)
```

And we have an Obsidian document located under `projects`. We'll call `dv.view()` from this document using the `scripts/view1.js` path.

**Document:** `projects/customViews.md`
```js
await dv.view("scripts/view1", { arg1: 'a', arg2: 'b' }) 
```

When the above script is executed, it will print the following:

```
Loading view1
foo is called with args {arg1: 'a', arg2: 'b'}
```

## Dataviews

### `dv.list(elements)`

Render a dataview list of elements; accept both vanilla arrays and data arrays.

```js
dv.list([1, 2, 3]) => list of 1, 2, 3
dv.list(dv.pages().file.name) => list of all file names
dv.list(dv.pages().file.link) => list of all file links
dv.list(dv.pages("#book").where(p => p.rating > 7)) => list of all books with rating greater than 7
```

### `dv.taskList(tasks, groupByFile)`

Render a dataview list of `Task` objects, as obtained by `page.file.tasks`. By default, this view will automatically
group the tasks by their origin file. If you provide `false` as a second argument explicitly, it will instead render them
as a single unified list.

```js
// List all tasks from pages marked '#project'
dv.taskList(dv.pages("#project").file.tasks)

// List all *uncompleted* tasks from pages marked #project
dv.taskList(dv.pages("#project").file.tasks
    .where(t => !t.completed))

// List all tasks tagged with '#tag' from pages marked #project
dv.taskList(dv.pages("#project").file.tasks
    .where(t => t.text.includes("#tag")))

// List all tasks from pages marked '#project', without grouping.
dv.taskList(dv.pages("#project").file.tasks, false)
```

### `dv.table(headers, elements)`

Renders a dataview table. `headers` is an array of column headers. `elements` is an array of rows. Each row is itself an array of columns. Inside a row, every column which is an array will be rendered with bullet points.

```js
dv.table(
	["Col1", "Col2", "Col3"],
		[
			["Row1", "Dummy", "Dummy"],
			["Row2", 
				["Bullet1",
				 "Bullet2",
				 "Bullet3"],
			 "Dummy"],
			["Row3", "Dummy", "Dummy"]
		]
	);
```

An example of how to render a simple table of book info sorted by rating.

```js
dv.table(["File", "Genre", "Time Read", "Rating"], dv.pages("#book")
    .sort(b => b.rating)
    .map(b => [b.file.link, b.genre, b["time-read"], b.rating]))
```

## Markdown Dataviews

Functions which render to plain Markdown strings which you can then render or manipulate as desired.

### `dv.markdownTable(headers, values)`

Equivalent to `dv.table()`, which renders a table with the given list of headers and 2D array of elements, but
returns plain Markdown.

```js
// Render a simple table of book info sorted by rating.
const table = dv.markdownTable(["File", "Genre", "Time Read", "Rating"], dv.pages("#book")
    .sort(b => b.rating)
    .map(b => [b.file.link, b.genre, b["time-read"], b.rating]))

dv.paragraph(table);
```

### `dv.markdownList(values)`

Equivalent to `dv.list()`, which renders a list of the given elements, but returns plain Markdown.

```js
const markdown = dv.markdownList([1, 2, 3]);
dv.paragraph(markdown);
```

### `dv.markdownTaskList(tasks)`

Equivalent to `dv.taskList()`, which renders a task list, but returns plain Markdown.

```js
const markdown = dv.markdownTaskList(dv.pages("#project").file.tasks);
dv.paragraph(markdown);
```
 
## Utility

### `dv.array(value)`

Convert a given value or array into a Dataview [data array](data-array.md). If the value is already a data array, returns
it unchanged.

```js
dv.array([1, 2, 3]) => dataview data array [1, 2, 3]
```

### `dv.isArray(value)`

Returns true if the given value is an array or dataview array.

```js
dv.isArray(dv.array([1, 2, 3])) => true
dv.isArray([1, 2, 3]) => true
dv.isArray({ x: 1 }) => false
```

### `dv.fileLink(path, [embed?], [display-name])`

Converts a textual path into a Dataview `Link` object; you can optionally also specify if the link is embedded as well
as it's display name.

```js
dv.fileLink("2021-08-08") => link to file named "2021-08-08"
dv.fileLink("book/The Raisin", true) => embed link to "The Raisin"
dv.fileLink("Test", false, "Test File") => link to file "Test" with display name "Test File"
```

### `dv.sectionLink(path, section, [embed?], [display?])`

Converts a textual path + section name into a Dataview `Link` object; you can optionally also specify if the link is embedded and
it's display name.

```js
dv.sectionLink("Index", "Books") => [[Index#Books]]
dv.sectionLink("Index", "Books", false, "My Books") => [[Index#Books|My Books]]
```

### `dv.blockLink(path, blockId, [embed?], [display?])`

Converts a textual path + block ID into a Dataview `Link` object; you
can optionally also specify if the link is embedded and it's display name.

```js
dv.blockLink("Notes", "12gdhjg3") => [[Index#^12gdhjg3]]
```

### `dv.date(text)`

Coerce text and links to luxon `DateTime`; if provided with a `DateTime`, return it unchanged.

```js
dv.date("2021-08-08") => DateTime for August 8th, 2021
dv.date(dv.fileLink("2021-08-07")) => dateTime for August 8th, 2021
```

### `dv.duration(text)`

Coerce text to a luxon `Duration`; uses the same parsing rules as Dataview duration types.

```js
dv.duration("8 minutes") => Duration { 8 minutes }
dv.duration("9 hours, 2 minutes, 3 seconds") => Duration { 9 hours, 2 minutes, 3 seconds }
```

### `dv.compare(a, b)`

Compare two arbitrary JavaScript values according to dataview's default comparison rules; useful if you are writing a
custom comparator and want to fall back to the default behavior. Returns a negative value if `a < b`, 0 if `a = b`, and
a positive value if `a > b`.

```js
dv.compare(1, 2) = -1
dv.compare("yes", "no") = 1
dv.compare({ what: 0 }, { what: 0 }) = 0
```

### `dv.equal(a, b)`

Compare two arbitrary JavaScript values and return true if they are equal according to Dataview's default comparison
rules.

```js
dv.equal(1, 2) = false
dv.equal(1, 1) = true
```

### `dv.clone(value)`

Deep clone any Dataview value, including dates, arrays, and links.

```js
dv.clone(1) = 1
dv.clone({ a: 1 }) = { a: 1 }
```

### `dv.parse(value)`

Parse an arbitrary string object into a complex Dataview type
(mainly supporting links, dates, and durations).

```js
dv.parse("[[A]]") = Link { path: A }
dv.parse("2020-08-14") = DateTime { 2020-08-14 }
dv.parse("9 seconds") = Duration { 9 seconds }
```

## File I/O

These utility methods are all contained in the `dv.io` sub-API, and are all *asynchronous* (marked by ⌛).

### ⌛ `dv.io.csv(path, [origin-file])`

Load a CSV from the given path (a link or string). Relative paths will be resolved relative to the optional origin file (defaulting to the current file if not provided). Return a dataview array, each element containing an object of the CSV values; if the file does not exist, return `undefined`.

```js
await dv.io.csv("hello.csv") => [{ column1: ..., column2: ...}, ...]
```

### ⌛ `dv.io.load(path, [origin-file])`

Load the contents of the given path (a link or string) asynchronously. Relative paths will be resolved relative to the
optional origin file (defaulting to the current file if not provided). Returns the string contents of the file, or
`undefined` if the file does not exist.

```js
await dv.io.load("File") => "# File\nThis is an example file..."
```

### `dv.io.normalize(path, [origin-file])`

Convert a relative link or path into an absolute path. If `origin-file` is provided, then the resolution is doing as if
you were resolving the link from that file; if not, the path is resolved relative to the current file.

```js
dv.io.normalize("Test") => "dataview/test/Test.md", if inside "dataview/test"
dv.io.normalize("Test", "dataview/test2/Index.md") => "dataview/test2/Test.md", irrespective of the current file
```

## Query Evaluation

### ⌛ `dv.query(source, [file, settings])`

Execute a Dataview query and return the results as a structured return.
The return type of this function varies by the query type being executed,
though will always be an object with a `type` denoting the return type. This version of `query` returns a result type - you may want `tryQuery`, which instead throws an error on failed query execution.

```javascript
await dv.query("LIST FROM #tag") =>
    { successful: true, value: { type: "list", values: [value1, value2, ...] } }

await dv.query(`TABLE WITHOUT ID file.name, value FROM "path"`) =>
    { successful: true, value: { type: "table", headers: ["file.name", "value"], values: [["A", 1], ["B", 2]] } }

await dv.query("TASK WHERE due") =>
    { successful: true, value: { type: "task", values: [task1, task2, ...] } }
```

`dv.query` accepts two additional, optional arguments:
1. `file`: The file path to resolve the query from (in case of references to `this`). Defaults to the current file.
2. `settings`: Execution settings for running the query. This is largely an advanced use case (where I recommend you
   directly check the API implementation to see all available options).

### ⌛ `dv.tryQuery(source, [file, settings])`

Exactly the same as `dv.query`, but more convenient in short scripts as
execution failures will be raised as JavaScript exceptions instead of a
result type.

### ⌛ `dv.queryMarkdown(source, [file], [settings])`

Equivalent to `dv.query()`, but returns rendered Markdown.

```js
await dv.queryMarkdown("LIST FROM #tag") =>
    { successful: true, value: { "- [[Page 1]]\n- [[Page 2]]" } }
```

### ⌛ `dv.tryQueryMarkdown(source, [file], [settings])`

Exactly the same as `dv.queryMarkdown()`, but throws an error on parse failure.

### `dv.tryEvaluate(expression, [context])`

Evaluate an arbitrary dataview expression (like `2 + 2` or `link("text")` or `x * 9`); throws an `Error` on parse or
evaluation failure. `this` is an always-available implicit variable which refers to the current file.

```js
dv.tryEvaluate("2 + 2") => 4
dv.tryEvaluate("x + 2", {x: 3}) => 5
dv.tryEvaluate("length(this.file.tasks)") => number of tasks in the current file
```

### `dv.evaluate(expression, [context])`

Evaluate an arbitrary dataview expression (like `2 + 2` or `link("text")` or `x * 9`), returning a `Result` object of
the result. You can unwrap the result type by checking `result.successful` (and then fetching either `result.value`
or `result.error`). If you want a simpler API that throws an error on a failed evaluation, use `dv.tryEvaluate`.

```js
dv.evaluate("2 + 2") => Successful { value: 4 }
dv.evaluate("2 +") => Failure { error: "Failed to parse ... " }
```
