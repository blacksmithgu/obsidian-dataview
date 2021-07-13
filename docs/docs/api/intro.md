---
sidebar_position: 1
---
# Overview

The Dataview JavaScript API allows for executing arbitrary JavaScript with access to the dataview indices and query
engine, which is good for complex views or interop with other plugins. The API comes in two flavors: plugin facing, and
user facing (or 'inline API usage'). The plugin facing flavor is not currently available, so this document will focus on
the user facing queries, which is arbitrary JS that can be executed in markdown pages.

## JavaScript Codeblocks

You can create a Dataview JS block via:

~~~
```dataviewjs
<code>
```
~~~

Code executed in such codeblocks have access to the `dv` variable, which provides the entirety of the codeblock-relevant
dataview API (like `dv.table()`, `dv.pages()`, and so on). For more information, check out the [codeblock API
reference](/docs/api/code-reference).

## Plugin Access

You can access the Dataview Plugin API (from other plugins or the console) through `app.plugins.plugins.dataview.api`;
this API is similar to the codeblock reference, with slightly different arguments due to the lack of an implicit file
to execute the queries in. For more information, check out the [Plugin API reference](/docs/api/plugin/code-reference).
