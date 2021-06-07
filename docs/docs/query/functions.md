---
sidebar_position: 4
---
# Functions

Dataview functions provide more advanced ways to manipulate data.

## Function Vectorization

Most functions can be applied either to single values (like `number`, `string`, `date`, etc.) OR to lists of those
values. If a function is applied to a list, it also returns a list after the function is applied to each element
in the list. For example:

```
lower("YES") = "yes"
lower(list("YES", "NO")) = list("yes", "no")

replace("yes", "e", "a") = "yas"
replace(list("yes", "ree"), "e", "a") = list("yas", "raa")
```

## Constructors

Constructors which create values.

### `object(key1, value1, ...)`

Creates a new object with the given keys and values. Keys and values should alternate in the call, and keys should
always be strings/text.

```
object() => empty object
object("a", 6) => object which maps "a" to 6
object("a", 4, "c", "yes") => object which maps a to 4, and c to "yes"
```

### `list(value1, value2, ...)`

Creates a new list with the given values in it.

```
list() => empty list
list(1, 2, 3) => list with 1, 2, and 3
list("a", "b", "c") => list with "a", "b", and "c"
```

### `date(any)`

Parses a date from the provided string, date, or link object, if possible, returning null otherwise.

```
date("2020-04-18") = <date object representing April 18th, 2020>
date([[2021-04-16]]) = <date object for the given page, refering to file.day>
```

### `number(string)`

Pulls the first number out of the given string, returning it if possible. Returns null if there are no numbers in the
string.

```
number("18 years") = 18
number(34) = 34
number("hmm") = null
```

### `link(path, [display])`

Construct a link object from the given file path or name. If provided with two arguments, the second argument is the
display name for the link.

```
link("Hello") => link to page named 'Hello'
link("Hello", "Goodbye") => link to page named 'Hello', displays as 'Goodbye'
```

### `elink(url, [display])`

Construct a link to an external url (like `www.google.com`). If provided with two arguments, the second
argument is the display name for the link.

```
elink("www.google.com") => link element to google.com
elink("www.google.com", "Google") => link element to google.com, displays as "Google"
```

---

## Numeric Operations

### `round(number, [digits])`

Round a number to a given number of digits. If the second argument is not specified, rounds to the nearest whole number;
otherwise, rounds to the given number of digits.

```
round(16.555555) = 7
round(16.555555, 2) = 16.56
```

--

## Objects, Arrays, and String Operations

Operations that manipulate values inside of container objects.

### `contains(object|list|string, value)`

Checks if the given container type has the given value in it. This function behave slightly differently based on whether
the first argument is an object, a list, or a string.

- For objects, checks if the object has a key with the given name. For example,
    ```
    contains(file, "ctime") = true
    contains(file, "day") = true (if file has a date in its title, false otherwise)
    ```
- For lists, checks if any of the array elements equals the given value. For example,
    ```
    contains(list(1, 2, 3), 3) = true
    contains(list(), 1) = false
    ```
- For strings, checks if the given value is a substring (i.e., inside) the string.
    ```
    contains("hello", "lo") = true
    contains("yes", "no") = false
    ```

### `extract(object, key1, key2, ...)`

Pulls multiple fields out of an object, creating a new object with just those fields.

```
extract(file, "ctime", "mtime") = object("ctime", file.ctime, "mtime", file.mtime)
extract(object("test", 1)) = object()
```

### `sort(list)`

Sorts a list, returning a new list in sorted order.

```
sort(list(3, 2, 1)) = list(1, 2, 3)
sort(list("a", "b", "aa")) = list("a", "aa", "b")
```

### `reverse(list)`

Reverses a list, returning a new list in reversed order.

```
reverse(list(1, 2, 3)) = list(3, 2, 1)
reverse(list("a", "b", "c")) = list("c", "b", "a")
```

### `length(object|array)`

Returns the number of fields in an object, or the number of entries in an array.

```
length(list()) = 0
length(list(1, 2, 3)) = 3
length(object("hello", 1, "goodbye", 2)) = 2
```

### `sum(array)`

Sums all numeric values in the array

```
sum(list(1, 2, 3)) = 6
```

### `all(array)`

Returns `true` only if ALL values in the array are truthy. You can also pass multiple arguments to this function, in
which case it returns `true` only if all arguments are truthy.

```
all(list(1, 2, 3)) = true
all(list(true, false)) = false
all(true, false) = false
all(true, true, true) = true
```

### `any(array)`

Returns `true` if ANY of the values in the array are truthy. You can also pass multiple arguments to this function, in
which case it returns `true` if any of the arguments are truthy.

```
any(list(1, 2, 3)) = true
any(list(true, false)) = true
any(list(false, false, false)) = false
all(true, false) = true
all(false, false) = false
```


### `none(array)`

Returns `true` if NONE of the values in the array are truthy.

### `join(array)`

Joins elements in an array into a single string (i.e., rendering them all on the same line). If provided with a second
argument, then each element will be separated by the given separator.

```
join(list(1, 2, 3)) = "1, 2, 3"
join(list(1, 2, 3), " ") = "1 2 3"
join(6) = "6"
join(list()) = ""
```

---

## String Operations

### `regexmatch(pattern, string)`

Checks if the given string matches the given pattern (using the JavaScript regex engine).

```
regexmatch("\w+", "hello") = true
regexmatch(".", "a") = true
regexmatch("yes|no", "maybe") = false
```

### `regexreplace(string, pattern, replacement)`

Replaces all instances where the *regex* `pattern` matches in `string`, with `replacement`. This uses the JavaScript
replace method under the hood, so you can use special characters like `$1` to refer to the first capture group, and so on.

```
regexreplace("yes", "[ys]", "a") = "aea"
regexreplace("Suite 1000", "\d+", "-") = "Suite -"
```

### `replace(string, pattern, replacement)`

Replace all instances of `pattern` in `string` with `replacement`.

```
replace("what", "wh", "h") = "hat"
replace("The big dog chased the big cat.", "big", "small") = "The small dog chased the small cat."
replace("test", "test", "no") = "no"
```

### `lower(string)`

Convert a string to all lower case.

```
lower("Test") = "test"
lower("TEST") = "test"
```

### `upper(string)`

Convert a string to all upper case.

```
upper("Test") = "TEST"
upper("test") = "TEST"
```

## Utility Functions

### `default(field, value)`

If `field` is null, return `value`; otherwise return `field`. Useful for replacing null values with defaults. For example, to show projects which haven't been completed yet, use `"incomplete"` as their defualt value:

```
default(dateCompleted, "incomplete")
```

Default is vectorized in both arguments; if you need to use default explicitly on a list argument, use `ldefault`, which
is the same as default but is not vectorized.

```
default(list(1, 2, null), 3) = list(1, 2, 3)
ldefault(list(1, 2, null), 3) = list(1, 2, null)
```

### `choice(bool, left, right)`

A primitive if statement - if the first argument is truthy, returns left; otherwise, returns right.

```
choice(true, "yes", "no") = "yes"
choice(false, "yes", "no") = "no"
choice(x > 4, y, z) = y if x > 4, else z
```

### `striptime(date)`

Strip the time component of a date, leaving only the year, month, and day. Good for date comparisons if you don't care
about the time.

```
striptime(file.ctime) = file.cday
striptime(file.mtime) = file.mday
```
