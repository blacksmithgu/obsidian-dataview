---
sidebar_position: 2
---

# Pages and Fields

The core data abstraction for dataview is the *page*, corresponding to a markdown page in your vault with associated
*fields*. A *field* is just a piece of arbitrary named data - text, dates, durations, links - which dataview
understands, can display prettily, and can filter on. Fields can be defined in three ways:

1. **Frontmatter**: All YAML frontmatter entries will automatically be converted into a dataview field.
2. **Inline Fields**: A line of the form `<Name>:: <Value>` will automatically be parsed by dataview as a field. Note
   that you can surround `<Name>` with standard Markdown formatting, which will be discarded.
3. **Implicit**: Dataview annotates pages with a large amount of metadata automatically, like the day the file was
   created, any associated dates, links in the file, tags, and so on.

An example page with associated fields created using both methods may be:

```
---
duration: 4 hours
reviewed: false
---
# Movie X

**Thoughts**:: It was decent.
**Rating**:: 6
```

### Field Types

Dataview understands several different field types:

- **Text**: The default catch-all. If a field doesn't match a more specific type, it is just plain text.
- **Number**: Numbers like '6' and '3.6'.
- **Boolean**: true/false, as the programming concept.
- **Date**: ISO8601 dates of the general form `YYYY-MM[-DDTHH:mm:ss]`. Everything after the month is optional.
- **Duration**: Durations of the form `<time> <unit>`, like `6 hours` or `4 minutes`. Common english abbreviations like
  `6hrs` or `2m` are accepted.
- **Link**: Plain Obsidian links like `[[Page]]` or `[[Page|Page Display]]`.
- **List**: Lists of other dataview fields. In YAML, these are defined as normal YAML lists; for inline fields, they are
  just comma-separated lists.
- **Object**: A map of name to dataview field. These can only be defined in YAML frontmatter, using the normal YAML
  object syntax:
  ```
  field:
    value1: 1
    value2: 2
    ...
  ```

The different field types are important for ensuring Dataview understands how to properly compare and sort values, and
enable different operations.

### Implicit Fields 

Dataview automatically adds a large amount of metadata to each page:

- `file.name`: The file title (a string).
- `file.folder`: The path of the folder this file belongs to.
- `file.path`: The full file path (a string).
- `file.link`: A link to the file (a link).
- `file.size`: The size (in bytes) of the file (a number).
- `file.ctime`: The date that the file was created (a date + time).
- `file.cday`: The date that the file was created (just a date).
- `file.mtime`: The date that the file was last modified (a date + time).
- `file.mday`: The date that the file was last modified (just a date).
- `file.tags`: An array of all tags in the note. Subtags are broken down by each level, so `#Tag/1/A` will be stored in
  the array as `[#Tag, #Tag/1, #Tag/1/A]`.
- `file.etags`: An array of all explicit tags in the note; unlike `file.tags`, does not include subtags.
- `file.inlinks`: An array of all incoming links to this file.
- `file.outlinks`: An array of all outgoing links from this file.
- `file.aliases`: An array of all aliases for the note.

If the file has a date inside its title (of form `yyyy-mm-dd` or `yyyymmdd`), or has a `Date` field/inline field, it also has the following attributes:

- `file.day`: An explicit date associated with the file.