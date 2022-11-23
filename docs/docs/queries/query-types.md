# Query Types

The **Query Type** determines how the output of your dataview query looks like. It is the **first and only mandatory** specification you give to a dataview query. There are four available: `LIST`, `TABLE`, `TASK` and `CALENDAR`.

The Query Type also determine on which **information level** a query is executed.  `LIST`, `TABLE` and `CALENDAR` operate on **page level**, whereas `TASK` queries operate on `file.tasks` level. More on that on the `TASK` Query Type. 

You can combine **every Query Type with all available [Data Commands](data-commands.md)** to refine your result set. Read more about the interconnection between Query Types and Data Commands on [How to Use Dataview](../index.md#how-to-use-dataview) and the [structure page](structure.md).

!!! summary "Query Type"
    The Query Type determines the output format of a query. It's the only mandatory information for a query.

## LIST

`LIST` queries output a bullet point list consisting out of your file links or the group name, if you decided to [group](data-commands.md#group-by). You can specify up to **one additional information** to output alongside with your file or group information.

!!! summary "Query Type `LIST`"
    `LIST` outputs a bullet point list of page links or Group keys. You can specify one additional information to show for each result.

The most minimal LIST query outputs a bullet point list of all files in your vault:

~~~
```dataview 
LIST
```
~~~

**Output**


- [Classic Cheesecake](#)
- [Git Basics](#)
- [How to fix Git Cheatsheet](#)
- [League of Legends](#)
- [Pillars of Eternity 2](#)
- [Stardew Valley](#)
- [Dashboard](#)


but you can, of course, use [data commands](data-commands.md) to restrict which pages you want to have listed:

~~~
```dataview
LIST 
FROM #games/mobas OR #games/crpg
```
~~~

**Output**

- [League of Legends](#)
- [Pillars of Eternity 2](#)

### Output an additional information

To add a **additional information** to your query, specify it right after the `LIST` command and before possibly available data commands:

~~~
```dataview 
LIST file.folder
```
~~~

**Output**


- [Classic Cheesecake](#): Baking/Recipes
- [Git Basics](#): Coding
- [How to fix Git Cheatsheet](#): Coding/Cheatsheets
- [League of Legends](#): Games
- [Pillars of Eternity 2](#): Games
- [Stardew Valley](#): Games/finished
- [Dashboard](#): 

You can only add **one** additional information, not multiple. But you can **specify a computed value** instead of a plain meta data field, which can contain information of multiple fields:

~~~
```dataview 
LIST "File Path: " + file.folder + " _(created: " + file.cday + ")_"
FROM "Games"
```
~~~

**Output**

- [League of Legends](#): File Path: Games _(created: May 13, 2021)_
- [Pillars of Eternity 2](#): File Path: Games _(created: Februrary 02, 2022)_
- [Stardew Valley](#): File Path: Games/finished _(created: April 04, 2021)_

### Grouping

A **grouped list** shows their group keys, and only the group keys, by default:

~~~
```dataview 
LIST
GROUP BY type
```
~~~

**Output**

- game
- knowledge
- moc
- recipe
- summary

A common use-case on grouped `LIST` queries is to add the file links to the output by specifying them as the additional information:

~~~
```dataview 
LIST rows.file.link
GROUP BY type
```
~~~

- game:
    - [Stardew Valley](#)
    - [League of Legends](#)
    - [Pillars of Eternity 2](#)
- knowledge:
    - [Git Basics](#)
- moc:
    - [Dashboard](#)
- recipe:
    - [Classic Cheesecake](#)
- summary:
    - [How to fix Git Cheatsheet](#)

### LIST WITHOUT ID

If you don't want the file name or group key included in the list view, you can use `LIST WITHOUT ID`. `LIST WITHOUT ID` works the same as `LIST`, but it does not output the file link or group name if you add an additional information. 

~~~
```dataview
LIST WITHOUT ID
```
~~~

**Output**


- [Classic Cheesecake](#)
- [Git Basics](#)
- [How to fix Git Cheatsheet](#)
- [League of Legends](#)
- [Pillars of Eternity 2](#)
- [Stardew Valley](#)
- [Dashboard](#)

It's the same as `LIST`, because it does not contain an additional information!

~~~
```dataview
LIST WITHOUT ID type
```
~~~

**Output**

- moc
- recipe
- summary
- knowledge
- game
- game
- game

`LIST WITHOUT ID` can be handy if you want to output computed values, for example.

~~~
```dataview
LIST WITHOUT ID length(rows) + " pages of type " + key
GROUP BY type
```
~~~

**Output**

- 3 pages of type game
- 1 pages of type knowledge
- 1 pages of type moc
- 1 pages of type recipe
- 1 pages of type summary

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