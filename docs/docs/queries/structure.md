# Structure of a Query

The dataview query language is a simple, structured, custom query language for quickly creating views on your data. It
supports:

- Fetching pages associated with tags, folders, links, and so on.
- Filtering pages / data by simple operations on fields, like comparison, existence checks, and so on.
- Sorting results based on fields.

The query language supports the following view types, described below:

1. **TABLE**: The traditional view type; one row per data point, with several columns of field data.
2. **LIST**: A list of pages which match the query. You can output a single associated value for each page.
3. **TASK**: A list of tasks whose pages match the given query.
4. **CALENDAR**: A calendar view displaying each hit via a dot on its reffered date

Read more about the available types [here](./query-types.md)

## General Format

The general format for queries is:

~~~
```dataview
TABLE|LIST|TASK <field> [AS "Column Name"], <field>, ..., <field> 
FROM <source>
WHERE <expression>
SORT <expression> [ASC/DESC]
... other data commands
```
~~~

Only the [**Query Type**](./query-types.md) (table/list/task/calendar) statement is required - if the "from" statement is omitted, the query runs for all files in
your vault. You can specify [data commands](./data-commands.md) like `WHERE` multiple times; they will run in the order they are written. 

The most basic example of a dataview query is:

~~~
```dataview
LIST
```
~~~

which will list **all files in your vault**. Find more examples [here](../reference/examples.md).