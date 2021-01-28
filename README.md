# Obsidian Dataview

Like Notion Databases, but better. Provides several advanced views for viewing pages, objects, and other data in your vault.

## Views

Views are the core abstraction of Obsidian Dataviews (as the name might imply). They are conceptually similar to Obsidian embedded queries - you provide a query in a codeblock in the Editor view, and then obtain a nice rendered query result. See the query section below for an explanation

### List Views

The simplest view, which simply auto-generates a bullet list over a single field (or numbered list, if a 'sort' clause is provided).

~~~
```dataview
list file
from #game
where should-replay
```
~~~

### Table Views

The most generic and flexible view; renders an arbitary number of fields in a tabular view.

~~~
```dataview
table length, time-played, rating
from #game
where length > 80h
sort rating descending
```
~~~

## Queries

All dataviews take queries in order to determine what exactly to show. Queries use a line-based format, and have the general form:

~~~
```dataview
[list|table] field1, field2, ..., fieldN

from #tag, #tag2, -#tag3 ('-' excludes files with tag)

where field [>|>=|<|<=|=] [field2|literal value] (and field2 ...) (or field3...)

sort field [ascending|descending] (ascending is implied if not provided)
```
~~~

Sorting and filters (like 'where') are data type dependent (since comparing strings is different
than comparing numbers). They will infer the data-types automatically by default; you can force a datatype using the more complicated query syntax.

## Roadmap

A very long roadmap with lots of features (some big, some small). Not sorted in any particular priority order.

- [ ] **Better Queries**:
    - [ ] Select file title
    - [ ] Select creation time & last modify time
    - [ ] Select file length (in words, in bytes, etc).
    - [ ] Select from CSV (data is selected from CSV).
- [ ] **Query Filtering**:
    - [ ] Inferred data schema
        - [ ] Number
        - [ ] String
        - [ ] Date
        - [ ] Tag
        - [ ] Link
    - [ ] Simple '>', '<', '=' on numeric/string fields
    - [ ] 'Around' for date and numeric fields
    - [ ] 'today', 'next week', other date constants
- [.] **Views**:
    - [X] List View (a list with metadata)
    - [ ] Task View (collects tasks from entire vault)
        - [x] Collect tasks from whole vault
        - [ ] Check a task box and have it be checked in original file
    - [ ] Object View (create custom objects anywhere in a file & collect them into a list)
    - [ ] Calendar-based View (computed off of a date object, could be used for dailies)
    - [ ] Timeline View
    - [ ] Gallery View (primarily for images)
    - [ ] Heirarchical View (where some way of determining parent/child relationship is provided)
    - [ ] Embedded Graph View (?)
- [ ] **Better Views**:
    - [ ] Sort By
    - [ ] Show Hidden Properties
    - [ ] Live Updating View (when a new query match shows up)
    - [ ] Modal for auto-generating view codeblocks
- [ ] **Usability**:
    - [ ] Schema validation for objects (using a central `Schema.md` file probably)
