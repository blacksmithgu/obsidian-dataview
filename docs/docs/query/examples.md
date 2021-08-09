---
sidebar_position: 5
---
# Examples

A small collection of simple usages of the dataview query language.

---

Show all games in the game folder, sorted by rating, with some metadata:

~~~
```dataview
TABLE time-played, length, rating FROM "games"
SORT rating DESC
```
~~~

![Game Example](/assets/game.png)

---

List games which are MOBAs or CRPGs.

~~~
```dataview
LIST FROM #game/moba or #game/crpg
```
~~~

![Game List](/assets/game-list.png)

---

List all tasks in un-completed projects:

~~~
```dataview
TASK FROM #projects/active
```
~~~

![Task List](/assets/project-task.png)

---

List all of the files in the `books` folder, sorted by the last time you modifed the file:

~~~
```dataview
TABLE file.mtime FROM "books"
SORT file.mtime DESC
```
~~~

---

List all files which have a date in their title (of the form `yyyy-mm-dd`), and list them by date order.

~~~
```dataview
LIST file.day WHERE file.day
SORT file.day DESC
```
~~~
