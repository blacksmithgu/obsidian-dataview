# Pages

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

## Implicit Fields

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
