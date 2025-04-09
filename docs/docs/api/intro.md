# Overview

The Dataview JavaScript API allows for executing arbitrary JavaScript with access to the dataview indices and query
engine, which is good for complex views or interop with other plugins. The API comes in two flavors: plugin facing, and
user facing (or 'inline API usage').

## Inline Access

You can create a "DataviewJS" block via:

~~~
```dataviewjs
dv.pages("#thing")...
```
~~~

Code executed in such codeblocks have access to the `dv` variable, which provides the entirety of the codeblock-relevant
dataview API (like `dv.table()`, `dv.pages()`, and so on). For more information, check out the [codeblock API
reference](code-reference.md).

## Disabling Automatic View Refresh Individually

This is especially useful when using Dataview to render diagrams that are static and do not change, yet allows for `Automatic view refreshing` to work as intended across the rest of your vault. Simply add `@dataviewjs-disable-refresh` anywhere as a comment within your codeblock to disable refreshing for that particular script.

~~~
```dataviewjs
// @dataviewjs-disable-refresh
await dv.view("diagram", 0)
```
~~~

## Plugin Access

You can access the Dataview Plugin API (from other plugins or the console) through `app.plugins.plugins.dataview.api`;
this API is similar to the codeblock reference, with slightly different arguments due to the lack of an implicit file
to execute the queries in. For more information, check out the [Plugin API reference](code-reference.md).
