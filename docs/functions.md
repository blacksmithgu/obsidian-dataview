# Functions

Functions provide various procedures and operations beyond simple arithmetic and comparisons. A list of all function
references, sorted by general purpose, is shown below:

## Objects, Arrays, and String Operations

##### `contains(object|list|string, value)`

Checks if the given container type has the given value in it. This function behave slightly differently based on whether
the first argument is an object, a list, or a string.

- For objects, checks if the object has an entry with the given name. For example,
    ```
    contains(file, "ctime") = true
    contains(file, "day") = true (if file has a date in it's title, false otherwise)
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


##### `extract(object, key1, key2, ...)`

Pulls multiple fields out of an object, creating a new object with just those fields.

```
extract(file, "ctime", "mtime") = object("ctime", file.ctime, "mtime", file.mtime)
extract(object("test", 1)) = object()
```

##### `sort(list)`

Sorts a list, returning a new list in sorted order.

```
sort(list(3, 2, 1)) = list(1, 2, 3)
sort(list("a", "b", "aa")) = list("a", "aa", "b")
```

##### `reverse(list)`

Reverses a list, returning a new list in reversed order.

```
reverse(list(1, 2, 3)) = list(3, 2, 1)
reverse(list("a", "b", "c")) = list("c", "b", "a")
```

## String Operations

##### `regexmatch(pattern, string)`

Checks if the given string matches the given pattern (using the JavaScript regex engine).

```
regexmatch("\w+", "hello") = true
regexmatch(".", "a") = true
regexmatch("yes|no", "maybe") = false
```