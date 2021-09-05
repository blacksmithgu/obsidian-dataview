# Task Queries

This builds upon [foundational knowledge about queries](queries.md). Task functionality is under active development, [review this Github project](https://github.com/blacksmithgu/obsidian-dataview/projects/5) in order to request features or see progress.

Task querying augments foundational querying by rendering checklists and adding task-specific annotations. This enables:

* filtering on annotations, like a task's `completed` property
* filtering based on tags or task text
* grouping based on annotation
* updating task status
* jumping directly to tasks within their file

## Interaction
Dataview can mark tasks as complete. It has configurable settings:

* Annotate task with completedDate (no, only on complete, both complete and remove)
* Use shorthands for annotations (uses emoji rather than field names)

## Fields
Dataview automatically adds metadata to each task:

- `completed`: Whether the task has been checked `[x]` or `[X]`
- `fullyCompleted`: Whether or not this task and all of it's subtasks are completed. 
- `completedDate`: The date a task was completed. If not annotated, will default to file modified time
- `dueDate`: The date a task is due, if it has one.
- `createdDate`: The date a task was created. If not annotated, defaults to file creation time
- `text`: The text of this task. 
- `line`: The line this task shows up on. 
- `path`: The full path of the file. 
- `real`: If true, this is a real task; otherwise, it is a list element above/below a task. 
- `subtasks`: Any subtasks of this task.
- `hasInlineAnnotations`: If the task includes inline annotations using `::`

### Inheritance
Currently, tasks [only inherit createdDate and completedDate](https://github.com/blacksmithgu/obsidian-dataview/blob/master/src/query/engine.ts#L407-L412) from their note. `completedDate` is only inherited if the task is completed.

## Shorthand Annotation
To enable quick annotation, these shorthands map to fields:

- `🗓️YYYY-MM-DD`: `dueDate` 
- `✅YYYY-MM-DD`: `completedDate` 
- `➕YYYY-MM-DD`: `createdDate` 

Examples:

```
- [x] completed last saturday ✅2021-08-22
- [ ] do this saturday 🗓️2021-08-29
```

## Inline Annotation
Inline annotation functions differently within tasks. Because each task is constrained to a single line, annotations:

- follow the format `Key::Value`
- must not include spaces in keys or values. 

Examples:
```
- [x] completed last saturday completedDate::2021-08-22
- [ ] do this saturday dueDate::2021-08-29
- [ ] review finances with person::Julie 
```

## Task Queries

Task views render all tasks whose pages match the given predicate.

=== "Syntax"
    ```
    TASK FROM <source>
    ```
=== "Query"
    ``` sql
    TASK FROM "dataview"
    ```
=== "Output"
    [dataview/Project A](#)

    - [ ] I am a task.
    - [ ] I am another task.

    [dataview/Project A](#)

    - [ ] I could be a task, though who knows.
        - [X] Determine if this is a task.
    - [X] I'm a finished task.

### Examples
#### Due Today
<pre>
```dataview
task from "tasks" where
dueDate=date(today)
```
</pre>

### Completed On a Specific Day
<pre>
```dataview
task from "tasks" where
completed and
completedDate=date(2021-08-06)
```
</pre>

### Tasks with specific text
<pre>
```dataview
task 
where "@julie" in text
group by person
```
</pre>

### Group by arbitrary field
<pre>
```dataview
task from #follow-up 
where person
group by person
```
</pre>