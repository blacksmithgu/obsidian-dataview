# Obsidian Dataview

Treat your obsidian vault as a database which you can query from. Provides several advanced views for viewing pages, objects, and other data in your vault. You can filter by folders and tags (or combinations of folders & tags) and by YAML front-matter fields; more functionality forthcoming.

## Examples

Show all games in the game folder, sorted by rating, with some metadata:

~~~
```dataview
table time-played, length, rating
from "games"
sort rating desc
```
~~~

![Game Example](images/game.png)

---

List games which are MOBAs or CRPGs.

~~~
```dataview
list from #game/moba or #game/crpg
```
~~~

![Game List](images/game-list.png)

---

List all tasks in un-completed projects:

~~~
```dataview
task from #projects/active
```
~~~

![Task List](images/project-task.png)

---

List all of the files in the `books` folder, sorted by the last time you modifed the file:

~~~
```dataview
table mtime from "books"
sort mtime desc
```
~~~

---

List all files which have a date in their title (of the form `yyyy-mm-dd`), and list them by date order.

~~~
```dataview
list from ""
where file.day
sort file.day desc
```
~~~

# Usage

Dataview allows you to write queries over markdown files which can be filtered by folder, tag, and markdown YAML fields; it can then display the resulting data in various formats. All dataviews are embedded code blocks with the general form

~~~
```dataview
[list|table|task] field1, (field2 + field3) as myfield, ..., fieldN
from #tag or "folder"
where field [>|>=|<|<=|=|&|'|'] [field2|literal value] (and field2 ...) (or field3...)
sort field [ascending|descending|asc|desc] (ascending is implied if not provided)
```
~~~

The first word in a query is always the view type - currently, either:
- `list`, which just renders a list of files that pass the query filters.
- `table`, which renders files and any selected fields that pass the query filters.
- `task`, which renders all tasks from any files that pass the query filters.

You can query from either `#tags`, or from `"folder"`. You can freely combine these filters into more
complicated boolean expressions using `and` and `or`; if precedence is importance, use parenthesis.

Fields can be any YAML front-matter field (currently, strings, numbers, ISO dates and durations are supported, with support for ratings, links, and intervals forthcoming), any custom defined field (using the `field as field2` syntax). You can obtain fields inside of YAML objects using the `.` operator - i.e., `Dates.Birthday` for example. Fields can also be functions of other fields - for example, `rating + offset`, is a valid field.

#### Field Specifics

All files have the following implicit attributes:

- `file.name`: The file title.
- `file.path`: The full file path.
- `file.size`: The size (in bytes) of the file.
- `file.ctime`: The date that the file was created.
- `file.mtime`: The date that the file was last modified.

If the file has a date inside it's title (of form `yyyy-mm-dd`), it also obtains the following attributes:

- `file.day`: The date contained in the file title.

Additionally, all of the fields defined in the YAML front-matter are available for querying. You can query inside nested objects using dot notation (so `dates.birthday` would get the `birthday` object inside the `dates` field). Fields can currently have four types:

- `number`: A number like `0` or `18` or `19.37`.
- `date`: A date and time in ISO8601 format - `yyyy-mm-ddThh:mm:ss`. Everything after the year and month is optional, so you can just write `yyyy-mm` or `yyyy-mm-dd` or `yyyy-mm-ddThh`. If you want to use a date in a query, use `date(<date>)` where `<date>` is either a date, `today`, or `tommorow`.
- `duration`: A length of time - can be added/subtracted from dates. Has the format `<number> years/months/.../seconds`, where the unit can be years, months, weeks, days, hours, minutes, or seconds. If you want to use a duration in a query, use `dur(<duration>)`.
- `string`: Generic fallback; if a field is not a more specific type, it is a string, which is just text. To use a string in a query, use quotes - so `"string"`.

## Roadmap

There is a lot of potential for a generic query system; here is the upcoming features (roughly sorted in order in which I'll work on them):

- [ ] **Query/frontmatter date and duration support**
    - [ ] Expose folder creation time and last modified time as date fields `ctime` and `mtime`.
    - [ ] Expose daily note days as date field `day`.
    - [ ] Add shorthands for various times - `today`, `tommorow`, `eom` (end-of-month), `som` (start-of-month).
- [ ] **Improved query debuggability**:
    - [ ] Show query parse + execute time on views.
    - [ ] Show errors for every file that failed to be selected due to query syntax error.
    - [ ] Improve parsimmon error reporting (possibly rewrite into custom recursive descent parser?)
    - [ ] More parser tests
- [ ] **More complex task queries**:
    - [ ] Filter on a per-task, rather than per-file basis.
    - [ ] Filter tasks by completion.
    - [ ] Include nearby context with tasks - the header they are under, the preceding paragraph, etc.
- [ ] **More query fields**:
    - [ ] Select file title
    - [ ] Select file length (in words, in bytes, etc).
    - [ ] Select from CSV (data is selected from CSV).
- [ ] **Responsive views**:
    - [ ] Allow automatic sorting by clicking on headers.
    - [ ] Allow automatic filtering with a right-click modal.
    - [ ] Add properties to query automatically via a '+' button.
    - [ ] A simple query builder modal? (Something like the vantage plugin for search)
    - [ ] Live Updating View (when a new query match shows up)
- [ ] **Usability**:
    - [ ] Schema validation for objects (using a central `Schema.md` file probably)
- [ ] **More dataviews**:
    - [ ] Calendar view
    - [ ] Timeline view
    - [ ] Gallery view (primarily for images)
    - [ ] Heirarchical view
    - [ ] Object view (create custom objects anywhere in a file & collect them into a list)
