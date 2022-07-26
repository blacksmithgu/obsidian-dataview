# Expressions

Dataview query language *expressions* are anything that yields a value - all fields are expressions, as are literal
values (like `6`), as are computed values (like `field - 9`). For a very high level summary:

```
# Literals
1                   (number)
true/false          (boolean)
"text"              (text)
date(2021-04-18)    (date)
dur(1 day)          (duration)
[[Link]]            (link)
[1, 2, 3]           (list)
{ a: 1, b: 2 }      (object)

# Lambdas
(x1, x2) => ...     (lambda)

# References
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
a % b               (modulo / remainder of division)

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

### Literals

Constant values - things like `1` or `"hello"` or `date(som)` ("start of month"). There are literals for each data type
that dataview supports; you can see the reference above for examples of what each literal type looks like.

### Arithmetic

You can use standard arithmetic operators to combine fields: addition (`+`), subtraction (`-`), multiplication (`*`),
and division (`/`). For example `field1 + field2` is an expression which computes the sum of the two fields.

### Comparisons

You can compare most values using the various comparison operators: `<`, `>`, `<=`, `>=`, `=`, `!=`. This yields a
boolean true or false value which can be used in `WHERE` blocks in queries.

### Array/Object Indexing

You can retrieve data from arrays via the index operator `array[<index>]`, where `<index>` is any computed expression.
Arrays are 0-indexed, so the first element is index 0, the second element is index 1, and so on.
For example `list(1, 2, 3)[0] = 1`.

A similar notation style works for objects.
You can use `field["nestedfield"]` to reference fields inside an object or otherwise similarly nested.
For example, in the YAML defined below, we can reference `previous` via `episode_metadata["previous"]`.
```yaml
---
current_episode: "S01E03"
episode_metadata:
  previous: "S01E02"
  next: "S01E04"
---
```

You can also retrieve data from objects (which map text to data values) also using the index operator, where indexes are now strings/text instead of numbers.
You can also use the shorthand `object.<name>`, where `<name>` is the name of the value to retrieve.
For the previous frontmatter example, we could also use `episode_metadata.previous` to obtain the same value.

Index expressions also work on objects which have fields that are not directly supported by the query language.
A good example is `where`, since it is a keyword.
If your frontmatter/metadata contains a field `where`, you can reference it via the `row` syntax: `row["where"]`.
See the [note in the FAQ](faq.md#how-do-i-use-fields-with-the-same-name-as-keywords-like-from-where) and [the corresponding issue](https://github.com/blacksmithgu/obsidian-dataview/issues/1164) for further information.

### Function Calls

Dataview supports various functions for manipulating data, which are described in full in the [functions
documentation](../functions). They have the general syntax `function(arg1, arg2, ...)` - i.e., `lower("yes")` or
`regexmatch("text", ".+")`.

### Lambdas

Lambdas are advanced literals which let you define a function that takes some number of inputs, and produces an output.
They have the general form:

```
(arg1, arg2, arg3, ...) => <expression using args>
```

Lambdas are used in several advanced operators like `reduce` and `map` to allow for complex transformations of data. A
few examples:

```
(x, y) => x + y                 (sum x and y)
(x) => 2 * x                    (double x)
(value) => length(value) = 4    (return true if value is length 4)
```

---

## Type-specific Interactions & Values

Most dataview types have special interactions with operators, or have additional fields that can be retrieved using the
index operator.

### Dates

You can retrieve various components of a date via indexing: `date.year`, `date.month`, `date.day`, `date.hour`,
`date.minute`, `date.second`, `date.week`, `date.weekyear`. You can also add durations to dates to get new dates.

### Durations

Durations can be added to each other or to dates. You can retrieve various components of a duration via indexing:
`duration.years`, `duration.months`, `duration.days`, `duration.hours`, `duration.minutes`, `duration.seconds`.

### Links

You can "index through" a link to get values on the corresponding page. For example `[[Link]].value` would get the value
`value` from page `Link`.

!!! note "Link Indexing in Expressions"
    If your link is a field that you defined in an inline field or in front-matter, like `Key:: [[Link]]`, then you
    should index into it by just writing `Key.value`; Using `[[Key]].value` would look up the page literally called `Key`,
    which is probably not what you want!
