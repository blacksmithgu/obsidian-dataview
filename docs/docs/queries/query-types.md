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

## TABLE

The `TABLE` query types outputs page data as a tabular view. You can add zero to multiple meta data fields to your `TABLE` query by adding them as a **comma separated list**. You can not only use plain meta data fields as columns, but specify **calculations** as well. Optionally, you can specify a **table header** via the `AS <header>` syntax. Like all other query types, you can refine your result set for your query with [data commands](data-commands.md).

!!! summary "`TABLE` Query Type"
    `TABLE` queries render a tabular view of any number of meta data values or calculations. It is possible to specify column headers via `AS <header>`.

~~~
```dataview
TABLE
```
~~~

**Output**

| File (7) |
| ----- |
| [Classic Cheesecake](#) |
| [Git Basics](#) |
| [How to fix Git Cheatsheet](#) |
| [League of Legends](#) |
| [Pillars of Eternity 2](#) |
| [Stardew Valley](#) |
| [Dashboard](#) |

!!! hint "Changing the first column header name"
    You can change the name of the first column header (by default "File" or "Group") via the Dataview Settings under Table Settings -> Primary Column Name / Group Column Name.
    If you want to change the name only for one specific `TABLE` query, have a look at `TABLE WITHOUT ID`.

!!! info "Disabling Result count"
    The first column always shows the result count. If you do not want to get it displayed, you can use a CSS Snippet to hide it. Head over to the [FAQ](../resources/faq.md#how-can-i-hide-the-result-count-on-table-queries) for more info.

Of course, a `TABLE` is made for specifying one to multiple additional informations:  

~~~
```dataview
TABLE started, file.folder, file.etags
FROM #games
```
~~~

**Output**

| File (3) | started | file.folder | file.etags | 
| --- | --- | --- | --- |
| [League of Legends](#)  | 	May 16, 2021 | 	Games	 | - #games/moba  | 
| [Pillars of Eternity 2](#)  | 	April 21, 2022 | 	Games	 | - #games/crpg | 
| [Stardew Valley](#) | 	April 04, 2021 | 	Games/finished	 |  - #games/simulation | 

!!! hint "Implicit fields"
    Curious about `file.folder` and `file.etags`? Learn more about [implicit fields on pages](../annotation/metadata-pages.md).

### Custom Column Headers

You can specify **custom headings** for your columns by using the `AS` syntax:

~~~
```dataview
TABLE started, file.folder AS Path, file.etags AS "File Tags"
FROM #games
```
~~~

**Output**

| File (3) | started | Path | File Tags | 
| --- | --- | --- | --- |
| [League of Legends](#) | 	May 16, 2021 | 	Games	 | - #games/moba  | 
| [Pillars of Eternity 2](#)  | 	April 21, 2022 | 	Games	 | - #games/crpg | 
| [Stardew Valley](#) | 	April 04, 2021 | 	Games/finished	 |  - #games/simulation | 

!!! info "Custom headers with spaces"
    If you want to use a custom header with spaces, like `File Tags`, you need to wrap it into double quotes: `"File Tags"`. 

This is especially useful when you want to use **calculations or expressions as column values**:

~~~
```dataview
TABLE 
default(finished, date(today)) - started AS "Played for", 
file.folder AS Path, 
file.etags AS "File Tags"
FROM #games
```
~~~

**Output**

| File (3) | Played for | Path | File Tags | 
| --- | --- | --- | --- |
| [League of Legends](#) | 	1 years, 6 months, 1 weeks | 	Games	 | - #games/moba  | 
| [Pillars of Eternity 2](#)  | 	7 months, 2 days | 	Games	 | - #games/crpg | 
| [Stardew Valley](#) | 	4 months, 3 weeks, 3 days | 	Games/finished	 |  - #games/simulation | 

### TABLE WITHOUT ID

If you don't want the first column ("File" or "Group" by default), you can use `TABLE WITHOUT ID`. `TABLE WITHOUT ID` works the same as `TABLE`, but it does not output the file link or group name as a first column if you add additional information.

You can use this if you, for example, output another identifying value: 

~~~
```dataview
TABLE WITHOUT ID
steamid,
file.etags AS "File Tags"
FROM #games
```
~~~

**Output**

| steamid (3)  | File Tags | 
| --- | --- |
| 560130 |  - #games/crog  | 
| - |  - #games/moba | 
| 413150 |   - #games/simulation | 

Also, you can use `TABLE WITHOUT ID` if you want to **rename the first column for one specific query**.

~~~
```dataview
TABLE WITHOUT ID
file.link AS "Game",
file.etags AS "File Tags"
FROM #games
```
~~~

**Output**

| Game (3) | File Tags | 
| --- | --- |
| [League of Legends](#) |  - #games/moba  | 
| [Pillars of Eternity 2](#)  | - #games/crpg | 
| [Stardew Valley](#) |  - #games/simulation | 

!!! info "Renaming the first column in general"
    If you want to rename the first column in all cases, change the name in Dataviews settings under Table Settings.

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