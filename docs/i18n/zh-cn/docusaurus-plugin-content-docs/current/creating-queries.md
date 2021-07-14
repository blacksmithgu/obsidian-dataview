---
sidebar_position: 3
---
# 创建查询

一旦你给相关的页面添加了有用的数据，你就可以在某一个地方展示它或者操作它。dataview通过`dataview`代码块建立内联查询，写下查询代码，将会动态运行并在笔记的预览窗口展示。写这样的查询，有三种方式：

1. dataview的[查询语言](/docs/query/queries)是一个用于快速创建视图，简化的，类SQL的语言。它支持基本的算术和比较操作，对基础应用很友好。
2. 查询语言也提供内联查询，允许你直接在一个页面内嵌入单个值——通过`= date(tody)`创建今天的日期，或者通过`= [[Page]].value`来嵌入另一个页面的字段。
3. dataview [JavaScript API](/docs/api/intro)为你提供了JavaScript的全部功能，并为拉取Dataview数据和执行查询提供了DSL，允许你创建任意复杂的查询和视图。 

与JavaScript API相比，查询语言的功能往往比较滞后，主要是因为JavaScript API更接近实际代码；相反，查询语言更稳定，在Dataview的重大更新中不太可能出现故障。

### 使用查询语言

你可以在任意笔记中使用下列语法创建查询语言代码块：

~~~
```dataview
... query ...
```
~~~

怎样写一个查询的细节在[查询语言文档](/docs/query/queries)中有详细阐述；如果你更倾向于学习实例，可以参看[查询示例](/docs/query/examples)。

### 使用内联查询

你可以通过下列语法创建内联查询：

~~~
`= <query language expression>`
~~~

其中表达式(expression)在[查询语言和表达式](/docs/query/expressions)中有阐述。你可以在dataview设置中，通过使用不同的前缀(如`dv:`或`~`)设置内联查询。

### 使用JavaScript API


你可以在任意笔记中使用下列语法创建JS dataview代码块：

~~~
```dataviewjs
... js code ...
```
~~~

在JS dataview代码块里，你可以通过`dv`变量访问所有dataview的API。关于你能用它做什么，见[API文档](/docs/api/code-reference)，或[API实例](/docs/api/code-example)。