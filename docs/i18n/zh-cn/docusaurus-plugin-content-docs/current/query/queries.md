---
sidebar_position: 1
---
# 查询

dataview查询语言是一种简单的、结构化的、自定义的查询语言，用于快速创建数据的视图。支持：

- 提取与标签、文件夹、链接等相关的页面。
- 通过对字段的简单操作过滤页面/数据，如比较、存在性检查等。
- 根据字段对结果进行排序。

该查询语言支持以下视图类型，描述如下：

1. **表格(TABLE)**：传统的视图类型；每个数据点为一行，字段数据为一列。
2. **列表(LIST)**：匹配查询页面的列表。你可以为每个页面输出一个单一的关联值。
3. **任务列表(TASK)**：匹配给定查询的任务列表。

## 通用格式

查询的通用格式如下：

~~~
```dataview
TABLE|LIST|TASK <field> [AS "Column Name"], <field>, ..., <field> FROM <source> (like #tag or "folder")
WHERE <expression> (like 'field = value')
SORT <expression> [ASC/DESC] (like 'field ASC')
... other data commands
```
~~~

只有 "select "语句（描述什么视图和什么字段）是必需的。如果省略了FROM语句，会自动查询你在库中的所有markdown页面。如果其他语句（如WHERE或SORT）存在，它们将按照顺序运行。重复的语句是允许的（例如，多个WHERE语句）。

* 对于不同的视图类型，只有第一行（"select "部分，在这里你指定要显示的视图类型和字段）是不同的。你可以在任何查询中应用*数据命令(data commands)* 如*WHERE*和*SORT*，你也可以通过使用*FROM*来选择[来源](/docs/query/sources)。

 关于什么是表达式见[表达式](expressions) , 什么是来源见[来源](sources)。

## 查询类型

### 列表查询

列表是最简单的视图，它简单地呈现了一个匹配查询的页面（或自定义字段）的列表。
要获得与查询相匹配的页面的列表，只需使用：

```
LIST FROM <source>
```

举个例子，运行`LIST FROM #games/moba or #games/crpg` 会呈现:

![List Example](/images/game-list.png)

你可以通过在`LIST`后面添加一个表达式，在每个匹配的文件之外呈现一个单一的计算值。

```
LIST <expression> FROM <source>
```

举个例子，运行`LIST "File Path: " + file.path FROM "4. Archive"` 会呈现:

![List Example](/images/file-path-list.png)

### 表格查询

表格提供页面数据的表格化视图。你可以通过给出一个逗号分隔的YAML字段列表来构建一个表格，像这样：

```
TABLE file.day, file.mtime FROM <source>
```

你可以通过使用`AS`语法，选择一个标题名称来表示已计算的字段。

```
TABLE (file.mtime + dur(1 day)) AS next_mtime, ... FROM <source>
```

一个表格查询的例子:

```
TABLE time-played AS "Time Played", length as "Length", rating as "Rating" FROM #game
SORT rating DESC
```

![Table Example](/images/game.png)

### 任务列表查询

任务视图呈现所有其页面符合给定谓词的任务。

```
TASK from <source>
```

举个例子, `TASK FROM "dataview"`会呈现:

![Task Example](/images/project-task.png)

## 数据命令

dataview查询可以由不同的命令组成。命令是按顺序执行的，你可以有重复的命令（例如，多个`WHERE`块或多个`GROUP BY`块）。

### FROM

`FROM`语句决定了哪些页面在初始被收集并传递给其他命令进行进一步的筛选。你可以从任何[来源](/docs/query/sources)中选择，来源可选择文件夹，标签，内链和外链。

- **标签(Tags)**: 从标签(包含子标签)中选择，使用`FROM #tag`。
- **文件夹(Folders)**: 从文件夹(包含子文件夹)中选择，使用 `FROM "folder"`。
- **链接(Links)**: 你可以选择一个链接到该文件的链接，也可以选择该文件链接到其它页面的链接：
  - 获得链接到`[[note]]`的所有页面，使用`FROM [[note]]`。
  - 获得从`[[note]]`链接的所有页面(如，文件中的所有链接)，使用`FROM outgoing([[note]])`。

你可以对过滤器进行组合，以便使用 "and "和 "or "获得更高级的来源。
- 举个例子，`#tag and "folder"`将返回在`folder`中和包含`#tag`的所有页面。
- `[[Food]] or [[Exercise]]` 将给出任何链接到`[[Food]]`或`[[Exercise]]`的页面。

### WHERE

根据字段过滤页面。只有clause计算为 "true "的页面才会被显示：

```
WHERE <clause>
```

1. 获得所有在最近24小时内修改的文件。

```
LIST WHERE file.mtime >= date(today) - dur(1 day)
```

2. 找到所有未标明完成且超过一个月的project。

```
LIST FROM #projects
WHERE !completed AND file.ctime <= date(today) - dur(1 month)
```

### SORT

按一个或多个字段对所有结果进行排序。

```
SORT date [ASCENDING/DESCENDING/ASC/DESC]
```

你也可以给出多个字段来进行排序。排序将在第一个字段的基础上进行。接着，如果出现相等，第二个字段将被用来对相等的字段进行排序。如果仍然有相等，将用第三个字段进行排序，以此类推。

```
SORT field1 [ASCENDING/DESCENDING/ASC/DESC], ..., fieldN [ASC/DESC]
```

### GROUP BY

对一个字段的所有结果进行分组。每个唯一的字段值产生一行，它有两个属性：一个对应于被分组的字段，一个是`rows`数组字段，包含所有匹配的页面。

```
GROUP BY field
GROUP BY (computed_field) AS name
```

为了使`rows`数组工作更容易，Dataview支持字段的 "调配(swizzling)"。如果你想从`rows`数组中的每个对象获取`test`字段，那么`rows.test`将自动从`rows`中的每个对象获取`test`字段，产生一个新的数组。
你可以在产生的数组上应用聚合运算符，如`sum()`。

### FLATTEN

对一个数组的每一行进行扁平化处理，在数组中的每个条目产生一个结果行。

```
FLATTEN field
FLATTEN (computed_field) AS name
```

例如，将每个文献注释中的 "作者 "字段扁平化处理，使每个作者占一行。

```
table authors from #LiteratureNote
flatten authors
```

![Flatten Example](/images/flatten-authors.png)