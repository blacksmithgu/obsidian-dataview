# Structure of a Query

Dataview provides [different ways](dql-js-inline.md) to create queries and the way you need to write a query differs for each.

This page provides information on how to write a **Dataview Query Language** (**DQL**) query. If you're interested in how to write Inline Queries, refer to the [inline section on DQL, JS and Inlines](dql-js-inline.md#inline-dql). You'll find more information about **Javascript Queries** on the [Codeblock Reference](../api/intro.md).


## Capability of DQL

**DQL** is a SQL like query language for creating different views or calculations on your data. It
supports:

- Choosing a **output format** of your output (the [Query Type](./query-types.md))
- Fetch pages **from a certain [source](../reference/sources.md)**, i.e. a tag, folder or link
- **Filtering pages** / data by simple operations on fields, like comparison, existence checks, and so on
- **Transforming fields** for displaying, i.e. with calculations or splitting up multi-value fields
- **Sorting** results based on fields
- **Grouping** results based on fields
- **Limiting** your result count

Let's have a look at how to use these possibilities. 




### Choose a Output Format

The final output appareance of a query is determined by its **Query Type**. There are four available:

1. **TABLE**: The traditional view type; one row per result, with several columns of field data.
2. **LIST**: A list of pages which match the query. You can output a single associated value for each page.
3. **TASK**: A list of tasks that match the given query.
4. **CALENDAR**: A calendar view displaying each hit via a dot on its referred date.

The Query Type is the **only mandatory command in a query**. Everything else is optional.

~~~
Lists all pages in your vault as a table with one column containing the page link
```dataview
TABLE
```

Lists all pages in your vault as a bullet point list
```dataview
LIST
```

Lists all tasks (completed or not) in your vault
```dataview
TASK
```

Renders a Calendar view where each page is represented as a dot on its creation date.
```dataview
CALENDAR file.cday
```
~~~

!!! info "Read more about the available types and how to use them [here](./query-types.md)."

### Choose your source

Additionally to the Query Types, you have several **Data Commands** available that help you restrict, refine, sort or group your query. One of these query commands is the **FROM** statement, which is a bit special.

!!! info "`FROM` determines which set of notes should be included in your query depending on given [sources](../../reference/sources)"

You can add **zero or one** `FROM` data command to your query, right after your Query Type. You cannot add multiple FROM statements and you cannot add it after other Data Commands.

`FROM` takes [sources](../../reference/sources) as argument and **restricts the pages your query will collect to the given sources**.

~~~
Lists all pages inside the folder Books and its sub folders
```dataview
LIST
FROM "Books"
```

Lists all pages that include the tag #status/open or #status/wip
```dataview
LIST
FROM #status/open OR #status/wip
```

Lists all pages that have either the tag #assignment and are inside folder "30 School" (or its sub folders), or are inside folder "30 School/32 Homeworks" and are linked on the page School Dashboard Current To Dos
```dataview
LIST
FROM (#assignment AND "30 School") OR ("30 School/32 Homeworks" AND outgoing([[School Dashboard Current To Dos]]))
```

~~~

### Filter, sort, group or limit results

Additionally to the Query Types and the **Data command** `FROM` that's explained above, you have several other **Data Commands** available that help you restrict, refine, sort or group your query. 

All data commands except the `FROM` command can be used multiple times in any order (as long as they come after the Query Type and `FROM`, if a `FROM` is used at all). They'll be excuted in the order they are written.

Available are:

1. **FROM** like explained [above](#choose-your-source).
2. **WHERE**: Filter notes based on information **inside** notes, the meta data fields.
3. **SORT**: Sorts your results depending on a field and a direction.
4. **GROUP BY**: Bundles up several results into one result row.
5. **LIMIT**: Limits the output of your query to the given (maximum) number.
6. **FLATTEN**: Splits up one result into multiple results based on a field or calculation.

~~~

Lists all pages that have a metadata field `due` and where `due` is smaller than today
```dataview
LIST
WHERE due AND due < date(today)
```

Lists the first 10 pages with the newest creation date and time, that have the tag #status/open
```dataview
LIST
FROM #status/open
SORT file.ctime DESC
LIMIT 10
```

Lists files that have the metadata field `contacts` and where `contacts` is a list (a multi value), as well as contain the page `Mr. L`. Sort after the length (count) of contacts and sort the contacts itself after the contact's age in ascending order.
```dataview
LIST rows.c
WHERE typeof(contacts) = "array" AND contains(contacts, [[Mr. L]])
SORT length(contacts)
FLATTEN contacts as c
SORT link(c).age ASC
GROUP BY file.link
```
~~~

!!! info "Find out more about available [data commands](./data-commands.md)."

## General Format of a Query

Every query, independend of the chosen Query Type, follows the same structure.

- exactly one **Query Type** with, depending on your Query type, zero, one or many [fields](../annotation/add-metadata.md) for displaying
- zero or one **FROM** data command with one to many [sources](../reference/sources.md)
- zero to many other **data commands** with one to many [expressions](../reference/expressions.md) and/or other infos depending on the data command 

!!! hint "Only the Query Type is mandatory."

The most minimalistic query looks like this:

~~~
```dataview
LIST
```
~~~

which will list **all files in your vault**. `TABLE` does the same in a different format, `TASK` does the same for all your tasks.

Abstractly speaking, a query conforms the following pattern:

~~~
```dataview
<QUERY-TYPE> <fields>
FROM <source>
<DATA COMMAND> <expression>
```
~~~

The concrete additional informations you can or have to give to Query Types or Data Commands vary. You can read more about them on the respective [Query Type](./query-types.md) and [Data Command](./data-commands.md) page. 

## Examples

Following some examples of valid query structures. More examples are available [here](../resources/examples.md).

~~~
```dataview
TASK
```
~~~

~~~
```dataview
TABLE recipe-type AS "type", portions, length
FROM #recipes
```
~~~

~~~
```dataview
LIST
FROM #assignments
WHERE status = "open"
```
~~~

~~~
```dataview
TABLE file.ctime, appointment.type, appointment.time, follow-ups
FROM "30 Protocols/32 Management"
WHERE follow-ups
SORT appointment.time
```
~~~

~~~
```dataview
TASK
WHERE !completed
SORT created DESC
LIMIT 10
GROUP BY file.link
SORT file.ctime ASC
```
~~~


~~~
```dataview
TABLE L.text AS "My lists"
FROM "dailys"
FLATTEN file.lists AS L
WHERE contains(L.author, "Surname")
```
~~~