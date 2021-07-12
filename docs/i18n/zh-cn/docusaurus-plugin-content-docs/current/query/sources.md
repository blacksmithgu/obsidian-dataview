---
sidebar_position: 2
---
# 来源

dataview中的来源指的是标识一组文件，任务或者其它数据对象的东西。来源是由dataview内部索引的，所以可以快速进行查询。dataview目前支持三种来源类型：

1. **标签(Tages)**：格式为`#tag`的来源。
2. **文件夹(Folders)**：格式为`“folder”`的来源。
3. **链接(Links)**：你可以选择内链和外链。

- 获得链接到`[[note]]`的所有页面，使用`FROM [[note]]`。
- 获得从`[[note]]`链接的所有页面(如，文件中的所有链接)，使用`FROM outgoing([[note]])`。

你可以对这些过滤器进行组合，以便使用 "and "和 "or "获得更高级的来源。

* 举个例子，`#tag和 "folder"`将返回在`folder`中和包含`#tag`的所有页面。
* `[[Food]] or [[Exercise]]` 将给出任何链接到`[[Food]]`或`[[Exercise]]`的所有页面。

来源既用于[FROM查询语句](/docs/query/queries#from)，也用于各种JavaScript API查询调用。