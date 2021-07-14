---
sidebar_position: 4
---
# 函数

dataview的函数提供了更高级操作数据的方法。

## 函数矢量化

大多数函数可以应用于单个值（如`数字`，`字符串`，`日期`等）或这些值的列表。如果一个函数被应用于一个列表，在函数被应用于列表中的每个元素后，它也会返回一个列表。如：

```
lower("YES") = "yes"
lower(list("YES", "NO")) = list("yes", "no")

replace("yes", "e", "a") = "yas"
replace(list("yes", "ree"), "e", "a") = list("yas", "raa")
```

## 构造器

构造器创建值

### `object(key1, value1, ...)`

用给定的键和值创建一个新的对象。在调用中，键和值应该交替出现，键应该总是字符串/文本。

```
object() => empty object
object("a", 6) => object which maps "a" to 6
object("a", 4, "c", "yes") => object which maps a to 4, and c to "yes"
```

### `list(value1, value2, ...)`

用给定的值创建一个新的列表。

```
list() => empty list
list(1, 2, 3) => list with 1, 2, and 3
list("a", "b", "c") => list with "a", "b", and "c"
```

### `date(any)`

从提供的字符串、日期或链接对象中解析一个日期，解析不出返回null。

```
date("2020-04-18") = <date object representing April 18th, 2020>
date([[2021-04-16]]) = <date object for the given page, refering to file.day>
```

### `number(string)`

从给定的字符串中抽出第一个数字，并返回该数字。如果字符串中没有数字，则返回null。

```
number("18 years") = 18
number(34) = 34
number("hmm") = null
```

### `link(path, [display])`

从给定的文件路径或名称构建一个链接对象。如果有两个参数，第二个参数是链接的显示名称。

```
link("Hello") => link to page named 'Hello'
link("Hello", "Goodbye") => link to page named 'Hello', displays as 'Goodbye'
```

### `elink(url, [display])`

构建一个指向外部网址的链接（如`www.google.com`）。如果有两个参数，第二个参数是该链接的显示名称。

```
elink("www.google.com") => link element to google.com
elink("www.google.com", "Google") => link element to google.com, displays as "Google"
```

---

## 数值操作

### `round(number, [digits])`

将一个数字四舍五入到指定的位数。如果没有指定第二个参数，则舍入到最接近的整数。
否则，四舍五入到给定的位数。

```
round(16.555555) = 7
round(16.555555, 2) = 16.56
```

--

## 对象，数组和字符串操作

对容器对象内部的值进行操作的操作。

### `contains(object|list|string, value)`

检查给定的容器类型中是否有给定的值。这个函数的行为稍有不同，它基于第一个参数是一个对象，一个列表，还是一个字符串。

- 对于对象，检查该对象是否有一个给定名称的键。如：
    ```
    contains(file, "ctime") = true
    contains(file, "day") = true (if file has a date in its title, false otherwise)
    ```
- 对于列表，检查数组中是否有元素等于给定的值。如：
    ```
    contains(list(1, 2, 3), 3) = true
    contains(list(), 1) = false
    ```
- 对于字符串，检查给定的值是否是字符串的子串。
    ```
    contains("hello", "lo") = true
    contains("yes", "no") = false
    ```

### `extract(object, key1, key2, ...)`

从一个对象中抽出多个字段，创建一个抽出字段的新对象。

```
extract(file, "ctime", "mtime") = object("ctime", file.ctime, "mtime", file.mtime)
extract(object("test", 1)) = object()
```

### `sort(list)`

排序列表，返回一个排序好的新列表。

```
sort(list(3, 2, 1)) = list(1, 2, 3)
sort(list("a", "b", "aa")) = list("a", "aa", "b")
```

### `reverse(list)`

反转列表，返回一个反转好的新列表。

```
reverse(list(1, 2, 3)) = list(3, 2, 1)
reverse(list("a", "b", "c")) = list("c", "b", "a")
```

### `length(object|array)`

返回一个对象中的字段数量，或一个数组中的元素数量。

```
length(list()) = 0
length(list(1, 2, 3)) = 3
length(object("hello", 1, "goodbye", 2)) = 2
```

### `sum(array)`

数组中数值元素求和。

```
sum(list(1, 2, 3)) = 6
```

### `all(array)`

只有当数组中的所有值都为真，才会返回 "true"。你也可以给这个函数传递多个参数，只有当所有的参数都为真时，它才会返回`true'。

```
all(list(1, 2, 3)) = true
all(list(true, false)) = false
all(true, false) = false
all(true, true, true) = true
```

### `any(array)`

只要数组中有值为真，便返回`true`。也可以给这个函数传递多个参数，只要有参数为真，便返回`true`。

```
any(list(1, 2, 3)) = true
any(list(true, false)) = true
any(list(false, false, false)) = false
all(true, false) = true
all(false, false) = false
```


### `none(array)`

如果数组中没有元素，返回`none`。

### `join(array)`

将一个数组中的元素连接成一个字符串（即在同一行呈现所有的元素）。如果有第二个参数，那么每个元素将被给定的分隔符分开。

```
join(list(1, 2, 3)) = "1, 2, 3"
join(list(1, 2, 3), " ") = "1 2 3"
join(6) = "6"
join(list()) = ""
```

---

## 字符串操作

### `regexmatch(pattern, string)`

检查给定的字符串是否与给定的模式相匹配（使用JavaScript regex引擎）。

```
regexmatch("\w+", "hello") = true
regexmatch(".", "a") = true
regexmatch("yes|no", "maybe") = false
```

### `regexreplace(string, pattern, replacement)`

用 "replacement "替换所有在 "string "中匹配*regex* `pattern`的实例。这使用了JavaScript的替换方法，所以你可以使用特殊字符如`$1`来指代第一个捕获组，以此类推。

```
regexreplace("yes", "[ys]", "a") = "aea"
regexreplace("Suite 1000", "\d+", "-") = "Suite -"
```

### `replace(string, pattern, replacement)`

用`replacement`替换`string`中的所有`pattern`实例。

```
replace("what", "wh", "h") = "hat"
replace("The big dog chased the big cat.", "big", "small") = "The small dog chased the small cat."
replace("test", "test", "no") = "no"
```

### `lower(string)`

将一个字符串所有字符转换为小写字符。

```
lower("Test") = "test"
lower("TEST") = "test"
```

### `upper(string)`

将一个字符串所有字符转换为大写字符。

```
upper("Test") = "TEST"
upper("test") = "TEST"
```

## 工具函数

### `default(field, value)`

如果`field`为空，返回`value`；否则返回`field`。对于用默认值替换空值很有用。例如，要显示尚未完成的项目，使用`"incomplete"`作为其默认值。

```
default(dateCompleted, "incomplete")
```

默认值在两个参数中都是矢量；如果你需要在一个列表参数中明确使用默认值，请使用`ldefault`，它与默认值相同，但没有被矢量化。

```
default(list(1, 2, null), 3) = list(1, 2, 3)
ldefault(list(1, 2, null), 3) = list(1, 2, null)
```

### `choice(bool, left, right)`

一个原始的if语句--如果第一个参数为真，则返回第二个参数的内容；否则，返回第三个参数的内容。

```
choice(true, "yes", "no") = "yes"
choice(false, "yes", "no") = "no"
choice(x > 4, y, z) = y if x > 4, else z
```

### `striptime(date)`

剥离日期中的时间部分，只留下年、月、日。如果你在比较日期的时候不在乎时间，这种方式挺好。

```
striptime(file.ctime) = file.cday
striptime(file.mtime) = file.mday
```