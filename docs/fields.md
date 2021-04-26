# Fields

Fields are the general term for data associated with a markdown page.

1. Every front-matter entry is a field.
2. Inline fields using the syntax `Key:: Value`; inline fields follow the same parsing rules as front-matter fields.
3. Dataview provides several special fields ("implicit fields").

Fields have a value as well as a type, and can be combined into more complex fields via operators.

## Basic Fields

There are 7 basic field types, corresponding to different types of values:

- `number`: A number like `0` or `18` or `19.37`.
- `date`: A date and time in ISO8601 format - `yyyy-mm-ddThh:mm:ss`. Everything after the year and month is optional, so
  you can just write `yyyy-mm` or `yyyy-mm-dd` or `yyyy-mm-ddThh`. If you want to use a date in a query, use
  `date(<date>)` where `<date>` is either a date, `today`, `tomorrow`, `eom` (end of month), or `eoy` (end of year).
    - You can access date fields like 'years' and so on via dot-notation (i.e., `date(today).year`).
- `duration`: A length of time - can be added/subtracted from dates. Has the format `<number> years/months/.../seconds`,
  where the unit can be years, months, weeks, days, hours, minutes, or seconds. If you want to use a duration in a
  query, use `dur(<duration>)`.
    - You can access duration fields like 'years' and so on via dot-notation (i.e., `dur(<duration>).years`).
- `link`: An obsidian link (in the same format); you can use dot-notation to get fields in the linked file. For example,
  `[[2020-09-20]].file.ctime` would get the creation time of the `2020-09-20` note. Note that Obsidian does wierd things
  with links in front-matter (and does not update them on file renames); you should use Inline Fields for links where possible.
- `array`: A list of elements. Automatically created by YAML lists in the frontmatter; can manually be created using
  `list(elem1, elem2, ...)`.
- `object`: A mapping of name -> value. Automatically created from YAML objects. You can access elements inside an
  object using dot-notation or array notation (`object.field` or `object["field"]`).
- `string`: Generic fallback; if a field is not a more specific type, it is a string, which is just text. To use a
  string in a query, use quotes - so `"string"`.

## Keywords

You cannot use command words (like `LIMIT`, `GROUP`, `SORT`) in queries directly as variables, in order to avoid parsing
ambiguity. However, if you have fields with those names in frontmatter, you can still access them by referencing through
the `row` virtual object - i.e., `row.limit` will obtain the `limit` variable from the frontmatter.

## Implicit Fields

All files have the following implicit attributes:

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

- `file.day`: The date contained in the file title (a date).

## Inline Fields

If you prefer writing your data inline instead of in the YAML front-matter, you can do so via the syntax

```
Key:: Value
```

Dataview will automatically parse these fields and make them visible. The 'Key' can have typical markdown formatting (like bold, italics, and so on), as well as spaces and emoji. Such fields may be difficult to query; dataview also allows you to query such fields using an alternative, all-lowercase name where spaces are replaced with dashes ('-'). I.e., "This is a Field" would also be queryable as "this-is-a-field".

Values have the same format as values in YAML frontmatter; you can specify numbers, text, links, dates (YYYY-MM-DD),
datetimes (YYYY-MM-DDTHH:mm:ss), and durations (4 years, 3 months, 1 hour, etc). Lists/objects are not yet supported,
but will be in a future release. Values do not allow for computations (i.e., `3 + 1` is not a valid field); this will
likely also be added in a future release.

## Computed Fields

You can also have Dataview compute fields which are rendered inline in your document using the computed field syntax:

```
`= <expression>`
```

Where `expression` is any field or caculated field. You can get the current day as `= this.file.day`, for example; or
fetch a value from another file with `= [[Other File]].value`. The prefix does not have to be `=` - it can be configured
in the settings.

## Calculated Fields

You can add and subtract, multiply and divide, as well as compare fields. For example `"/" + file.name` is a computed
field, as is `(file.size / 1024) + 256`. The order of precedence follows typical programming language precedence:

1. Multiply and Divide ('*' and '/')
2. Add and Subtract ('+' and '-')
3. Comparisons ('<', '<=', '>', etc).
4. Boolean Operations ('and' and 'or')

## Functions

You can apply functions to fields as well; see [Functions](functions.md) for more details.
