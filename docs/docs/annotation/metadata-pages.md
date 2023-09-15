# Metadata on Pages

You can add fields to a markdown page (a note) in three different ways - via Frontmatter, Inline fields and Implicit fields. Read more about the first two possibilities in ["how to add metadata"](./add-metadata.md).

## Implicit Fields

Dataview automatically adds a large amount of metadata to each page. These implicit and automatically added fields are collected under the field `file`. Following are available:

| Field Name | Data Type | Description |
| --------------------- | --------- | ----------- |
| `file.name` | Text | The file name as seen in Obsidians sidebar. |
| `file.folder` | Text | The path of the folder this file belongs to. |
| `file.path` | Text | The full file path, including the files name. |
| `file.ext` | Text | The extension of the file type; generally `md`. |
| `file.link` | Link | A link to the file. |
| `file.size` | Number | The size (in bytes) of the file. |
| `file.ctime` | Date with Time | The date that the file was created. |
| `file.cday` | Date | The date that the file was created. |
| `file.mtime` | Date with Time | The date that the file was last modified. |
| `file.mday` | Date | The date that the file was last modified. |
| `file.tags` | List | A list of all unique tags in the note. Subtags are broken down by each level, so `#Tag/1/A` will be stored in the list as `[#Tag, #Tag/1, #Tag/1/A]`. |
| `file.etags` | List | A list of all explicit tags in the note; unlike `file.tags`, does not break subtags down, i.e. `[#Tag/1/A]` |
| `file.inlinks` | List | A list of all incoming links to this file, meaning all files that contain a link to this file. |
| `file.outlinks` | List | A list of all outgoing links from this file, meaning all links the file contains. |
| `file.aliases` | List | A list of all aliases for the note as defined via the [YAML frontmatter](https://help.obsidian.md/How+to/Add+aliases+to+note). |
| `file.tasks` | List | A list of all tasks (I.e., `| [ ] some task`) in this file. |
| `file.lists` | List | A list of all list elements in the file (including tasks); these elements are effectively tasks and can be rendered in task views. |
| `file.frontmatter` | List | Contains the raw values of all frontmatter in form of `key | value` text values; mainly useful for checking raw frontmatter values or for dynamically listing frontmatter keys. |
| `file.day` | Date | Only available if the file has a date inside its file name (of form `yyyy-mm-dd` or `yyyymmdd`), or has a `Date` field/inline field. |
| `file.starred` | Boolean | If this file has been bookmarked via the Obsidian Core Plugin "Bookmarks". |

## Example page

This is a small Markdown page which includes both user-defined ways to add metadata:

```markdown
---
genre: "action"
reviewed: false
---
# Movie X
#movies

**Thoughts**:: It was decent.
**Rating**:: 6

[mood:: okay] | [length:: 2 hours]
```

In addition to the values you see here, the page has also all keys listed above available.

### Example Query

You can query part of the above information with following query, for example:

~~~yaml
```dataview
TABLE file.ctime, length, rating, reviewed
FROM #movies
```
~~~
