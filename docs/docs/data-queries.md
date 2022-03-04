# Creating Queries

Once you've added useful data to relevant pages, you'll want to actually display it somewhere or operate on it. Dataview
allows this in four different ways, all of which are written in codeblocks directly in your Markdown and live-reloaded
when your vault changes.

## Dataview Query Language (DQL)

The dataview [query language](../query/queries.md) is a simplistic, SQL-like language for quickly creating views. It
supports basic arithmetic and comparison operations, and is good for basic applications. You create dataview queries
using `dataview`-annotated codeblocks:

~~~
```dataview
TABLE rating AS "Rating", summary AS "Summary" FROM #games
SORT rating DESC
```
~~~

The details of how to write a query are explained in the [query language documentation](../query/queries.md); if you learn
better by example, take a look at the [query examples](../query/examples.md).

## Inline DQL

The query language also provides inline queries, which allow you to embed single values
directly inside a page - for example, todays date via `= date(today)`, or a field from another page via `=
[[Page]].value`. You create inline queries using inline codeblocks:

~~~
`= this.file.name`
~~~

Inline DQL expressions are written using the [query language expression language](../query/expressions.md). You can
configure inline queries to use a different prefix (like `dv:` or `~`) in the Dataview settings.

## Dataview JS

The dataview [JavaScript API](../api/intro.md) gives you the full power of JavaScript and provides a DSL for pulling
Dataview data and executing queries, allowing you to create arbitrarily complex queries and views. Similar to the query
language, you create Dataview JS blocks via a `dataviewjs`-annotated codeblock:

~~~java
```dataviewjs
let pages = dv.pages("#books and -#books/finished").where(b => b.rating >= 7);
for (let group of pages.groupBy(b => b.genre)) {
   dv.header(group.key);
   dv.list(group.rows.file.name);
}
```
~~~

Inside of a JS dataview block, you have access to the full dataview API via the `dv` variable. For an explanation of
what you can do with it, see the [API documentation](../api/code-reference.md), or the [API
examples](../api/code-examples).

## Inline Dataview JS

Similar to the query language, you can write JS inline queries, which let you embed a computed JS value directly. You
create JS inline queries via inline code blocks:

```
`$= dv.current().file.mtime`
```

In inline DataviewJS, you have access to the `dv` variable, as in `dataviewjs` codeblocks, and can make all of the same calls. The result
should be something which evaluates to a JavaScript value, which Dataview will automatically render appropriately.
