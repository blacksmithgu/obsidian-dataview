# Data Commands

The different commands that dataview queries can be made up of. Commands are
executed in order, and you can have duplicate commands (so multiple `WHERE`
blocks or multiple `GROUP BY` blocks, for example).

## FROM

The `FROM` statement determines what pages will initially be collected and passed onto the other commands for further
filtering. You can select from any [source](../reference/sources.md), which currently means by folder, by tag, or by incoming/outgoing links.

- **Tags**: To select from a tag (and all its subtags), use `FROM #tag`.
- **Folders**: To select from a folder (and all its subfolders), use `FROM "folder"`.
- **Single Files**: To select from a single file, use `FROM "path/to/file"`.
- **Links**: You can either select links TO a file, or all links FROM a file.
  - To obtain all pages which link TO `[[note]]`, use `FROM [[note]]`.
  - To obtain all pages which link FROM `[[note]]` (i.e., all the links in that file), use `FROM outgoing([[note]])`.

You can compose these filters in order to get more advanced sources using `and` and `or`.

- For example, `#tag and "folder"` will return all pages in `folder` and with `#tag`.
- `[[Food]] or [[Exercise]]` will give any pages which link to `[[Food]]` OR `[[Exercise]]`.

You can also "negate" sources to obtain anything that does NOT match a source using `-`:

- `-#tag` will exclude files which have the given tag.
- `#tag and -"folder"` will only include files tagged `#tag` which are NOT in `"folder"`.

## WHERE

Filter pages on fields. Only pages where the clause evaluates to `true` will be yielded.

```
WHERE <clause>
```

1. Obtain all files which were modified in the last 24 hours:

    ```sql
    LIST WHERE file.mtime >= date(today) - dur(1 day)
    ```

2. Find all projects which are not marked complete and are more than a month old:

    ```sql
    LIST FROM #projects
    WHERE !completed AND file.ctime <= date(today) - dur(1 month)
    ```

## SORT

Sorts all results by one or more fields.

```
SORT date [ASCENDING/DESCENDING/ASC/DESC]
```

You can also give multiple fields to sort by. Sorting will be done based on the first field. Then, if a tie occurs, the second field will be used to sort the tied fields. If there is still a tie, the third sort will resolve it, and so on.

```
SORT field1 [ASCENDING/DESCENDING/ASC/DESC], ..., fieldN [ASC/DESC]
```

## GROUP BY

Group all results on a field. Yields one row per unique field value, which has 2 properties: one corresponding to the field being grouped on, and a `rows` array field which contains all of the pages that matched.

```
GROUP BY field
GROUP BY (computed_field) AS name
```

In order to make working with the `rows` array easier, Dataview supports field "swizzling". If you want the field `test` from every object in the `rows` array, then `rows.test` will automatically fetch the `test` field from every object in `rows`, yielding a new array.
You can then apply aggregation operators like `sum()` or `flat()` over the resulting array.

## FLATTEN

Flatten an array in every row, yielding one result row per entry in the array.

```
FLATTEN field
FLATTEN (computed_field) AS name
```

For example, flatten the `authors` field in each literature note to give one row per author:

=== "Query"
    ```sql
    TABLE authors FROM #LiteratureNote
    FLATTEN authors
    ```
=== "Output"
    |File|authors|
    |-|-|
    |stegEnvironmentalPsychologyIntroduction2018 SN|Steg, L.|
    |stegEnvironmentalPsychologyIntroduction2018 SN|Van den Berg, A. E.|
    |stegEnvironmentalPsychologyIntroduction2018 SN|De Groot, J. I. M.|
    |Soap Dragons SN|Robert Lamb|
    |Soap Dragons SN|Joe McCormick|
    |smithPainAssaultSelf2007 SN|Jonathan A. Smith|
    |smithPainAssaultSelf2007 SN|Mike Osborn|

A good use of this would be when there is a deeply nested list that you want to use more easily.
For example, `file.lists` or `file.tasks`.
Note the simpler query though the end results are slightly different (grouped vs non-grouped).
You can use a `GROUP BY file.link` to achieve identical results but would need to use `rows.T.text` as described earlier.

```
table T.text as "Task Text"
from "Scratchpad"
flatten file.tasks as T
where T.text
```

```
table filter(file.tasks.text, (t) => t) as "Task Text"
from "Scratchpad"
where file.tasks.text
```

`FLATTEN` makes it easier to operate on nested lists since you can then use simpler where conditions on them as opposed to using functions like `map()` or `filter()`.

## LIMIT

Restrict the results to at most N values.

```
LIMIT 5
```

Commands are processed in the order they are written, so the following sorts the results *after* they have already been limited:

```
LIMIT 5
SORT date ASCENDING
```
