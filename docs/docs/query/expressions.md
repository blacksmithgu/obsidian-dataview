---
sidebar_position: 2
---
# Expressions

Dataview query language *expressions* are anything that yields a value - all fields are expressions, as are literal
values (like `6`), as are computed values (like `field - 9`). For a very high level summary:

```
# General
field               (directly refer to a field)
simple-field        (refer to fields with spaces/punctuation in them like "Simple Field!")
a.b                 (if a is an object, retrieve field named 'b')
a[expr]             (if a is an object or array, retrieve field with name specified by expression 'expr')
f(a, b, ...)        (call a function called `f` on arguments a, b, ...)

# Arithmetic
a + b               (addition)
a - b               (subtraction)
a * b               (multiplication)
a / b               (division)

# Comparison
a > b               (check if a is greater than b)
a < b               (check if a is less than b)
a = b               (check if a equals b)
a != b              (check if a does not equal b)
a <= b              (check if a is less than or equal to b)
a >= b              (check if a is greater than or equal to b)

# Special Operations
[[Link]].value      (fetch `value` from page `Link`)
```

More detailed explanations of each follow.

## Expression Types

### Fields as Expressions

The simplest expression is one that just directly refers to a field. If you have a field called "field", then you can
refer to it directly by name - `field`. If the field name has spaces, punctuation, or other non-letter/number
characters, then you can refer to it using Dataview's simplified name, which is all lower case with spaces replaced with
"-". For example, `this is a field` becomes `this-is-a-field`; `Hello!` becomes `hello`, and so on.

### Arithmetic

You can use standard arithmetic operators to combine fields: addition (`+`), subtraction (`-`), multiplication (`*`),
and division (`/`). For example `field1 + field2` is an expression which computes the sum of the two fields.

### Comparisons

You can compare most values using the various comparison operators: `<`, `>`, `<=`, `>=`, `=`, `!=`. This yields a
boolean true or false value which can be used in `WHERE` blocks in queries.

### Array/Object Indexing

You can retrieve data from arrays via the index operator `array[<index>]`, where `<index>` is any computed expression.
Arrays are 0-indexed, so the first element is index 0, the second element is index 1, and so on.  For example `list(1,
2, 3)[0] = 1`.

You can retrieve data from objects (which map text to data values) also using the index operator, where indexes are now
strings/text instead of numbers. You can also use the shorthand `object.<name>`, where `<name>` is the name of the value
to retrieve. For example `object("yes", 1).yes = 1`.

### Function Calls

Dataview supports various functions for manipulating data, which are described in full in the [functions
documentation](functions). They have the general syntax `function(arg1, arg2, ...)` - i.e., `lower("yes")` or
`regexmatch("text", ".+")`.

---

## Type-specific Interactions & Values

Most dataview types have special interactions with operators, or have additional fields that can be retrieved using the
index operator.

### Dates

You can retrieve various components of a date via indexing: `date.year`, `date.month`, `date.day`, `date.hour`,
`date.minute`, `date.second`, `date.week`. You can also add durations to dates to get new dates.

### Durations

Durations can be added to each other or to dates. You can retrieve various components of a duration via indexing:
`duration.years`, `duration.months`, `duration.days`, `duration.hours`, `duration.minutes`, `duration.seconds`.

### Links

You can "index through" a link to get values on the corresponding page. For example `[[Link]].value` would get the value
`value` from page `Link`.