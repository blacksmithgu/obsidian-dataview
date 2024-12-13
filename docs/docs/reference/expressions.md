# Expressions

Dataview query language **expressions** are anything that yields a value:

- all [fields](../annotation/add-metadata.md)
- all [literals](./literals.md) 
- and computed values, like `field - 9` of [function calls](./functions.md). 

Basically, everything that is not a [Query Type](../queries/query-types.md), nor a [data command](../queries/data-commands.md) is an expression.

For a very high level summary, following is considered an **expression** in DQL:

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

# Strings

a + b               (string concatenation)
a * num             (repeat string <num> times)

# Special Operations
[[Link]].value      (fetch `value` from page `Link`)
```

More detailed explanations of each follow.

## Expression Types

### Fields as Expressions

The simplest expression is one that just directly refers to a field. If you have a field called "duedate", then you can
refer to it directly by name - `duedate`. 

~~~
```dataview
TABLE duedate, class, field-with-space
```
~~~

!!! info "Field names with spaces and punctuations"
    If the field name has spaces, punctuation, or other non-letter/number characters, then you can refer to it using Dataview's simplified name, which is all lower case with spaces replaced with "-". For example, `this is a field` becomes `this-is-a-field`; `Hello!` becomes `hello`, and so on. Read more under [Field names](../annotation/add-metadata.md#field-names)

### Literals

Constant values - things like `1` or `"hello"` or `date(som)` ("start of month"). There are literals for each data type
that dataview supports; read more about them [here](./literals.md).

~~~
```dataview
LIST
WHERE file.name = "Scribble"
```
~~~

### Arithmetic

You can use standard arithmetic operators to combine fields: addition (`+`), subtraction (`-`), multiplication (`*`),
and division (`/`). For example `field1 + field2` is an expression which computes the sum of the two fields.

~~~
```dataview
TABLE start, end, (end - start) - dur(8 h) AS "Overtime" 
FROM #work
```

```dataview
TABLE hrs / 24 AS "days"
FROM "30 Projects"
```
~~~

### Comparisons

You can compare most values using the various comparison operators: `<`, `>`, `<=`, `>=`, `=`, `!=`. This yields a
boolean true or false value which can be used in `WHERE` blocks in queries.

~~~
```dataview
LIST
FROM "Games"
WHERE price > 10
```

```dataview
TASK
WHERE due <= date(today)
```

```dataview
LIST
FROM #homework
WHERE status != "done"
```
~~~

!!! hint "Comparing different types"
    Comparing different [data types](../annotation/types-of-metadata.md) with each other can lead to unexpected results. Take the second example: If `due` is not set (neither on page nor task level), it is `null` and `null <= date(today)` returns true, including tasks without any due date. If this is not wanted, add a type check to make sure you're always comparing the same types:
    ~~~
    ```dataview
    TASK
    WHERE typeof(due) = "date" AND due <= date(today)
    ```
    ~~~
    Most often, it is sufficient to check if the meta data is available via `WHERE due AND due <= date(today)`, but checking the type is the safer way to get foreseeable results. 

### List/Object Indexing

You can retrieve data from [lists/arrays](../annotation/types-of-metadata.md#list) via the index operator `list[<index>]`, where `<index>` is any computed expression.
Lists are 0-indexed, so the first element is index 0, the second element is index 1, and so on.
For example `list("A", "B", "C")[0] = "A"`.

A similar notation style works for [objects](../annotation/types-of-metadata.md#object).
You can use `field["nestedfield"]` to reference fields inside an object or otherwise similarly nested.
For example, in the YAML defined below, we can reference `previous` via `episode_metadata["previous"]`.
```yaml
---
aliases:
  - "ABC"
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
See the [note in the FAQ](../resources/faq.md#how-do-i-use-fields-with-the-same-name-as-keywords-like-from-where) and [the corresponding issue](https://github.com/blacksmithgu/obsidian-dataview/issues/1164) for further information.

~~~
```dataview
TABLE id, episode_metadata.next, aliases[0]
```
~~~

### Function Calls

Dataview supports various functions for manipulating data, which are described in full in the [functions
documentation](functions.md). They have the general syntax `function(arg1, arg2, ...)` - i.e., `lower(file.name)` or
`regexmatch("A.+", file.folder)`.

~~~
```dataview
LIST
WHERE contains(file.name, "WIP")
```

```dataview
LIST
WHERE string(file.day.year) = split(this.file.name, "-W")[0]
```
~~~

### Lambdas

Lambdas are advanced literals which let you define a function that takes some number of inputs, and produces an output.
They have the general form:

```
(arg1, arg2, arg3, ...) => <expression using args>
```

Lambdas are used in several advanced operators like `reduce` and `map` to allow for complex transformations of data. A
few examples:

```
(x) => x.field                  (return field of x, often used for map)
(x, y) => x + y                 (sum x and y)
(x) => 2 * x                    (double x)
(value) => length(value) = 4    (return true if value is length 4)
```

~~~
```dataview
CALENDAR file.day
FLATTEN all(map(file.tasks, (x) => x.completed)) AS "allCompleted"
WHERE !allCompleted
```
~~~

---

## Type-specific Interactions & Values

Most dataview types have special interactions with operators, or have additional fields that can be retrieved using the
index operator. This is true for [dates](../annotation/types-of-metadata.md#date) and [durations](../annotation/types-of-metadata.md#duration) and as well for links. Read more about date and durations on their respective section in [Types of Metadata](../annotation/types-of-metadata.md).

### Links

You can "index through" a link to get values on the corresponding page. For example `[[Assignment Math]].duedate` would get the value
`duedate` from page `Assignment Math`.

!!! note "Link Indexing in Expressions"
    If your link is a field that you defined in an inline field or in front-matter, like `Class:: [[Math]]` and you want to get the field `timetable`, then you
    index into it by writing `Class.timetable`.
    Using `[[Class]].timetable` would look up the page literally called `Class`, and not `Math`!
