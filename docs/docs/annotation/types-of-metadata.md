# Field Types

All fields in dataview have a **type**, which determines how dataview will render, sort, and operate on that field.
Read more about how to create fields on ["Adding metadata"](add-metadata.md) and which information you have automatically available on [metadata on pages](./metadata-pages.md) and [metadata on tasks and lists](./metadata-tasks.md).

## Why does the type matter?

Dataview provides [functions](../reference/functions.md) you can use to modify your metadata and allows you to write all sorts of complex queries. Specific functions need specific data types to work correctly. That means the data type of your field determines which functions you can use on these fields and how the functions behave. Furthermore, depending on the type, the output dataview renders can be different.

Most of the time you do not need to worry too much about the type of your fields, but if you want to perform calculations and other magical operations on your data, you should be aware of them.

!!! example "Different rendering based on type"
    If you have this file:
    ~~~yaml
    date1:: 2021-02-26T15:15
    date2:: 2021-04-17 18:00

    ```dataview
    TABLE date1, date2
    WHERE file = this.file
    ```
    ~~~

    You'll see the following output (depending on your Date + Time Format Setting for dataview): 

    | File (1) | date1 | date2 |
    | -------- | ----- | ----- |
    | Untitled 2 | 3:15 PM - February 26, 2021 | 2021-04-17 18:00 |

    `date1` is recognized as a **Date** while `date2` is a normal **Text** to dataview, that's why `date1` is parsed differently for you. Find out more on [Dates below](#date). 

## Available Field Types

Dataview knows several field types to cover common use cases.

### Text

The default catch-all. If a field doesn't match a more specific type, it is plain text.

```markdown
Example:: This is some normal text.
```

!!! hint "Multiline text"
    Multiline text as a value is only possible via YAML Frontmatter and the pipe operator:
    ```yaml
    ---
    poem: |
      Because I could not stop for Death,
      He kindly stopped for me;
      The carriage held but just ourselves
      And Immortality.
    author: "[[Emily Dickinson]]"
    title: "Because I could not stop for Death"
    ---
    ```
    For inline fields, a line break means the end of the value. 

### Number

Numbers like '6' and '3.6'.
```markdown
Example:: 6
Example:: 2.4
Example:: -80
```

In YAML Frontmatter, you write a number without surrounding quotes: 

```yaml
---
rating: 8
description: "A nice little horror movie"
---
```

### Boolean

Boolean only knows two values: true or false, as the programming concept.

```markdown
Example:: true
Example:: false
```

### Date

Text that matches the ISO8601 notation will be automatically transformed into a date object. [ISO8601](https://en.wikipedia.org/wiki/ISO_8601) follows the format `YYYY-MM[-DDTHH:mm:ss.nnn+ZZ]`. Everything after the month is optional.
    
```markdown
Example:: 2021-04 
Example:: 2021-04-18
Example:: 2021-04-18T04:19:35.000
Example:: 2021-04-18T04:19:35.000+06:30
```

When querying for these dates, you can access properties that give you a certain portion of your date back:

- field.year
- field.month
- field.weekyear
- field.week
- field.weekday
- field.day
- field.hour
- field.minute
- field.second
- field.millisecond

For example, if you're interested in which month your date lies, you can access it via `datefield.month`:

~~~markdown
birthday:: 2001-06-11

```dataview
LIST birthday
WHERE birthday.month = date(now).month
```
~~~

gives you back all birthdays happening this month. Curious about `date(now)`? Read more about it under [literals](../reference/literals.md#dates).

!!! info "Displaying of date objects"
    Dataview renders date objects in a human readable format, i.e. `3:15 PM - February 26, 2021`. You can adjust how this format looks like in Dataview's Setting under "General" with "Date Format" and "Date + Time Format". If you want to adjust the format in a specific query only, use the [dateformat function](../reference/functions.md#dateformatdatedatetime-string).

### Duration

Durations are text of the form `<time> <unit>`, like `6 hours` or `4 minutes`. Common English abbreviations like
  `6hrs` or `2m` are accepted. You can specify multiple units in one field, i.e. `6hr 4min`, optionally with comma separator: `6 hours, 4 minutes`

```markdown
Example:: 7 hours
Example:: 16days
Example:: 4min
Example:: 6hr7min
Example:: 9 years, 8 months, 4 days, 16 hours, 2 minutes
Example:: 9 yrs 8 min
```

Find the complete list of values that are recognized as a duration on [literals](../reference/literals.md#durations). 

!!! hint "Calculations with dates and durations"
    Date and Duration types are compatible with each other. This means you can, for example, add durations to a date to produce a new date:
    ~~~markdown
    departure:: 2022-10-07T15:15
    length of travel:: 1 day, 3 hours

    **Arrival**: `= this.departure + this.length-of-travel`
    ~~~

    and you get back a duration when calculating with dates:
    ~~~markdown
    release-date:: 2023-02-14T12:00
      
    `= this.release-date - date(now)` until release!!
    ~~~

    Curious about `date(now)`? Read more about it under [literals](../reference/literals.md#dates).

### Link

Obsidian links like `[[Page]]` or `[[Page|Page Display]]`.

```markdown
Example:: [[A Page]]
Example:: [[Some Other Page|Render Text]]
```

!!! info "Links in YAML Frontmatter"
    If you reference a link in frontmatter, you need to quote it, as so: `key: "[[Link]]"`. This is default Obsidian-supported behavior. Unquoted links lead to a invalid YAML frontmatter that cannot be parsed anymore. 
    ```yaml
    ---
    parent: "[[parentPage]]"
    ---
    ```
    Please be aware that this is only a link for dataview, but not for Obsidian anymore - that means it won't show up in the outgoing links, won't be displayed on graph view and won't be updated on i.e. a rename.

### List

Lists are multi-value fields. In YAML, these are defined as normal YAML lists: 
```yaml
---
key3: [one, two, three]
key4:
 - four
 - five
 - six
---
```

In inline fields, they are comma-separated lists values:

```markdown
Example1:: 1, 2, 3
Example2:: "yes", "or", "no"
```

Please be aware that in Inline fields, you need to wrap **text values into quotes** to be recognized as a list (see `Example2`). `yes, or, no` is recognized as plain text.

!!! info "Duplicated metadata keys in the same file lead to lists"
    If you're using a metadata key twice or more in the same note, dataview will collect all values and give you a list. For example
    ~~~markdown
    grocery:: flour
    [...]
    grocery:: soap

    ```dataview
    LIST grocery
    WHERE file = this.file
    ```
    ~~~
    will give you a **list** out of `flour` and `soap` back.

!!! hint "Arrays are lists"
    In some places of this documentation, you'll read the term "array". Array is the term for lists in Javascript - Lists and Arrays are the same. A function that needs an array as argument needs a list as argument.

### Object

Objects are a map of multiple fields under one parent field. These can only be defined in YAML frontmatter, using the YAML object syntax:
```yaml
---
obj:
  key1: "Val"
  key2: 3
  key3: 
    - "List1"
    - "List2"
    - "List3"
---
```

  In queries, you can then access these child values via `obj.key1` etc:

~~~markdown
```dataview
TABLE obj.key1, obj.key2, obj.key3
WHERE file = this.file
```
~~~
