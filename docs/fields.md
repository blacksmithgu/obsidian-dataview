# Fields

Fields are the general term for data associated with a markdown page - every YAML frontmatter entry is a field. Fields
have a value as well as a type, and can be combined into more complex fields via operators.

## Basic Fields

There are 7 basic field types, corresponding to different types of values:

- `number`: A number like `0` or `18` or `19.37`.
- `date`: A date and time in ISO8601 format - `yyyy-mm-ddThh:mm:ss`. Everything after the year and month is optional, so
  you can just write `yyyy-mm` or `yyyy-mm-dd` or `yyyy-mm-ddThh`. If you want to use a date in a query, use
  `date(<date>)` where `<date>` is either a date, `today`, `tommorow`, `eom` (end of month), or `eoy` (end of year).
    - You can access date fields like 'years' and so on via dot-notation (i.e., `date(today).year`).
- `duration`: A length of time - can be added/subtracted from dates. Has the format `<number> years/months/.../seconds`,
  where the unit can be years, months, weeks, days, hours, minutes, or seconds. If you want to use a duration in a
  query, use `dur(<duration>)`.
    - You can access duration fields like 'years' and so on via dot-notation (i.e., `dur(<duration>).years`).
- `link`: An obsidian link (in the same format); you can use dot-notation to get fields in the linked file. For example,
  `[[2020-09-20]].file.ctime` would get the creation time of the `2020-09-20` note.
- `array`: A list of elements. Automatically created by YAML lists in the frontmatter; can manually be created using
  `list(elem1, elem2, ...)`.
- `object`: A mapping of name -> value. Automatically created from YAML objects. You can access elements inside an
  object using dot-notation or array notation (`object.field` or `object["field"]`).
- `string`: Generic fallback; if a field is not a more specific type, it is a string, which is just text. To use a string in a query, use quotes - so `"string"`.

## Implicit Fields

All files have the following implicit attributes:

- `file.name`: The file title (a string).
- `file.path`: The full file path (a string).
- `file.link`: A link to the file (a link).
- `file.size`: The size (in bytes) of the file (a number).
- `file.ctime`: The date that the file was created (a date).
- `file.mtime`: The date that the file was last modified (a date).

If the file has a date inside it's title (of form `yyyy-mm-dd` or `yyyymmdd`), it also obtains the following attributes:

- `file.day`: The date contained in the file title (a date).

## Calculated Fields

You can add and subtract, multiply and divide, as well as compare fields. For example `"/" + file.name` is a computed
field, as is `(file.size / 1024) + 256`. The order of precedence follows typical programming language precedence:

1. Multiply and Divide ('*' and '/')
2. Add and Subtract ('+' and '-')
3. Comparisons ('<', '<=', '>', etc).
4. Boolean Operations ('and' and 'or')

## Functions

You can apply functions to fields as well; see [Functions](functions.md) for more details.