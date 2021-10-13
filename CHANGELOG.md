# 0.4.13

Bugfix release which adds fancy rendering to inline-inline fields and includes a few bugfixes.

## Pretty Inline Fields

Inline fields of the form `[key:: value]` will now be rendered with fancy new HTML! By default, they are rendered with
both the key and value. You can only render the value using parenthesis instead: `(key:: value)`. You can disable
this feature in the configuration.

Full-line inline fields (that Dataview has supported for a long time) will gain similar rendering support soon; in the
meanwhile, give the new syntax a try!

### Task Linking

Tasks now render with a link to the page/section that they are defined in, making `GROUP BY` and custom task
editing easier to do:

- [ ] A Task. 🔗
- [ ] Another Task. 🔗
    - [ ] Some Random Subtask. 🔗

You can configure the symbol for the link or disable it alltogether.

### Improving DataviewJS Posture

I am currently actively looking into improving DataviewJS sandboxing and general security posture. As a first small step
in this, I have made DataviewJS opt-in instead of opt-out, and added a separate control for Inline DataviewJS. You may
need to re-enable it in your settings if you use it.

More improvements and better JavaScript sandboxing will follow.

---

# 0.4.12-hotfix1

Re-release of 0.4.12 that fixes an important indexing issue.

- Fix #505: Use `completion` instead of `completed` when setting task completion time.
- Fix #509: Add `startswith` / `endswith` string functions.
- Fix #488: Add `padleft` and `padright`, and `string`.
- Fix #506, #512: Fix date comparisons due to a bizarre date zone issue.

---

# 0.4.12

Bugfix release following up 0.4.11 which includes a few minor function additions.

- Fix #512: Strange zone issue causing dates to not be equal.
- Fix #506: Same as #512.
- Fix #488: Add `padleft` / `padright` functions.
- Fix #509: Add `startswith` and `endswith` functions.
- Fix #505: Correctly read completion dates for tasks from `completion`.

This release also includes improved testing thanks to mocking Obsidian plugin APIs!

---

# 0.4.11

Fixes task behavior and adds "truly inline" fields!

## Improved Task Behavior

Task queries are now much improved from their primitive foundations - you can now filter, sort, and group them! The FROM
block is still page-based, sadly, though you can simply use `WHERE` instead if desired. For example, you can now access
task fields like `text`, `line`, or `completed`:

```
TASK WHERE contains(text, "#tag")
WHERE !completed
GROUP BY file.folder
```

The full list of all available task metadata can be found
[here](https://blacksmithgu.github.io/obsidian-dataview/data-annotation/#tasks); tasks include all the information
needed to uniquely identify them, and automatically inherit all of the metadata from their parent file as well (so you
can access `file.name`, for example). You can also annotate tasks with inline fields, as described in the section below.

There is some additional UX work to be done - primarily on more easily allowing you to navigate to where the task is
defined, as well as render tasks in views other than the `TASK` view.  The semantics of how grouping works (to make it
more intuitive/useful than it currently is) will likely also be revisited.

## Inline Inline Fields

Early support for truly inline fields have been added, where you can add metadata in the middle of a sentence. It looks
similar to existing inline field syntax, but with brackets or parenthesis:

```
I would rate this a [rating:: 6]. It was (thoughts:: acceptable).
```

Improved rendering for all inline fields is coming in an unpcoming update to improve the visual look of these inline
fields.


## Issues

- Fix #496: Fix task `SORT` functionality to do something.
- Fix #492: Tasks now properly annotated with parent file information.
- Fix #498: Fix task checking/unchecking logic (which broke due to a change in the task regex...).

---

# Initial

Start of the automatic changelog.
