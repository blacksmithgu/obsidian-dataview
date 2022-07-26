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
    If you want to embed metadata inside sentences, or multiple fields on the same line, you can use the bracket syntax:
    ```markdown
    I would rate this a [rating:: 9]! It was [mood:: acceptable].
    ```
    There is also the alternative parenthesis syntax, which is functionally similar to brackets but hides the key when
    rendered in Reader mode:
    ```markdown
    This will not show the (very long key:: key).
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

[mood:: okay] | [length:: 2 hours]
```

### Implicit Fields

Dataview automatically adds a large amount of metadata to each page:

- `file.name`: The file title (a string).
- `file.folder`: The path of the folder this file belongs to.
- `file.path`: The full file path (a string).
- `file.ext`: The extension of the file type; generally '.md' (a string).
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
- `file.lists`: An array of all list elements in the file (including tasks); these elements are effectively tasks and can be rendered in task views.
- `file.frontmatter`: Contains the raw values of all frontmatter; mainly useful for checking raw frontmatter values or
  for dynamically listing frontmatter keys.

If the file has a date inside its title (of form `yyyy-mm-dd` or `yyyymmdd`), or has a `Date` field/inline field, it also has the following attributes:

- `file.day`: An explicit date associated with the file.

If you use the Obsidian default "Starred Files" plugin, the following metadata is also available:

- `file.starred`: If this file has been starred by the "stars" Obsidian plugin.

---

## Tasks

You can also annotate your *tasks* (I.e., lines of the form `- [ ] blah blah blah`) with metadata using inline field syntax:

```markdown
- [ ] Hello, this is some [metadata:: value]!
- [X] I finished this on [completion::2021-08-15].
```

### Field Shorthands

For supporting "common use cases", Dataview understands a few shorthands for common data you may want to annotate task
with:

=== "Syntax"
    - Due Date: `🗓️YYYY-MM-DD`
    - Completed Date: `✅YYYY-MM-DD`
    - Created Date: `➕YYYY-MM-DD`
    - Start Date: `🛫YYYY-MM-DD`
    - Scheduled Date: `⏳YYYY-MM-DD`
=== "Example"
    - [ ] Do this saturday 🗓️2021-08-29.
    - [x] Completed last saturday ✅2021-08-22.
    - [ ] I made this on ➕1990-06-14.
    - [ ] Task I can start this weekend 🛫2021-08-29.
    - [x] Task I finished ahead of schedule ⏳2021-08-29 ✅2021-08-22.

Note that, if you do not like emojis, you can still annotate these fields textually (`[due:: ]`, `[created:: ]`,
`[completion:: ]`, `[start:: ]`, `[scheduled:: ]`).

### Implicit Fields

As with pages, Dataview adds a number of implicit fields to each task:

- Tasks inherit *all fields* from their parent page - so if you have a `rating` field in your page, you can also access
  it on your task.
- `status`: The completion status of this task, as determined by the character inside the `[ ]` brackets. Generally a
  space `" "` for incomplete tasks and an X `"X"` for complete tasks, but allows for plugins which support alternative
  task statuses.
- `checked`: Whether or not this task has been checked in any way (i.e., it's status is not incomplete/empty).
- `completed`: Whether or not this *specific* task has been completed; this does not consider the
  completion/non-completion of any child tasks. A task is explicitly considered "completed" if it has been marked with
  an 'X'.
- `fullyCompleted`: Whether or not this task and **all** of its subtasks are completed.
- `text`: The text of this task.
- `line`: The line this task shows up on.
- `lineCount`: The number of Markdown lines that this task takes up.
- `path`: The full path of the file this task is in.
- `section`: A link to the section this task is contained in.
- `tags`: Any tags inside of the text task.
- `outlinks`: Any links defined in this task.
- `link`: A link to the closest linkable block near this task; useful for making links which go to the task.
- `children`: Any subtasks or sublists of this task.
- `task`: If true, this is a task; otherwise, it is a regular list element.
- `completion`: The date a task was completed; set by `[completion:: ...]` or shorthand syntax.
- `due`: The date a task is due, if it has one. Set by `[due:: ...]` or shorthand syntax.
- `created`: The date a task was created; set by `[created:: ...]` or shorthand syntax.
- `start`: The date a task can be started; set by `[start:: ...]` or shorthand syntax.
- `scheduled`: The date a task is scheduled to work on; set by `[scheduled:: ...]` or shorthand syntax.
- `annotated`: True if the task has any custom annotations, and false otherwise.
- `parent`: The line number of the task above this task, if present; will be null if this is a root-level task.
- `blockId`: The block ID of this task / list element, if one has been defined with the `^blockId` syntax; otherwise null.

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
  `6hrs` or `2m` are accepted. You can specify multiple units using an optional comma separator: `6 hours, 4 minutes`
  or `6hr4min`.
    ```
    Example:: 7 hours
    Example:: 4min
    Example:: 16 days
    Example:: 9 years, 8 months, 4 days, 16 hours, 2 minutes
    Example:: 9 yrs 8 min
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
