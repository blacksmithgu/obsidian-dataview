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

### `dv.current()`

Get page information (via `dv.page()`) for the page the script is currently executing on.

### `dv.pages(source)`

Takes a single string argument, `source`, which is the same form as a [query language source](../../query/sources).
Returns a [data array](../data-array) of page objects, which are plain objects with all of the page fields as
values.

```js
dv.pages() => all pages in your vault
dv.pages("#books") => all pages with tag 'books'
dv.pages('"folder"') => all pages from folder "folder"
dv.pages("#yes or -#no") => all pages with tag #yes, or which DON'T have tag #no
```

### `dv.pagePaths(source)`

As with `dv.pages`, but just returns a [data array](../data-array) of paths of pages that match the given source.

```js
dv.pagePaths("#books") => the paths of pages with tag 'books'
```

### `dv.page(path)`

Maps a simple path to the full page object, which includes all of the pages fields. Automatically does link resolution,
and will figure out the extension automatically if not present.

```js
dv.page("Index") => The page object for /Index
dv.page("books/The Raisin.md") => The page object for /books/The Raisin.md
```

## Render

### `dv.el(text)`

Renders arbitrary text in the given html element.
```js
dv.el("b", "This is some bold text");
```

### `dv.header(level, text)`

Renders a header of level 1 - 6 with the given text.

```js
dv.header(1, "Big!");
dv.header(6, "Tiny");
```

### `dv.paragraph(text)`

Renders arbitrary text in a paragraph.

```js
dv.paragraph("This is some text");
```

### `dv.span(text)`

Renders arbitrary text in a span (no padding above/below, unlike a paragraph).

```js
dv.span("This is some text");
```

### `dv.view(path, input)`

Complex function which allows for custom views. Will attempt to load a JavaScript file at the given path, passing it
`dv` and `input` and allowing it to execute. This allows for you to re-use custom view code across multiple pages.

If you want to also include custom CSS in your view, you can instead pass a path to a folder containing `view.js` and
`view.css`; the CSS will be added to the view automatically.

```js
dv.view("views/custom", { arg1: ..., arg2: ... });
```

## Dataviews

### `dv.list(elements)`

Render a dataview list of elements; accepts both vanilla arrays and data arrays.

```js
dv.list([1, 2, 3]) => list of 1, 2, 3
dv.list(dv.pages().file.name) => list of all file names
dv.list(dv.pages().file.link) => list of all file links
dv.list(dv.pages("#book").where(p => p.rating > 7)) => list of all books with rating greater than 7
```

### `dv.taskList(tasks, groupByFile)`

Render a dataview list of `Task` objects, as obtained by `page.file.tasks`. Only the first argument is required; if the
second argument `groupByFile` is provided (and is true), then tasks will be grouped by the file they come from automatically.

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

Render a dataview table with the given list of headers and 2D array of elements.

```js
// Render a simple table of book info sorted by rating.
dv.table(["File", "Genre", "Time Read", "Rating"], dv.pages("#book")
    .sort(b => b.rating)
    .map(b => [b.file.link, b.genre, b["time-read"], b.rating]))
```

## Utility

### `dv.array(value)`

Convert a given value or array into a Dataview [data array](data-array). If the value is already a data array, returns
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

```
dv.fileLink()
```

### `dv.date(text)`

Coerces text and links to luxon `DateTime`; if provided with a `DateTime`, returns it unchanged.

```js
dv.date("2021-08-08") => DateTime for August 8th, 2021
dv.date(dv.fileLink("2021-08-07")) => dateTime for August 8th, 2021
```

### `dv.compare(a, b)`

Compare two arbitrary JavaScript values according to dataview's default comparison rules; useful if you are writing a
custom comparator and want to fall back to the default behavior. Returns a negative value if `a < b`, 0 if `a = b`, and
a positive value if `a > b`.

```
dv.compare(1, 2) = -1
dv.compare("yes", "no") = 1
dv.compare({ what: 0 }, { what: 0 }) = 0
```

### `dv.equal(a, b)`

Compare two arbitrary JavaScript values and return true if they are equal according to Dataview's default comparison
rules.

```
dv.equal(1, 2) = false
dv.equal(1, 1) = true
```

## File I/O

These utility methods are all contained in the `dv.io` sub-API, and are all *asynchronous* (marked by ⌛).

### ⌛ `dv.io.csv(path, [origin-file])`

Load a CSV from the given path (a link or string). Relative paths will be resolved relative to the optional origin file (defaulting
to the current file if not provided). Returns a dataview array, each element containing an object of the CSV values; if
the file does not exist, returns `undefined`.

```js
await dv.io.csv("hello.csv") => [{ column1: ..., column2: ...}, ...]
```

### ⌛ `dv.io.load(path, [origin-file])`

Load the contents of the given path (a link or string) asynchronously. Relative paths will bre resolved relative to the
optional origi nfile (defaulting to the current file if not provided). Returns the string contents of the file, or
`undefined` if the file does not exist.

```js
await dv.io.load("File") => "# File\nThis is an example file..."
```

### `dv.io.normalize(path, [origin-file])`

Converts a relative link or path into an absolute path. If `origin-file` is provided, then the resolution is doing as if
you were resolving the link from that file; if not, the path is resolved relative to the current file.

```js
dv.io.normalize("Test") => "dataview/test/Test.md", if inside "dataview/test"
dv.io.normalize("Test", "dataview/test2/Index.md") => "dataview/test2/Test.md", irrespective of the current file
```
