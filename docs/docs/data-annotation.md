# Data Annotation

Dataview is a data index first and foremost, so it supports relatively rich ways of adding metadata to your knowledge
base. Dataview tracks information at the *markdown page* and *markdown task* levels, where each page/task can have an
arbitrary amount of complex (numbers, objects, lists) *fields* associated with it. Each *field* is a named value with
a certain type (like "number" or "text").

---

## Pages

You can add fields to a markdown page in three different ways:

1. **Frontmatter**: Frontmatter is a common Markdown extension which allows for YAML metadata to be added to the top of
   a page. All YAML fields will be available as Dataview fields:
    ```yaml
    ---
    alias: "document"
    last-reviewed: 2021-08-17
    thoughts:
      rating: 8
      reviewable: false
    ---
    ```
2. **Inline Fields**: For those wanting a more natural-looking annotation, Dataview supports "inline" fields, which
   offer a simple `Key:: Value` syntax that you can embed directly in your file:
    ```markdown
    # Markdown Page

    Basic Field:: Value
    **Bold Field**:: Nice!
    ```

3. **Implicit**: Dataview annotates pages with a large amount of metadata automatically, like the day the file was
   created (`file.cday`), any associated dates (`file.day`), links in the file (`file.outlinks`), tags (`file.tags`),
   and so on.

A simple Markdown page which includes both user-defined ways to add metadata:

```markdown
---
duration: 4 hours
reviewed: false
---
# Movie X

**Thoughts**:: It was decent.
**Rating**:: 6
```

#### Implicit Fields

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
- `file.tags`: An array of all unique tags in the note. Subtags are broken down by each level, so `#Tag/1/A` will be stored in
  the array as `[#Tag, #Tag/1, #Tag/1/A]`.
- `file.etags`: An array of all explicit tags in the note; unlike `file.tags`, does not include subtags.
- `file.inlinks`: An array of all incoming links to this file.
- `file.outlinks`: An array of all outgoing links from this file.
- `file.aliases`: An array of all aliases for the note.
- `file.tasks`: An array of all tasks (I.e., `- [ ] blah blah blah`) in this file.

If the file has a date inside its title (of form `yyyy-mm-dd` or `yyyymmdd`), or has a `Date` field/inline field, it also has the following attributes:

- `file.day`: An explicit date associated with the file.

---

## Tasks

You can also annotate your *tasks* (I.e., lines of the form `- [ ] blah blah blah`) with metadata using inline field
syntax:

```markdown
- [ ] Hello, this is some [metadata:: value]!
- [X] I finished this on completed::2021-08-15.
```

#### Field Shorthands

For supporting "common use cases", Dataview understands a few shorthands for common data you may want to annotate task
with:

=== "Syntax"
    - Due Date: `🗓️YYYY-MM-DD`
    - Completed Date: `✅YYYY-MM-DD`
    - Created Date: `➕YYYY-MM-DD`
=== "Example"
    - [ ] Do this saturday 🗓️2021-08-29.
    - [x] Completed last saturday ✅2021-08-22.
    - [ ] I made this on ➕1990-06-14.

Note that, if you do not like emojis, you can still annotate these fields textually (`due::`, `created::`, `completed::`).

#### Implicit Fields

As with pages, Dataview adds a number of implicit fields to each task:

- Tasks inherit *all fields* from their parent page - so if you have a `rating` field in your page, you can also access
  it on your task.
- `completed`: Whether or not this *specific* task has been completed.
- `fullyCompleted`: Whether or not this task and **all** of its subtasks are completed.
- `text`: The text of this task.
- `line`: The line this task shows up on.
- `path`: The full path of the file.
- `subtasks`: Any subtasks of this task.
- `real`: If true, this is a real task; otherwise, it is a list element above/below a task.
- `completedDate` or `completed-date`: The date a task was completed. If not annotated, will default to file modified time.
- `dueDate` or `due-date` or `due`: The date a task is due, if it has one.
- `createdDate` or `created-date` or `created`: The date a task was created. If not annotated, defaults to file creation time.
- `hasInlineAnnotations` or `has-inline-annotations`: If the task includes inline annotations using `::`.

---

## Field Types

All fields in dataview have a *type*, which determines how dataview will render, sort, and operate on that field.
Dataview understands several distinct field types to cover common use cases:

- **Text**: The default catch-all. If a field doesn't match a more specific type, it is just plain text.
    ```
    Example:: This is some normal text.
    ```
- **Number**: Numbers like '6' and '3.6'.
    ```
    Example:: 6
    Example:: 2.4
    Example:: -80
    ```
- **Boolean**: true/false, as the programming concept.
    ```
    Example:: true
    Example:: false
    ```
- **Date**: ISO8601 dates of the general form `YYYY-MM[-DDTHH:mm:ss.nnn+ZZ]`. Everything after the month is optional.
    ```
    Example:: 2021-04-18
    Example:: 2021-04-18T04:19:35.000
    Example:: 2021-04-18T04:19:35.000+06:30
    ```
- **Duration**: Durations of the form `<time> <unit>`, like `6 hours` or `4 minutes`. Common english abbreviations like
  `6hrs` or `2m` are accepted.
    ```
    Example:: 7 hours
    Example:: 4min
    Example:: 16 days
    ```
- **Link**: Plain Obsidian links like `[[Page]]` or `[[Page|Page Display]]`.
    - If you reference a link in frontmatter, you need to quote it, as so: `key: "[[Link]]"`. This is default Obsidian-supported behavior.
    ```
    Example:: [[A Page]]
    Example:: [[Some Other Page|Render Text]]
    ```
- **List**: Lists of other dataview fields. In YAML, these are defined as normal YAML lists; for inline fields, they are
  just comma-separated lists.
    ```
    Example:: 1, 2, 3
    Example:: "yes", "or", "no"
    ```
- **Object**: A map of name to dataview field. These can only be defined in YAML frontmatter, using the normal YAML
  object syntax:
  ```
  field:
    value1: 1
    value2: 2
    ...
  ```
