# Structure of a Query

The dataview query language is a query language for creating views on your data. It
supports:

- Choosing a **format** of your output (the [Query Type](./query-types.md))
- Fetch pages **from a certain [source](../reference/sources.md)**, i.e. a tag, folder or link
- **Filtering pages** / data by simple operations on fields, like comparison, existence checks, and so on
- **Transforming fields** for displaying, i.e. with calculations or splitting up multi-value fields
- **Sorting** results based on fields
- **Grouping** results based on fields
- **Limiting** your result count

## Output Format

The format, the final output appareance of a query is determined by its **Query Type**. There are four available:

1. **TABLE**: The traditional view type; one row per result, with several columns of field data.
2. **LIST**: A list of pages which match the query. You can output a single associated value for each page.
3. **TASK**: A list of tasks that match the given query.
4. **CALENDAR**: A calendar view displaying each hit via a dot on its referred date.

The Query Type is the **only mandatory command in a query**. Everything else is optional.

!!! info "Read more about the available types and how to use them [here](./query-types.md)."

## Refining and adjusting results

Additionally to the Query Types, you have several **Data Commands** available that help you restrict, refine, sort or group your query. Available are:

1. **FROM**: Determines which set of notes should be included in your query depending on given [sources](../../reference/sources)
2. **WHERE**: Filter notes based on information **inside** notes, the meta data fields.
3. **SORT**: Sorts your results depending on a field and a direction.
4. **GROUP BY**: Bundles up several results into one result row.
5. **LIMIT**: Limits the output of your query to the given (maximum) number.
6. **FLATTEN**: Splits up one result into multiple results based on a field or calculation.

All data commands except the `FROM` command can be used multiple times. They'll be excuted in the order they are written.

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