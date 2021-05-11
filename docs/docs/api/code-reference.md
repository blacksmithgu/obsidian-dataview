---
sidebar_position: 3
---
# Codeblock Reference

Dataview JavaScript Codeblocks are created using the `dataviewjs` language specification for a codeblock:

~~~
```dataviewjs
dv.table([], ...)
```
~~~

The API is available through the implicitly provided `dv` (or `dataview`) variable, through which you can query for
information, render HTML, and configure the view.

## Query

### `dv.current()`

Get page information (via `dv.page()`) for the page the script is currently executing on.

### `dv.pages(source)`

Takes a single string argument, `source`, which is the same form as a [query language source](/docs/query/sources).
Returns a [data array](/docs/api/data-array) of page objects, which are plain objects with all of the page fields as
values.

```js
dv.pages("#books") => all pages with tag 'books'
dv.pages('"folder"') => all pages from folder "folder"
dv.pages("#yes or -#no") => all pages with tag #yes, or which DON'T have tag #no
```

### `dv.pagePaths(source)`

As with `dv.pages`, but just returns a [data array](/docs/api/data-array) of paths of pages that match the given source.

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
