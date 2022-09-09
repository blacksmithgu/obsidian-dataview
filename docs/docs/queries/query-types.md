# Query Types

TODO: add short explanation, maybe copy over from structure.md

## List Queries

Lists are the simplest view, and simply render a list of pages (or custom fields) which match the query.
To obtain a list of pages matching the query, simply use:

=== "Syntax"
    ```
    LIST FROM <source>
    ```
=== "Query"
    ``` sql
    LIST FROM #games/mobas OR #games/crpg
    ```
=== "Output"
    - [League of Legends](#)
    - [Pillars of Eternity 2](#)

You can render a single computed value in addition to each matching file, by adding an expression after `LIST`:

=== "Syntax"
    ```
    LIST <expression> FROM <source>
    ```
=== "Query"
    ``` sql
    LIST "File Path: " + file.path FROM "4. Archive"
    ```
=== "Output"
    - [2020-12-18 DN](#): File path: 4. Archive/Daily Notes/2020-12-18 DN.md
    - [2020-12-16 DN](#): File path: 4. Archive/Daily Notes/2020-12-16 DN.md
    - [2020-12-17 DN](#): File path: 4. Archive/Daily Notes/2020-12-17 DN.md
    - [2020-12-15 DN](#): File path: 4. Archive/Daily Notes/2020-12-15 DN.md

### LIST WITHOUT ID

If you don't want the file name / group key included in the list view, you can use `LIST WITHOUT ID`:

=== "Syntax"
    ```
    LIST WITHOUT ID <expression> FROM <source>
    ```
=== "Query"
    ```sql
    LIST WITHOUT ID file.path FROM "4. Archive"
    ```
=== "Output"
    - 4. Archive/Daily Notes/2020-12-18 DN.md
    - 4. Archive/Daily Notes/2020-12-16 DN.md
    - 4. Archive/Daily Notes/2020-12-17 DN.md
    - 4. Archive/Daily Notes/2020-12-15 DN.md

---

## Table Queries

Tables support tabular views of page data. You construct a table by giving a comma separated list of the YAML frontmatter fields you want to render, as so:

```
TABLE file.day, file.mtime FROM <source>
```

You can choose a heading name to render computed fields by using the `AS` syntax:

```
TABLE (file.mtime + dur(1 day)) AS next_mtime, ... FROM <source>
```

An example table query:

=== "Query"
    ``` sql
    TABLE
      time-played AS "Time Played",
      length AS "Length",
      rating AS "Rating"
    FROM #game
    SORT rating DESC
    ```

=== "Output"
    |File|Time Played|Length|Rating|
    |-|-|-|-|
    |[Outer Wilds](#)|November 19th - 21st, 2020|15h|9.5|
    |[Minecraft](#)|All the time.|2000h|9.5|
    |[Pillars of Eternity 2](#)|August - October 2019|100h|9|

### TABLE WITHOUT ID

If you don't want the default "File" or "Group" field in your output (either to replace it or because it is unneeded), you can use
`TABLE WITHOUT ID`:

=== "Query"
    ``` sql
    TABLE WITHOUT ID
      time-played AS "Time Played",
      length AS "Length",
      rating AS "Rating"
    FROM #game
    SORT rating DESC
    ```
=== "Output"
    |Time Played|Length|Rating|
    |-|-|-|
    |November 19th - 21st, 2020|15h|9.5|
    |All the time.|2000h|9.5|
    |August - October 2019|100h|9|

---

## Task Queries

Task views render all tasks whose pages match the given predicate.

=== "Syntax"
    ```
    TASK FROM <source>
    ```
=== "Query"
    ``` sql
    TASK FROM "dataview"
    ```
=== "Output"
    - [ ] I am a task.
    - [ ] I am another task.
    - [ ] I could be a task, though who knows.
        - [X] Determine if this is a task.
    - [X] I'm a finished task.

You can filter (`WHERE`), group (`GROUP BY`), sort (`SORT`) tasks in these queries as desired using typical dataview
statements:

=== "Syntax"
    ```
    TASK FROM <source>
    WHERE <predicate>
    ...
    ```
=== "Query"
    ```
    TASK FROM "dataview"
    WHERE !completed
    GROUP BY file.folder
    ```
=== "Output"
    Folder 1

    - [ ] I am a task.
    - [ ] I am another task.
    - [ ] I am yet another task in another file in the same folder.

    Folder 2

    - [ ] I could be a task, though who knows.

    Folder 3

    - [ ] What even is a task, anyway?

A common use case for tasks is to group them by their originating file:

=== "Syntax"
    ```
    TASK FROM <source>
    GROUP BY file.link
    ```
=== "Query"
    ``` sql
    TASK FROM "dataview"
    GROUP BY file.link
    ```
=== "Output"
    [dataview/Project A](#)

    - [ ] I am a task.
    - [ ] I am another task.

    [dataview/Project A](#)

    - [ ] I could be a task, though who knows.
        - [X] Determine if this is a task.
    - [X] I'm a finished task.

## Calendar Queries

Calendar views render all pages which match the query in a calendar view, using
the given date expression to chose which date to render a page on.

=== "Syntax"
    ```
    CALENDAR <date>
    FROM <source>
    ```
=== "Query"
    ``` sql
    CALENDAR file.mtime
    FROM "dataview"
    ```
=== "Output"
The output will be a calendar that displays a dot per file in the dataview
directory. The dot will be placed on the date that the file was modified on.