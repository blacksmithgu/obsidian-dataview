# Metadata on Tasks and Lists

Just like pages, you can also add **fields** on list item and task level to bind it to a specific task as context. For this you need to use the [inline field syntax](../add-metadata/#inline-fields):

```markdown
- [ ] Hello, this is some [metadata:: value]!
- [X] I finished this on [completion:: 2021-08-15].
```

Tasks and list items are the same data wise, so all your bullet points have all the information described here available, too. 

## Field Shorthands

For supporting "common use cases", Dataview understands a few shorthands for some fields you may want to annotate task
with:

=== "Example"
    - [ ] Due this Saturday 🗓️2021-08-29
    - [x] Completed last Saturday ✅2021-08-22
    - [ ] I made this on ➕1990-06-14
    - [ ] Task I can start this weekend 🛫2021-08-29
    - [x] Task I finished ahead of schedule ⏳2021-08-29 ✅2021-08-22

There are two specifics to these emoji-shorthands. First, they omit the inline field syntax (no `[🗓️:: YYYY-MM-DD]` needed) and secondly, they map to a **textual** field name data-wise:

| Field name | Short hand syntax |
| ---------- | ----------------- |
| due | `🗓️YYYY-MM-DD` |
| completion |  `✅YYYY-MM-DD` |
| created | `➕YYYY-MM-DD` |
| start | `🛫YYYY-MM-DD` |
| scheduled | `⏳YYYY-MM-DD` |

This means if you want to query for all tasks that are completed 2021-08-22, you'll write: 

~~~markdown
```dataview
TASK
WHERE completion = date("2021-08-22")
```
~~~

Which will list both variants - shorthands and textual annotation:

```markdown
- [x] Completed last Saturday ✅2021-08-22
- [x] Some Done Task [completion:: 2021-08-22]
```

## Implicit Fields

As with pages, Dataview adds a number of implicit fields to each task or list item:

!!! info "Inheritance of Fields"
    Tasks inherit *all fields* from their parent page - so if you have a `rating` field in your page, you can also access it on your task in a `TASK` Query. 


| Field name | Data Type | Description |
| ---------- | --------- | ----------- |
| `status` |  Text | The completion status of this task, as determined by the character inside the `[ ]` brackets. Generally a space `" "` for incomplete tasks and a `"x"` for complete tasks, but allows for plugins which support alternative task statuses. |
| `checked` |  Boolean  | Whether or not this task status is empty, meaning it has a space in its `[ ]` brackets |
| `completed` |  Boolean  | Whether or not this *specific* task has been completed; this does not consider the completionnon-completion of any child tasks. A task is explicitly considered "completed" if it has been marked with an 'x'. If you use a custom status, i.e. `[-]`, `checked` will be true, whereas `completed` will be false. |
| `fullyCompleted` |  Boolean  | Whether or not this task and **all** of its subtasks are completed. |
| `text` |  Text  | The plain text of this task, including any metadata field annotations. |
| `visual` | Text | The text of this task, which is rendered by Dataview. It can be modified to render arbitary text. |
| `line` |  Number  | The line of the file this task shows up on. |
| `lineCount` |  Number  | The number of Markdown lines that this task takes up. |
| `path` |  Text  | The full path of the file this task is in. Equals to `file.path` for [pages](./metadata-pages.md) |
| `section` | Link |  link to the section this task is contained in. |
| `tags` | List  | Any tags inside of the text task. |
| `outlinks` | List |  Any links defined in this task. |
| `link` | Link  |  link to the closest linkable block near this task; useful for making links which go to the task. |
| `children` | List  | ny subtasks or sublists of this task. |
| `task` | Boolean  | If true, this is a task; otherwise, it is a regular list element. |
| `annotated` | Boolean  | True if the task text contains any metadata fields, false otherwise. |
| `parent` | Number |  The line number of the task above this task, if present; will be null if this is a root-level task. |
| `blockId` | Text | The block ID of this task / list element, if one has been defined with the `^blockId` syntax; otherwise null. |

With usage of the [shorthand syntax](#field-shorthands), following additional properties may be available:

- `completion`: The date a task was completed.
- `due`: The date a task is due, if it has one.
- `created`: The date a task was created.
- `start`: The date a task can be started.
- `scheduled`: The date a task is scheduled to work on.

### Access of Implicit Fields for List Items and Tasks

If you're using a [TASK](../queries/query-types.md#task-queries) Query, your tasks are the top level information and can be used without any prefix:

~~~markdown
```dataview
TASK
WHERE !fullyCompleted
```
~~~

On every other Query Type, you first need to access the implicit field `file.lists` or `file.tasks` to check for these list item specific implicit fields:

~~~markdown
```dataview
LIST
WHERE any(file.tasks, (t) => !t.fullyCompleted)
```
~~~

This'll give you back all file links that have unfinished tasks inside. We get back a list of tasks on page level and thus need to use a [list function](../reference/functions.md) to look at each element. 
