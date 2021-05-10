# Obsidian Dataview

Treat your obsidian vault as a database which you can query from. Provides a fully-fledged query language for filtering, sorting, and extracting data from your pages. See the Examples section below for some quick examples, or the full [reference](https://blacksmithgu.github.io/obsidian-dataview/).

## Examples

Show all games in the game folder, sorted by rating, with some metadata:

~~~
```dataview
table time-played, length, rating
from "games"
sort rating desc
```
~~~

![Game Example](docs/static/images/game.png)

---

List games which are MOBAs or CRPGs.

~~~
```dataview
list from #game/moba or #game/crpg
```
~~~

![Game List](docs/static/images/game-list.png)

---

List all tasks in un-completed projects:

~~~
```dataview
task from #projects/active
```
~~~

![Task List](docs/static/images/project-task.png)

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
list where file.day
sort file.day desc
```
~~~

# Usage

**Note**: See the full documentation [here](https://blacksmithgu.github.io/obsidian-dataview/).

Dataview allows you to write queries over markdown files which can be filtered by folder, tag, and markdown YAML fields; it can then display the resulting data in various formats. All dataviews are embedded code blocks with the general form

~~~
```dataview
[list|table|task] field1, (field2 + field3) as myfield, ..., fieldN
from #tag or "folder" or [[link]] or outgoing([[link]])
where field [>|>=|<|<=|=|&|'|'] [field2|literal value] (and field2 ...) (or field3...)
sort field [ascending|descending|asc|desc] (ascending is implied if not provided)
```
~~~

The first word in a query is always the view type - currently, either:
- `list`, which just renders a list of files that pass the query filters.
- `table`, which renders files and any selected fields that pass the query filters.
- `task`, which renders all tasks from any files that pass the query filters.

You can query from either `#tags`, from `"folder"`, or from `[[link]]`. You can freely combine these filters into more complicated boolean expressions using `and` and `or`; if precedence is important, use parenthesis.

Fields can be any YAML front-matter field (currently, strings, numbers, ISO dates and durations are supported, with support for ratings, links, and intervals forthcoming), any custom defined field (using the `field as field2` syntax). You can obtain fields inside of YAML objects using the `.` operator - i.e., `Dates.Birthday` for example. Fields can also be functions of other fields - for example, `rating + offset`, is a valid field.

#### Field Specifics

All files have the following implicit attributes:

- `file.name`: The file title.
- `file.path`: The full file path.
- `file.size`: The size (in bytes) of the file.
- `file.ctime`: The date that the file was created.
- `file.mtime`: The date that the file was last modified.

If the file has a date inside its title (of form `yyyy-mm-dd`), it also obtains the following attributes:

- `file.day`: The date contained in the file title.

Additionally, all of the fields defined in the YAML front-matter are available for querying. You can query inside nested
objects using dot notation (so `dates.birthday` would get the `birthday` object inside the `dates` field). Fields can
have the following types:

- `number`: A number like `0` or `18` or `19.37`.
- `date`: A date and time in ISO8601 format - `yyyy-mm-ddThh:mm:ss`. Everything after the year and month is optional, so
  you can just write `yyyy-mm` or `yyyy-mm-dd` or `yyyy-mm-ddThh`. If you want to use a date in a query, use
  `date(<date>)` where `<date>` is either a date, `today`, `tomorrow`, `eom` (end of month), or `eoy` (end of year).
    - You can access date fields like 'years' and so on via dot-notation (i.e., `date(today).year`).
- `duration`: A length of time - can be added/subtracted from dates. Has the format `<number> years/months/.../seconds`,
  where the unit can be years, months, weeks, days, hours, minutes, or seconds. If you want to use a duration in a
  query, use `dur(<duration>)`.
    - You can access duration fields like 'years' and so on via dot-notation (i.e., `dur(<duration>).years`).
- `link`: An obsidian link (in the same format); you can use dot-notation to get fields in the linked file. For example,
  `[[2020-09-20]].file.ctime` would get the creation time of the `2020-09-20` note.
- `array`: A list of elements. Automatically created by YAML lists in the frontmatter; can manually be created using
  `list(elem1, elem2, ...)`.
- `object`: A mapping of name -> value. Automatically created from YAML objects. You can access elements inside an
  object using dot-notation or array notation (`object.field` or `object["field"]`).
- `string`: Generic fallback; if a field is not a more specific type, it is a string, which is just text. To use a string in a query, use quotes - so `"string"`.

# Roadmap

There is a lot of potential for a generic query system; here is the upcoming features (roughly sorted in order in which I'll work on them):

- [X] **Query/frontmatter date and duration support**
    - [X] Expose folder creation time and last modified time as date fields `file.ctime` and `file.mtime`.
    - [X] Expose daily note days as date field `file.day`.
    - [X] Add shorthands for some date constants - `today`, `tommorow`, `eom` (end-of-month), `som` (start-of-month).
- [ ] **Embedded Metadata, Embedded Queries**:
    - [ ] Embed shorthand queries using something like `dv: page.value`.
    - [ ] Embed metadata outside the YAML block using customizable notation.
    - [X] Add additional metadata about the current page (call it 'this') to ease templating support.
- [ ] **Improved query debuggability**:
    - [ ] Show query parse + execute time on views.
    - [ ] Show errors for every file that failed to be selected due to query syntax error.
    - [X] Improve parsimmon error reporting (possibly rewrite into custom recursive descent parser?)
    - [X] More parser tests.
- [ ] **More complex task queries**:
    - [ ] Filter on a per-task, rather than per-file basis.
    - [ ] Filter tasks by completion.
    - [ ] Include nearby context with tasks - the header they are under, the preceding paragraph, etc.
- [ ] **More query fields**:
    - [X] Select file title. See `file.name`.
    - [X] Select file length (in words, in bytes, etc). See `file.size`.
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
    - [ ] Hierarchical view
    - [ ] Object view (create custom objects anywhere in a file & collect them into a list)

# Contributing

Contributions via bug reports, bug fixes, documentation, and general improvements are always welcome. For more major
feature work, make an issue about the feature idea / reach out to me so we can judge feasibility and how best to
implement it.

# Support

Have you found the Dataview plugin helpful, and want to support it? I accept donations which go towards future development efforts.

[![paypal](https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif)](https://www.paypal.com/donate?business=Y9SKV24R5A8BQ&item_name=Open+source+software+development&currency_code=USD)
