---
sidebar_position: 1
---
# 概览

dataview的JavaScript API允许执行任意的JavaScript，可以访问dataview的索引和查询引擎。引擎，这对于复杂的视图或与其他插件的互操作是很好的。该API有两种形式：面向插件和面向用户（或 "内联API使用方式"）。面向插件的方式目前还不能使用，所以本文档将专注于面向用户的查询，任意的JS都可以在markdown页面中执行。

## JavaScript Codeblocks

你可以通过下述操作创建一个Dataview JS代码块：

~~~
```dataviewjs
<code>
```
~~~

在这种代码块中执行的代码可以访问`dv`变量，它提供了与代码块相关的全部dataview API（如`dv.table()`，`dv.pages()`，等等）。更多信息，请查看[代码块API参考](/docs/api/code-reference)。