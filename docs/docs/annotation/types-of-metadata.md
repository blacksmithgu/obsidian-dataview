# Field Types

All fields in dataview have a *type*, which determines how dataview will render, sort, and operate on that field.
Read more about how to create fields and meta data on your pages and tasks on [metadata on pages](./metadata-pages.md) and [metadata on tasks](./metadata-tasks.md).

Dataview understands several distinct field types to cover common use cases:

- **Text**: The default catch-all. If a field doesn't match a more specific type, it is just plain text.
    ```markdown
    Example:: This is some normal text.
    ```
- **Number**: Numbers like '6' and '3.6'.
    ```markdown
    Example:: 6
    Example:: 2.4
    Example:: -80
    ```
- **Boolean**: true/false, as the programming concept.
    ```markdown
    Example:: true
    Example:: false
    ```
- **Date**: ISO8601 dates of the general form `YYYY-MM[-DDTHH:mm:ss.nnn+ZZ]`. Everything after the month is optional.
    ```markdown
    Example:: 2021-04-18
    Example:: 2021-04-18T04:19:35.000
    Example:: 2021-04-18T04:19:35.000+06:30
    ```
- **Duration**: Durations of the form `<time> <unit>`, like `6 hours` or `4 minutes`. Common english abbreviations like
  `6hrs` or `2m` are accepted. You can specify multiple units using an optional comma separator: `6 hours, 4 minutes`
  or `6hr4min`.
    ```markdown
    Example:: 7 hours
    Example:: 4min
    Example:: 16 days
    Example:: 9 years, 8 months, 4 days, 16 hours, 2 minutes
    Example:: 9 yrs 8 min
    ```
- **Link**: Plain Obsidian links like `[[Page]]` or `[[Page|Page Display]]`.
    - If you reference a link in frontmatter, you need to quote it, as so: `key: "[[Link]]"`. This is default Obsidian-supported behavior.
    ```markdown
    Example:: [[A Page]]
    Example:: [[Some Other Page|Render Text]]
    ```
- **List**: Lists of other dataview fields. In YAML, these are defined as normal YAML lists; for inline fields, they are
  just comma-separated lists.
    ```markdown
    Example:: 1, 2, 3
    Example:: "yes", "or", "no"
    ```
- **Object**: A map of name to dataview field. These can only be defined in YAML frontmatter, using the normal YAML
  object syntax:
  ```yaml
  field:
    value1: 1
    value2: 2
    ...
  ```
