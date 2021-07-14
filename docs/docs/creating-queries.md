---
sidebar_position: 3
---
# Creating Queries

Once you've added useful data to relevant pages, you'll want to actually display it somewhere or operate on it. Dataview
allows this through `dataview` code blocks and inline queries, where you can write queries/code and have them be dynamically executed and
displayed in the note preview. For writing such queries, you have three options:

1. The dataview [query language](/docs/query/queries) is a simplistic, SQL-like language for quickly creating views. It
   supports basic arithmetic and comparison operations, and is good for basic applications.
2. The query language also provides inline queries, which allow you to embed single values
   directly inside a page - for example, todays date via `= date(today)`, or a field from another page via `= [[Page]].value`.
3. The dataview [JavaScript API](/docs/api/intro) gives you the full power of JavaScript and provides a DSL for pulling
   Dataview data and executing queries, allowing you to create arbitrarily complex queries and views.
4. Similar to the query language, you can write JS inline queries, which let you embed a computed JS value directly. For
   example, `$= dv.current().file.mtime`.

The query language tends to lag in features compared to the JavaScript API, primarily since the JavaScript API lives
closer to the actual code; the counter-argument to this fact is that the query language is also more stable and is less
likely to break on major Dataview updates.

### Using the Query Language

You can create a query language dataview block in any note using the syntax:

~~~
```dataview
... query ...
```
~~~

The details of how to write a query are explained in the [query language documentation](/docs/query/queries); if you learn
better by example, take a look at the [query examples](/docs/query/examples).

### Using Inline Queries

You can use an inline query via the syntax

~~~
`= <query language expression>`
~~~

where the expression is written using the [query language expression language](/docs/query/expressions). You can
configure inline queries to use a different prefix (like `dv:` or `~`) in the Dataview settings.

### Using the JavaScript API

You can create a JS dataview block in any note using the syntax:

~~~
```dataviewjs
... js code ...
```
~~~

Inside of a JS dataview block, you have access to the full dataview API via the `dv` variable. For an explanation of
what you can do with it, see the [API documentation](/docs/api/code-reference), or the [API
examples](/docs/api/code-examples).

### Using JavaScript Inline Queries

You can use a JavaScript inline query via the syntax

~~~
`$= <js query language expression>`
~~~

You have access to the `dv` variable, as in `dataviewjs` codeblocks, and can make all of the same calls. The result
should be something which evaluates to a JavaScript value, which Dataview will automatically render appropriately.
