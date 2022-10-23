# Metadata on tasks

Just like pages, you can also add **fields** on task level to bind it to a specific task as context. You can also annotate your *tasks* (I.e., lines of the form `- [ ] blah blah blah`) with metadata using [inline field syntax](add-metadata.md):

```markdown
- [ ] Hello, this is some [metadata:: value]!
- [X] I finished this on [completion::2021-08-15].
```

## Field Shorthands

For supporting "common use cases", Dataview understands a few shorthands for common data you may want to annotate task
with:

=== "Syntax"
    - Due Date: `🗓️YYYY-MM-DD`
    - Completed Date: `✅YYYY-MM-DD`
    - Created Date: `➕YYYY-MM-DD`
    - Start Date: `🛫YYYY-MM-DD`
    - Scheduled Date: `⏳YYYY-MM-DD`
=== "Example"
    - [ ] Due this saturday 🗓️2021-08-29
    - [x] Completed last saturday ✅2021-08-22
    - [ ] I made this on ➕1990-06-14
    - [ ] Task I can start this weekend 🛫2021-08-29
    - [x] Task I finished ahead of schedule ⏳2021-08-29 ✅2021-08-22

Note that, if you do not like emojis, you can still annotate these fields textually (`[due:: ]`, `[created:: ]`,
`[completion:: ]`, `[start:: ]`, `[scheduled:: ]`).

## Implicit Fields

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
- `completion`: The date a task was completed; set by `[completion:: ...]` or [shorthand syntax](#field-shorthands).
- `due`: The date a task is due, if it has one. Set by `[due:: ...]` or [shorthand syntax](#field-shorthands).
- `created`: The date a task was created; set by `[created:: ...]` or [shorthand syntax](#field-shorthands).
- `start`: The date a task can be started; set by `[start:: ...]` or [shorthand syntax](#field-shorthands).
- `scheduled`: The date a task is scheduled to work on; set by `[scheduled:: ...]` or [shorthand syntax](#field-shorthands).
- `annotated`: True if the task has any custom annotations, and false otherwise.
- `parent`: The line number of the task above this task, if present; will be null if this is a root-level task.
- `blockId`: The block ID of this task / list element, if one has been defined with the `^blockId` syntax; otherwise null.