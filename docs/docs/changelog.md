# 0.5.70 (Beta)

Still attempting to fix #2557, github is acting up.


---

# 0.5.69 (Beta)

Attempting to fix #2557, but uncertain to any side effects.


---

# 0.5.68

- Many fixes to the documentation
- #2318 & co: Various fixes related to _live preview_ rendering of lists
- New/documented functions for `unique()`, `display()`, `firstvalue()`
- Added DOM information related to standalone inline fields

This is the first release done by @holroy, so thanks to him for further developing of _Dataview_. Thank you also to all the people having contributed through PRs and issues.

---

# 0.5.67

Includes several documentation fixes and several community-contributed bug fixes.

- @reply2za: Fixed inline rendering in the reading view.
- @carlesalbasboix: Adds sum(), avg(), min(), and max() to data arrays.
- @mnaoumov: Adds code mirror configuration which code highlights dataviewjs!

---

# 0.5.66

Bugfix for version comparisons to fix some other plugins having broken interactions with Dataview.

---

# 0.5.65

A maintenance update which fixes some issues with rendering embeds in Dataviews and adds a few new functions.

- Adds the `hash()` function for generating consistent uniformly-distributed values given arbitrary inputs. Primarily useful for creating "random" views which remain consistent across page refreshes. Thanks to @holroy.
- Adds the `slice()` function for slicing arrays, similar to Javascript's `Array.slice`. Thanks to @holroy.
- Fixes several issues with rendering embeds inside dataviews. Thanks to @GottZ.
- Several documentation improvements around tasks - thanks to @holroy and @RaviOnline.

---

# 0.5.64

More bug fixes for inline field rendering.


---

# 0.5.63

- More bugfixes from @RyotaUshio for rendering Markdown paragraphs and other blocks in DataviewJS.

---

# 0.5.62

Several more inline field fixes from @RyotaUshio, including more configuration options, fixing inline fields being rendered inside codeblocks, and more. Thanks!

---

# 0.5.61

- @RyotaUshio: Fix several bugs related to the new inline field rendering, including source mode and fixing date formatting.

---

# 0.5.60

- @RyotaUshio: Add explicit rendering of inline fields in live preview. They are much more visually distinct now!
- @MarioRicalde: Adds `PluginApi#evaluateInline(expression, path)` to the plugin API, which evaluate expressions as if you were on the given page.

---

# 0.5.59

- Fix an issue with the plugin failing to run on iOS due to an esoteric regex issue.

---

# 0.5.58

- Negative durations will now be properly rendered.

---

# 0.5.57

Maintenance patch which bumps many internal dependency versions and which includes approximately ~20 community-contributed PRs which add some new functions, fix some Dataview interactions with properties, and more!

---

# Unreleased

- DQL: Adds new `durationformat(duration, string)` function.
- DQL: New math rounding functions, `trunc(number)`, `floor(number)`, `ceil(number)`.

# 0.5.56

- Includes some performance fixes on recent versions of Obsidian 1.3+ due to some API changes. Thanks @kometenstaub.
- Documentation cleanups and improvements by @mocsa, @protofarer, @seanlzx, and @somidad.
- Adds the new `flat(array)` method for flattening nested arrays, as well as parsing dates using arbitrary formats using
  `date(text, "format")`. Thanks @holroy!

---

# 0.5.55

- Durations are now internationalized using luxon's new internationalization support.
- Dataviews should now properly render inside Canvas and some other contexts. Thanks @GamerGirlandCo!

---

# 0.5.54

- Regular list items are now also clickable in task views, not just task lines! Thanks to @LilaRest.

---

# 0.5.53

- Fix some documentation issues causing docs to not be updated.

---

# 0.5.52

Substantial documentation improvements thanks to @s-blu and @AB1908!

- For people concerned about dataviewjs code execution from copy-pasting, @eyuelt has made it possible to change the
  dataviewjs codeblock prefix.
- @sohanglal has added some documentation for `task.visual` for changing the visual text of a task.
- @Chouffy and @Daryl-Horton have fixed some bad documentation links!
- @vrtmrz swapped the regex used for parsing tags to better match Obsidian's own parser.
- @alexfertel has added `regextest`, which allows for matching parts of a string instead of the whole thing.
- @iamrecursion has added more metadata to file links, so they now include section metadata. This may cause some slight
  visual changes in link views.

---

# 0.5.51 (Beta)

- Allow disabling regular Dataview inline queries via configuration option.

---

# 0.5.50 (Beta)

- Expose dataview EXPRESSION and QUERY parsing to the dataview npm plugin, so others can parse dataview ASTs.
- Fix documentation issue with `join`.

---

# 0.5.49 (Beta)

- Add the `average` function to compute averages of lists (`average([list of things])`).
- Added documentation for `average`, `min`, `max`, `minby`, and `maxby` functions.
- Fixed the broken `nonnull` function and documented it.

---

# 0.5.48 (Beta)

We're back to more regular beta releases while I trial out new functionality!

- Fixed broken list behavior for `dv.markdownTaskList`.
- @GamerGirlandCo: Better handling of block IDs when checking off tasks!
- @s-blu and @AB1908: Lots of big documentation upgrades! Nice!
- @leoccyao: More block ID task checking fixes. Should work after this one.
- Add expression/query parsing to the dataview NPM package.
- @charleshan: Fix a missing header level in the dataview `dv.header` example.

---

# 0.5.47

Improves `date + duration` behavior when either the date or duration are null.

---

# 0.5.46

- Fix #1412: Fix bad `file.cday` and `file.ctime` comparisons due to wrong timezone being set. Ugh.

---

# 0.5.45

- #1400: Properly use the group by field for the group name.
- Fix bad table highlighting in some themes.

---

# 0.5.44

- #1404: Fixed dates in non-local timezones parsing incorrectly.
- Fixed some build non-determinism issues.
- Swapped to pull requests for adding new functionality, and added some more internal tests.

---

# 0.5.43

- Fix #1366: Better handling of calendar emoji (used as due dates in tasks).

---

# 0.5.42

It's been over a month since the last release! Anyway, this release bundles several nice user-contributed features:

- @AB1908: Tag queries are now case insensitive.
- @AB1908: Shift-clicking a link/task to open in a new tab now works properly on Mac.
- @AB1908: Numerous documentation fixes for clarity and more examples.
- @AnnaKornfeldSimpson: Additional emoji shorthands for more task fields (finished, due).
- @ooker777: Documentation improvements for some DataviewJS functions, and the ability to use inline emoji for the
  completion tracking feature.
- @mt-krainski: Custom date formats for task completions.
- @gentlegiantJGC: Better support for nested inline fields (i.e., less crashy).

---

# 0.5.41

- Fix a bad regex doing escaping in markdown tables.
- Improve async documentation.

---

# 0.5.40

Adds some more documentation about the new markdown functionality.

---

# 0.5.39

- Fixed an issue where checking a task in a task view would check the wrong box visually.
- Added experimental plugin APIs for querying dataview directly as markdown, and converting dataview results to properly
  formatted markdown.

---

# 0.5.38

- Some minor documentation improvements.
- Fix an issue with inline fields rendering out of order. That was a weird bug.

---

# 0.5.37

Fixes inline field rendering to once again work for highlighting/links, as well as some other rendering quirks with
inline queries in codeblocks.

---

# 0.5.36

- Fix a bug when checking if an element is an HTMLElement.
- Properly include the nice improvements to the file count in tables and lists.

---

# 0.5.35

- Fix #1196, #1176: Re-enable HTML values. This was never a featured I advertised since it was just for some internal
  hackery, but it appears people just discovered it in DataviewJS queries.
- Improved initial time to popular queries that use `file.starred`.

---

# 0.5.34

- Fix #1174: Fix indexing with a variable.
- Fix an issue with the experimental calendar view.

---

# 0.5.33

- Fix a bug with inline views that was introduced in 0.5.32.

---

# 0.5.32

The Dataview API has been noticeably revamped - there are now approximately twice as many functions available on the
plugin API as there were before, and some additional utilities have been added to both the plugin and inline API. I
will be finishing up the associated new "extension" functionality shortly, which will allow:

1. For custom Dataview + DataviewJS functions to be added via plugins.
2. For custom renderable objects (progress bars, embedded task lists, embedded tables) to be added to any Dataview view via plugins.
3. For plugins to provide alternative behavior for some dataview functionality (such as integrating task plugins with
   the dataview task query).
   
As part of the API revamp, it is now possible to programmatically execute Dataview and DataviewJS queries - either for
using the existing Dataview query language in your own plugin, or for embedding dataview. The Dataview npm library also
now exposes many useful internal Dataview types, including the AST structure for all dataview queries.

I am hoping that cleaning up the Dataview API and making it much more extensible will allow for Dataview [to](to) integrate
much better with existing plugins, and to provide the full power of the in-memory index for plugins. I have been very
carefully watching index performance in recent weeks to ensure smooth frontend performance for anyone using the API
(with a goal of <10ms for most queries).

---

# 0.5.31

Tasks now have an `outlinks` list field which includes all links in the task; this can be used for finding tasks with
links in them.

---

# 0.5.30

- Added the `typeof(any)` function in Dataview, which obtains the type of any value for comparison:
```javascript
typeof("text") = "string"
typeof(1) = "number"
typeof([1, 2, 3]) = "array"
```

- Added the modulo operator (`%`) for doing integer division remainder. I.e., `14 % 2 = 0` and `14 % 3 = 2`.
- Fixed some minor spacing issues with lists in tables.

---

# 0.5.29

Fix another subtle incompatibility between 0.4.26 and 0.5.29 - if you frequently used empty inline fields (like
`Key::` with no value), the 0.5+ behavior is now the same as 0.4 behavior and will map such fields to null instead of an
empty string.

This may fix a broad variety of "subtly wrong" queries that you may have seen after the upgrade.

---

# 0.5.28

- Fix a bug with some more string concatenations and null handling.

---

# 0.5.27

More performance + correctness bugfixes.

- The parser has been made a little more robust to prevent major indexing issues (or at least recover from them
  quickly).
- Several new strange tag variants are now supported.
- Markdown links are now properly indexed again.

Some DataviewJS performance issues should be resolved now, especially for external plugins using Dataview. This fix
does involve a slight API break w.r.t. what types are wrapped into Dataview Arrays (which provide functions like
`.where()`). Generally, only Dataview-provided implicits are wrapped in data arrays now; frontmatter and inline fields
are always now regular JS arrays - use `dv.array()` to explicitly make a data array if you want the advanced querying.

---

# 0.5.26

More small bugfixes:

- Fix a few small link rendering issues.
- Tag extraction from tasks now handles punctuation properly.
- Upgrade luxon (which is embedded in DataviewJS) to 2.4.0.

---

# 0.5.25

- Fix #1147: Fix there being a `#null` tag for files with an empty `tag` or `tags` frontmatter.

---

# 0.5.24

Several bugfixes:

- Nulls are now sorted first rather than last; it's generally good practice to explicitly check for nulls in your
  queries to avoid strange behavior.
- Dataview now properly parses space-delimited tags (like `tags: abc def ghi`).
- Dataview now supports dropping the entire file cache in case of bugs.

---

# 0.5.23

- Fix #1140: Force API objects to be arrays if they are iterables.

---

# 0.5.22

- Fix #1135: Use 'x' instead of 'X' for checkboxes.

---

# 0.5.21

A long-overdue swap from the beta branch to the stable branch. The beta branch should not include any (intended) breaking
changes, and has some nice performance improvements that come along with it! Here are the major changes:

- Most views now use React and no longer flicker when updating; this is not the case yet for DataviewJS, which will be
  getting equivalent treatment in the future.
- Dataview now caches metadata, so Dataview loads are very fast after the first time you open your vault. Dataview still
  needs to visit every file when you update the plugin version, so that should be the only times you experience slower
  load times.
- A brand new task view backend and query which allows you to filter per-task, rather than per-page! Check the
  documentation for details, but this broadly means `WHERE` statements now use task properties instead of page
  properties.
- Some additional metadata is now available for use - `file.starred`, `file.lists`, and more metadata in
  `file.tasks`.

There have been some moderate documentation touch-ups to keep things up to date; I'm still working on a walkthrough for
common Dataview use cases. This review also includes about ~30-40 bugfixes; some new bugs may arise due to internal
changes, so please flag them if you encounter them.

---

# 0.5.20 (Beta)

Slight fix to hopefully improve some strange reported cases of bad indexing at startup.

---

# 0.5.19 (Beta)

Dataview now uses IndexedDB to cache file metadata, reducing startup time to virtually nothing if you've opened the
vault before; if you have a small vault (<1000 notes), you may notice a slight improvement, but large vaults and mobile
devices will notice a very significant performance improvement to "first valid paint". Some other performance parameters
have been tuned to hopefully make the default experience better.

A few small bugs related to rendering have also been squashed, including an issue with images being scaled wrongly.

---

# 0.5.18 (Beta)

- Tasks in task views now support alternative task status characters like '!' and '/'; thanks @ebullient.
- A few documentation nit fixes.
- Added `DataArray#sortInPlace` for a more efficient mutable sort for niche use cases.

---

# 0.5.17 (Beta)

- Improved behavior when clicking on tasks in the task view; will now properly scroll to the relevant line in long
  files!
- Fixed a bug with incorrect counts being displayed in task views.
- Added `tags` as a field available on task items, so you can now do things like `TASK WHERE contains(tags, "#tag")`.

---

# 0.5.16 (Beta)

Dataview now tracks initialization and will report when all files have been indexed in the console; you can
programmatically see this via `dataview:index-ready`, or by checking `api.index.initialized`.

---

# 0.5.15 (Beta)

- Add hover highlights to tables to make seeing rows a little easier.
- Tables and task lists now include counts of the number of results in the headers.
- Further improved task selection in the task view.

---

# 0.5.14 (Beta)

- Fix task highlighting when not grouping.
- Remove some spurious console logging.
- Slightly improve task highlighting behavior when clicking on a task.

---

# 0.5.13 (Beta)

Several smaller bugfixes!

- Fix #997: Use the group by field name in the table name.
- Prevent tons of errors if you incorrectly set the inline query prefix.

---

# 0.5.12 (Beta)

Improve error messages for queries somewhat and get rid of some ugly output.

---

# 0.5.11 (Beta)

Add detection of tasks inside of block quotes, as well as correctly implement automatic checking and unchecking of these
tasks.

---

# 0.5.10 (Beta)

Adds the `Dataview: Force Refresh Views` Command (accessible via the Ctrl+P command view) to force current views to
refresh immediately.

---

# 0.5.9 (Beta)

Another fix for due-date related emoji in tasks. I hate emoji.

---

# 0.5.8 (Beta)

Fix some issues with infinite loops of tasks due to bad Obsidian metadata (potentially due to being out of date?).

---

# 0.5.7 (Beta)

Fix issues with parsing '🗓️2021-08-29' due-date annotations on tasks, as well as an issue with properly extracting
due/completed/completed times for use in queries.

---

# 0.5.6 (Beta)

Proper release of 0.5.5 plus one additional small improvement:

- Add `duration * number` and `duration / number` operations for manipulation durations numerically.

---

# 0.5.5 (Beta)

More small features:

- Fix issues with task sorting not doing anything. Sort away!
- Table headers can now be arbitrary markdown. So you can put things like links in your headers: `TABLE (1 + 2) AS
  "[[File]]".
- You can now specify the size of an image embed by providing WxH in it's display property: `![[image.png|50x50]]`.

---

# 0.5.4 (Beta)

Improved image rendering for some link types, and adds the `embed(link)` and `embed(link, false)` options to convert
links to/from their embedded equivalents.

---

# 0.5.3 (Beta)

Iterative beta which adds a few nice QoL features and fixes some more bugs:

- Internally swapped to a React-based renderer; this should not have a noticeable perf or usability impact, but makes it
  easier for me to implement complex table/list behaviors.
- Naming your fields with `AS "Name"` is now optional; Dataview will infer the name from the expression automatically.
  For example, `TABLE 8 + 4, 3 + 6 FROM ...` is now a valid table expression, and the columns will be named `8 + 4` and
  `3 + 6` respectively.
- Some issues with array and object rendering were corrected.
- Error messages on empty dataview results were improved and now show up for all views.

Inline images are now rendered correctly in Dataview tables and lists - no more hacky `app://local/` shenanigans!

---

# 0.5.2 (Beta)

- Fix #971: Objects now work properly inside DataviewQL evaluation.

---

# 0.5.1 (Beta)

- Temporarily revert the new task metadata behavior: inline fields in sublists of tasks are added to the page, instead
  of the task. This behavior is not good, but is compatible with legacy usages of task metadata, which should not break
  some existing queries.
    - This behavior will be removed in the future behind a flag.
- Added the 'visual' field to tasks - if set, tasks render 'visual' instead of their regular text.
- Fixed `DataArray#mutate()`.

---

# 0.5.0 (Beta)

Re-release of broken release 0.4.23, now hopefully with fixes that make it work on (most) machines. I'll be doing beta
releases for a little while until I can confirm the new version is stable; use BRAT
(https://github.com/TfTHacker/obsidian42-brat) to easily track Dataview beta versions if you are interested in cutting
edge features.

---

# 0.4.25

Fix #867: Create a container div per taskList to allow for multiple task views.

---

# 0.4.24

Re-release of 0.4.23f since Obsidian does not automatically update between non-semver versions.

---

# 0.4.23f

Remove some code which attempted to make tag queries case-insensitive; I'll reimplement this more generally later (it
conflicts with existing queries which check tags via `contains(file.tags, "#Tag")` and similar).

---

# 0.4.23e

More task bugfixes / improvements, and a fix that caused task metadata to be duplicated.

---

# 0.4.23d

More inline field list parsing bug fixes. Hopefully we're back to a nice working order!

---

# 0.4.23c

Bugfix which adds support for '1)' style lists, as well as a very annoying null issue due to JavaScript being a very
sad, very sad language.

---

# 0.4.23b

Bugfix for bad inlink/outlink computations; links were not being normalized properly so reverse lookups were not
working.

---

# 0.4.23

The Task Update! This release reworks how dataview handles tasks and list items so that they should be much more
intuitive to use and interact with:

1. **Subtask Support**: Queries now search over all list items, instead of only over root elements. This should make
   task filtering much more usable, especially if you tend to put tasks under other list items or care specifically
   about subtasks.
2. **Multiline Support**: Dataview now understands multi-line tasks and renders/updates them correctly.
3. **Immediately Navigate to Task**: The new task view, aside from looking a little cleaner than previous views, now
   immediately navigates to the task in it's original file on click and selects it.
4. **Grouping Support**: For DataviewJS users, `dv.taskList` now supports grouping (as produced by `groupBy` and the new
   `groupIn`) natively.

For DataviewJS users, the task and list representation has changed: `file.tasks` (and the new `file.lists`) contain
every single task (including subtasks) in the file, instead of only the root elements. You can return to previous
behavior by filtering out tasks with a non-null parent - i.e., `file.tasks.where(task => !task.parent)`. `dv.taskList`
will intelligently deal with properly nesting and de-duplicating tasks, so just filter to the tasks you want to render and
the API will do the rest.

This release also includes general backend improvements as we prepare for live-editing in Dataview views, as well as
several community-contributed API improvements:

- `DataArray#groupIn`: For grouping already grouped data, you can now use `array.groupIn(v => ...)`, which will group
  the innermost (original) data in the array instead of the top level groups. This allows for more easily grouping
  recursively, such as `dv.pages().groupBy(page => page.file.folder).groupIn(page => page.title)` producing a grouping
  of folders, then page titles.
- `substring(string, start[, end])`: The last major missing string function is now available! Take slices of strings.
- Improved `dv.el()` and other HTML functions - thanks @vitaly.
- null and undefined entries sort at the end instead of the beginning by default; sorry to those whose code sorts wrong
  because of this, but it is a better default for most people's use cases.
- All links are now properly normalized to their full paths, fixing many link comparison edge cases in DataviewJS.

Documentation additions for the new task functionality will be coming out in the next few days. The next release 0.4.24
is currently targeting expanded `FROM` query support, basic table view improvements, and general exporting functionality
for Dataview. See you then!

---

# 0.4.22

The @pjeby update! This includes several performance improvements suggested by @pjeby to dramatically improve background
Dataview performance as well as reduce some memory pressure. It also includes some minor bug-fixes and preliminary
functionality:

- Target ES2018 for better Promise support
- Allow parsing shorthands in `dv.date()`.
- Add additional metadata to inline field rendering which can be styled.
- Cleanup events & workers on plugin uninstall, improving the Dataview uninstall/disable/reload experience.
- Add preliminary `CALENDAR` queries - rendering similar to the obsidian-calendar plugin, see the documentation!

Dataview should perform much better on startup and when you have lots of tabs open - thanks again to @pjeby.

---

# 0.4.21

Bugfix release which primarily fixes issues that Dataview had with the live preview mode in upcoming Obsidian versions;
Dataview live preview should now be functional. Also includes a number of smaller bugfixes.

- Fix #646: Add `date(yesterday)` to create a date 24 hours ago.
- Fix #618: Luxon is now available on the dataview API (`dv.luxon`).
- Fix #510: Add `dv.duration()` for parsing durations.
- Fix #647: All HTML functions in the DataviewJS API now return their rendered objects.
- Fix #652: Fix parsing of invalid dates.
- Fix #629: Fix block link parsing.
- Fix #601: Timezones are now rendered properly and parsed properly in Dataview dates.
- PR #637: Add `meta(link)` which allows you to access various metadata about a link itself.
- Various minor null safety fixes.
- Dataview now reports it's exact version and build time in logs.

---

# 0.4.20

Some feature work (mostly by other contributors) while I while away at section metadata. May also fix a few bugs!

- Fix #448: You can now use the "Task Completion Tracking" option to automatically add completion metadata to tasks
  which are checked/unchecked through Dataview. Thanks to @sheeley.
- Add a search bar to documentation. Thanks to @tzhou.
- Add new date expressions for the start of the week (`date(sow)`), and the end of the week (`date(eow)`). Thanks
  @Jeamee and @v_mujunma.

Small minor bugfix / security releases may follow in the near future; otherwise, the next major release will include
section and object metadata.

---

# 0.4.19

Bugfix release which corrects emoji parsing & localization issues.

- Add `DataArray#into`, which lets you index into objects without flattening.
- Renamed 'header' to 'section' in task metadata; 'header' will remain around for a few major releases to let people
  naturally migrate.
- Fix #487: You no longer need spaces around '*' in expressions.
- Fix #559: Fix unicode issues in variable canonicalization which was causing problems with non-Latin inline field
  keys.

## Duration Parsing

You can now include multiple units in durations: `dur(8 minutes, 4 seconds)` or `dur(2yr8mo12d)`. You can separate
durations by commas, or use the abbreviated syntax with/without spaces.

---

# 0.4.18

Bugfix release which fixes bad inline field highlighting if '[' and '(' are mixed on the same line in particular orders.

---

# 0.4.17

Minor feature release to patch up more implementation holes.

## Single File Queries

You can now query from a specific file (instead of just folders and tags) by specifying the full file path:

```
TASK FROM "dataview/Test"
...
```

This is primarily useful for task queries, but will soon be useful for section and object queries in the near future as
well.

## Better Inline Field Highlighting

The CSS for inline field highlighting has been fixed and some compatibility issues improved, so it should work on all
themes now instead of only a few.

## dv.el()

DataviewJS now has `dv.el()`, which is like existing functions like `dv.paragraph` and `dv.span` but can create any
HTML element type; for example:

```js
dv.el("b", "Text!");
dv.el("i", 18);
```

---

# 0.4.16

Small performance release which substantially reduces the impact Dataview has on vault loading times (by spreading out
file loading). The Dataview Index is now also eagerly initialized, so plugin consumers of the API can immediately start
using it instead of waiting for the `dataview:api-ready` event.

---

# 0.4.15

A simple fix for #537 which properly 'awaits' value rendering in `dv.view()`. Fixes issues with values rendering out of
order.

---

# 0.4.14

Small bugfix release.

- Fixes inline field evaluation when using the new fancy highlighting.
- You can now configure whether task links should show up at the beginning or end of the task (or just disable them)
  in the "Task Link Location" setting.
- Most setting updates will immediately be applied to existing Dataviews.

---

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

You can configure the symbol for the link or disable it altogether.

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

Improved rendering for all inline fields is coming in an upcoming update to improve the visual look of these inline
fields.


## Issues

- Fix #496: Fix task `SORT` functionality to do something.
- Fix #492: Tasks now properly annotated with parent file information.
- Fix #498: Fix task checking/unchecking logic (which broke due to a change in the task regex...).

---

# Initial

Start of the automatic changelog.
