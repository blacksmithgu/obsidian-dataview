# Functions

Dataview functions provide more advanced ways to manipulate data.

## Function Vectorization

Most functions can be applied either to single values (like `number`, `string`, `date`, etc.) OR to lists of those
values. If a function is applied to a list, it also returns a list after the function is applied to each element
in the list. For example:

```
lower("YES") = "yes"
lower(["YES", "NO"]) = ["yes", "no"]

replace("yes", "e", "a") = "yas"
replace(["yes", "ree"], "e", "a") = ["yas", "raa"]
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

### `dur(any)`

Parses a duration from the provided string or duration, returning null on failure.

```
dur(8 minutes) = <8 minutes>
dur("8 minutes, 4 seconds") = <8 minutes, 4 seconds>
dur(dur(8 minutes)) = dur(8 minutes) = <8 minutes>
```

### `number(string)`

Pulls the first number out of the given string, returning it if possible. Returns null if there are no numbers in the
string.

```
number("18 years") = 18
number(34) = 34
number("hmm") = null
```

### `string(any)`

Converts any value into a "reasonable" string representation. This sometimes produces less pretty results than just directly using
the value in a query - it is mostly useful for coercing dates, durations, numbers, and so on into strings for
manipulation.

```
string(18) = "18"
string(dur(8 hours)) = "8 hours"
string(date(2021-08-15)) = "August 15th, 2021"
```

### `link(path, [display])`

Construct a link object from the given file path or name. If provided with two arguments, the second argument is the
display name for the link.

```
link("Hello") => link to page named 'Hello'
link("Hello", "Goodbye") => link to page named 'Hello', displays as 'Goodbye'
```

### `embed(link, [embed?])`

Convert a link object into an embedded link; support for embedded links is somewhat spotty in Dataview views, though
embedding of images should work.

```
embed(link("Hello.png")) => embedded link to the "Hello.png" image, which will render as an actual image.
```

### `elink(url, [display])`

Construct a link to an external url (like `www.google.com`). If provided with two arguments, the second
argument is the display name for the link.

```
elink("www.google.com") => link element to google.com
elink("www.google.com", "Google") => link element to google.com, displays as "Google"
```

### `typeof(any)`

Get the type of any object for inspection. Can be used in conjunction with other operators to change behavior based on type.

```
typeof(8) => "number"
typeof("text") => "string"
typeof([1, 2, 3]) => "array"
typeof({ a: 1, b: 2 }) => "object"
typeof(date(2020-01-01)) => "date"
typeof(dur(8 minutes)) => "duration"
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

### `product()`

Calculates the product of a list of numbers.

```
product([1,2,3]) = 6
```

--

## Objects, Arrays, and String Operations

Operations that manipulate values inside of container objects.

### `contains()` and friends

For a quick summary, here are some examples:

```
contains("Hello", "Lo") = false
contains("Hello", "lo") = true

icontains("Hello", "Lo") = true
icontains("Hello", "lo") = true

econtains("Hello", "Lo") = false
econtains("Hello", "lo") = true
econtains(["this","is","example"], "ex") = false
econtains(["this","is","example"], "is") = true
```

#### `contains(object|list|string, value)`

Checks if the given container type has the given value in it. This function behave slightly differently based on whether
the first argument is an object, a list, or a string.
This function is case-sensitive.

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

#### `icontains(object|list|string, value)`

Case insensitive version of `contains()`.

#### `econtains(object|list|string, value)`

"Exact contains" checks if the exact match is found in the string/list.
This function is case sensitive.

- For strings, it behaves exactly like [`contains()`](#containsobjectliststring-value).
    ```
    econtains("Hello", "Lo") = false
    econtains("Hello", "lo") = true
    ```

- For lists, it checks if the exact word is in the list.
    ```
    econtains(["These", "are", "words"], "word") = false
    econtains(["These", "are", "words"], "words") = true
    ```

- For objects, it checks if the exact key name is present in the object. It does **not** do recursive checks.
    ```
    econtains({key:"value", pairs:"here"}, "here") = false
    econtains({key:"value", pairs:"here"}, "key") = false
    econtains({key:"value", recur:{recurkey: "val"}}, "value") = false
    econtains({key:"value", recur:{recurkey: "val"}}, "Recur") = false
    econtains({key:"value", recur:{recurkey: "val"}}, "recurkey") = false
    ```

### `containsword(list|string, value)`

Checks if `value` has an exact word match in `string` or `list`.
This is case insensitive.
The outputs are different for different types of input, see examples.

- For strings, it checks if the word is present in the given string.
    ```
    containsword("word", "word") = true
    containsword("word", "Word") = true
    containsword("words", "Word") = false
    containsword("Hello there!, "hello") = true
    containsword("Hello there!, "HeLLo") = true
    containsword("Hello there chaps!, "chap") = false
    containsword("Hello there chaps!, "chaps") = true
    ```

- For lists, it returns a list of booleans indicating if the word's exact case insensitive match was found.
    ```
    containsword(["I have no words.", "words"], "Word") = [false, false]
    containsword(["word", "Words"], "Word") = [true, false]
    containsword(["Word", "Words in word"], "WORD") = [true, true]
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
any(true, false) = true
any(false, false) = false
```


### `none(array)`

Returns `true` if NONE of the values in the array are truthy.

```
none([]) = true
none([false, false]) = true
none([false, true]) = false
none([1, 2, 3]) = false
```

### `join(array)`

Joins elements in an array into a single string (i.e., rendering them all on the same line). If provided with a second
argument, then each element will be separated by the given separator.

```
join(list(1, 2, 3)) = "1, 2, 3"
join(list(1, 2, 3), " ") = "1 2 3"
join(6) = "6"
join(list()) = ""
```

### `filter(array, predicate)`

Filters elements in an array according to the predicate, returning a new list of the elements which matched.

```
filter([1, 2, 3], (x) => x >= 2) = [2, 3]
filter(["yes", "no", "yas"], (x) => startswith(x, "y")) = ["yes", "yas"]
```

### `map(array, func)`

Applies the function to each element in the array, returning a list of the mapped results.

```
map([1, 2, 3], (x) => x + 2) = [3, 4, 5]
map(["yes", "no"], (x) => x + "?") = ["yes?", "no?"]
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

### `split(string, delimiter, [limit])`

Split a string on the given delimiter string. If a third argument is provided, it limits the number of splits that occur. The delimiter string is interpreted as a regular expression. If there are capture groups in the delimiter, matches are spliced into the result array, and non-matching captures are empty strings.


```
split("hello world", " ") = list("hello", "world")
split("hello  world", "\s") = list("hello", "world")
split("hello there world", " ", 2) = list("hello", "there")
split("hello there world", "(t?here)") = list("hello ", "there", " world")
split("hello there world", "( )(x)?") = list("hello", " ", "", "there", " ", "", "world")
```

### `startswith(string, prefix)`

Checks if a string starts with the given prefix.

```
startswith("yes", "ye") = true
startswith("path/to/something", "path/") = true
startswith("yes", "no") = false
```

### `endswith(string, suffix)`

Checks if a string ends with the given suffix.

```
endswith("yes", "es") = true
endswith("path/to/something", "something") = true
endswith("yes", "ye") = false
```

### `padleft(string, length, [padding])`

Pads a string up to the desired length by adding padding on the left side. If you omit the padding character, spaces
will be used by default.

```
padleft("hello", 7) = "  hello"
padleft("yes", 5, "!") = "!!yes"
```

### `padright(string, length, [padding])`

Equivalent to `padleft`, but pads to the right instead.

```
padright("hello", 7) = "hello  "
padright("yes", 5, "!") = "yes!!"
```

### `substring(string, start, [end])`

Take a slice of a string, starting at `start` and ending at `end` (or the end of the string if unspecified).

```
substring("hello", 0, 2) = "he"
substring("hello", 2, 4) = "ll"
substring("hello", 2) = "llo"
substring("hello", 0) = "hello"
```

### `truncate(string, length, [suffix])`

Truncate a string to be at most the given length, including the `suffix` (which defaults to `...`). Generally useful
to cut off long text in tables.

```
truncate("Hello there!", 8) = "Hello..."
truncate("Hello there!", 8, "/") = "Hello t/"
truncate("Hello there!", 10) = "Hello t..."
truncate("Hello there!", 10, "!") = "Hello the!"
truncate("Hello there!", 20) = "Hello there!"
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

### `dateformat(date|datetime, string)`

Format a Dataview date using a formatting string.
Uses [Luxon tokens](https://moment.github.io/luxon/#/formatting?id=table-of-tokens).

```
dateformat(file.ctime,"yyyy-MM-dd") = "2022-01-05"
dateformat(file.ctime,"HH:mm:ss") = "12:18:04"
dateformat(date(now),"x") = "1407287224054"
dateformat(file.mtime,"ffff") = "Wednesday, August 6, 2014, 1:07 PM Eastern Daylight Time"
```

### `localtime(date)`

Converts a date in a fixed timezone to a date in the current timezone.

### `meta(link)`

Get an object containing metadata of a link. When you access a property on a link what you get back is the property
value from the linked file. The `meta` function makes it possible to access properties of the link itself.

There are several properties on the object returned by `meta`:

#### `meta(link).display`

Get the display text of a link, or null if the link does not have defined display text.

```
meta([[2021-11-01|Displayed link text]]).display = "Displayed link text"
meta([[2021-11-01]]).display = null
```

#### `meta(link).embed`

True or false depending on whether the link is an embed. Those are links that begin with an exclamation mark, like
`![[Some Link]]`.

#### `meta(link).path`

Get the path portion of a link.

```
meta([[My Project]]).path = "My Project"
meta([[My Project#Next Actions]]).path = "My Project"
meta([[My Project#^9bcbe8]]).path = "My Project"
```

#### `meta(link).subpath`

Get the subpath of a link. For links to a heading within a file the subpath will be the text of the heading. For links
to a block the subpath will be the block ID. If neither of those cases applies then the subpath will be null.

```
meta([[My Project#Next Actions]]).subpath = "Next Actions"
meta([[My Project#^9bcbe8]]).subpath = "9bcbe8"
meta([[My Project]]).subpath = null
```

This can be used to select tasks under specific headings.

````
```dataview
task
where meta(section).subpath = "Next Actions"
```
````

#### `meta(link).type`

Has the value "file", "header", or "block" depending on whether the link links to an entire file, a heading within
a file, or to a block within a file.

```
meta([[My Project]]).type = "file"
meta([[My Project#Next Actions]]).type = "header"
meta([[My Project#^9bcbe8]]).type = "block"
```
