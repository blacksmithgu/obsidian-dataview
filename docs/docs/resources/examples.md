# Examples

A small collection of simple usages of the dataview query language.

---

Show all games in the games folder, sorted by rating, with some metadata:

=== "Query"
    ```sql
    TABLE
      time-played AS "Time Played",
      length AS "Length",
      rating AS "Rating"
    FROM "games"
    SORT rating DESC
    ```
=== "Output"
    |File|Time Played|Length|Rating|
    |-|-|-|-|
    |[Outer Wilds](#)|November 19th - 21st, 2020|15h|9.5|
    |[Minecraft](#)|All the time.|2000h|9.5|
    |[Pillars of Eternity 2](#)|August - October 2019|100h|9|

---

List games which are MOBAs or CRPGs.

=== "Query"
    ``` sql
    LIST FROM #games/mobas OR #games/crpg
    ```
=== "Output"
    - [League of Legends](#)
    - [Pillars of Eternity 2](#)

---

List all tasks in un-completed projects:

=== "Query"
    ``` sql
    TASK FROM "dataview"
    ```
=== "Output"
    [dataview/Project A](#)

    - [ ] I am a task.
    - [ ] I am another task.

    [dataview/Project A](#)

    - [ ] I could be a task, though who knows.
        - [X] Determine if this is a task.
    - [X] I'm a finished task.

---

List all of the files in the `books` folder, sorted by the last time you modified the file:

=== "Query"
    ```sql
    TABLE file.mtime AS "Last Modified"
    FROM "books"
    SORT file.mtime DESC
    ```
=== "Output"
    |File|Last Modified|
    |-|-|
    |[Atomic Habits](#)|11:06 PM - August 07, 2021|
    |[Can't Hurt Me](#)|10:58 PM - August 07, 2021|
    |[Deep Work](#)|10:52 PM - August 07, 2021|

---

List all files which have a date in their title (of the form `yyyy-mm-dd`), and list them by date order.

=== "Query"
    ```sql
    LIST file.day WHERE file.day
    SORT file.day DESC
    ```
=== "Output"
    - [2021-08-07](#): August 07, 2021
    - [2020-08-10](#): August 10, 2020
