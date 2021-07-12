---
sidebar_position: 2
---

# 页面和字段

dataview的核心数据抽象是*页面(page)* ，指在你的库中包含*字段(field)* 的markdwon页面。*字段* 是一段任意命名的数据 ——文本，日期，时间段，链接。
这些可被dataview理解，展示，筛选。字段可以通过三种方式定义：

1. **扉页(Frontmatter)**: 所有的YAML 扉页内容都将自动的转换成dataview字段。
2. **内联字段(inline field)**: 一行格式为`<Name>:: <Value>`的内容将自动的被dataview解析为一个字段，请注意，你可以对`<Name>`使用标准的Markdown格式，但以后将不再支持。 
3. **隐含字段(implicit)**: dataview自带大量的元数据对页面进行注释，如文件的创建日期、任何相关的日期、文件中的链接、标签等。

用前两种方法创建的一个有相关字段的示例页面如下：

```
---
duration: 4 hours
reviewed: false
---
# Movie X

**Thoughts**:: It was decent.
**Rating**:: 6
```

### 字段类型

dataview支持数种不同的字段类型：

- **文本(Text)**: 全局默认为文本。如果一个字段不匹配其它具体的类型，默认为一段纯文本。
- **数字(Number)**: 数字类似于'6' 和 '3.6'。
- **布尔值(Boolean)**: true/false, 就像编程中的概念。
- **日期(Date)**: ISO8601 标准定义的通用日期格式 `YYYY-MM[-DDTHH:mm:ss]`. 月份后面的内容都是可选的。
- **时间段(Duration)**: 时间段的格式为 `<time> <unit>`, 就像 `6 hours` 或者 `4 minutes`。支持常见的英文缩写如`6hrs` 或者 `2m` 。
- **链接(Link)**: 普通的Obsidian 链接如 `[[Page]]` 或者 `[[Page|Page Display]]`。
- **列表(List)**: YAML中，其它dataview字段组成的列表将作为普通的YAML列表定义；对于内联字段，它们就只是逗号分隔的列表。
- **对象(Object)**：名称(name)到dataview字段的映射。这仅能在YAML扉页中利用通用的YANML对象语法进行定义。
  对象语法:
  ```
  field:
    value1: 1
    value2: 2
    ...
  ```

不同的字段类型非常重要。这能确保dataview理解怎样合理的对值进行比较和排序，并提供不同的操作。

### 隐含字段

dataview能自动的对每个页面添加大量的元数据。

- `file.name`: 该文件标题(字符串)。
- `file.folder`: 该文件所在的文件夹的路径(字符串)。
- `file.path`: 该文件的完整路径(字符串)。
- `file.link`: 该文件的一个链接(链接)。
- `file.size`: 该文件的大小(bytes)(数字)
- `file.ctime`: 该文件的创建日期(日期和时间)。
- `file.cday`: 该文件的创建日期(仅日期)。
- `file.mtime`: 该文件最后编辑日期(日期和时间)。
- `file.mday`: 该文件最后编辑日期(仅日期)。
- `file.tags`: 笔记中所有标签组成的数组。子标签按每个级别进行细分，所以`#Tag/1/A`将会在数组中储存为`[#Tag, #Tag/1, #Tag/1/A]`。
- `file.etags`: 笔记中所有显式标签组成的数组；不同于`file.tags`，不包含子标签。
- `file.outlinks`: 该文件所有外链(outgoing link)组成的数组。
- `file.aliases`: 笔记中所有别名组成的数组。

如果文件的标题内有一个日期（格式为yyyy-mm-dd或yyyymmdd），或者有一个Date字段/inline字段，它也有以下属性:

- `file.day`: 一个该文件的隐含日期。