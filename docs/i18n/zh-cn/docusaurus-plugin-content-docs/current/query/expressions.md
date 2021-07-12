---
sidebar_position: 2
---
# 表达式 

Dataview查询语言*表达式* 可以是任何能产生一个值的量，所有字段都是表达式，字面值如`6`，已计算的值如`field - 9`都是一个表达式，做一个更具体的总结：

```
# 常规
field               (directly refer to a field)
simple-field        (refer to fields with spaces/punctuation in them like "Simple Field!")
a.b                 (if a is an object, retrieve field named 'b')
a[expr]             (if a is an object or array, retrieve field with name specified by expression 'expr')
f(a, b, ...)        (call a function called `f` on arguments a, b, ...)

# 算术运算
a + b               (addition)
a - b               (subtraction)
a * b               (multiplication)
a / b               (division)

# 比较运算
a > b               (check if a is greater than b)
a < b               (check if a is less than b)
a = b               (check if a equals b)
a != b              (check if a does not equal b)
a <= b              (check if a is less than or equal to b)
a >= b              (check if a is greater than or equal to b)

# 特殊操作
[[Link]].value      (fetch `value` from page `Link`)
```

下面是对每项内容的更详细阐述。

## 表达式类型

### 字段是表达式

最简单的表达式是直接引用一个字段的表达式。如果你有一个叫做 "field "的字段，那么你可以直接引用它的名字 - `field`。如果字段名有空格、标点符号或其他非字母/数字的 字符，那么你可以使用Dataview的全小写且空格被替换为“-”简化名称来引用它。例如，`this is a field`变成`this-is-a-field`；`Helo！`变成`hello`，以此类推。

### 算术运算

你可以使用标准算术运算符来组合字段：加法（`+`），减法（`-`），乘法（`*`）。 和除法 (`/`)。例如，`field1 + field2`是一个计算两个字段之和的表达式。

### 比较运算

你可以使用各种比较运算符来比较大多数数值。`<`, `>`, `<=`, `>=`, `=`, `!=`. 这产生了一个布尔的真或假值，可以在查询中的`WHERE'块中使用。

### 数组/对象索引

你可以通过索引操作符`array[<index>]`从数组中索引数据，其中`<index>`是任何已计算的表达式。
数组是以0为索引的，所以第一个元素是索引0，第二个元素是索引1，以此类推。 例如，`list(1, 2, 3)[0] = 1`.

你也可以使用索引操作符从对象（将文本映射到数据值）中检索数据，此时的索引是字符串/文本而不是数字。你也可以使用快捷方式`object.<name>`，其中`<name>`是值的索引。例如`object("yes", 1).yes = 1`。

### 函数调用

Dataview支持各种用于操作数据的函数，这些函数在[函数文档](functions)中有完整描述。它们的一般语法是`function(arg1, arg2, ...)` - 即`lower("yes")`或 `regexmatch("text", ".+")`。

---

## 特定类型的交互&值

大多数dataview类型与运算符有特殊的相互作用，或者有额外的字段可以使用索引操作符索引。

### 日期

你可以通过索引来检索一个日期的不同组成部分：`date.year`，`date.month`，`date.day`，`date.hour`。 `date.minute`, `date.second`, `date.week`。你也可以将时间段添加到日期中以获得新的日期。

### 时间段

时间段可以相互添加，也可以添加到日期。你可以通过索引来检索一个时间段的各种组成部分。`duration.years`, `duration.months`, `duration.days`, `duration.hours`, `duration.minutes`, `duration.seconds`.

### 链接

你可以 "通过索引 "一个链接来获得相应页面上的值。例如，`[[Link]].value`将获得来自`Link`页面上的`value`值。