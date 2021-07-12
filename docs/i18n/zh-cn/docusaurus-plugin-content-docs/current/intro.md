---
sidebar_position: 1
---

# 简介

Dataview 是一个在你的知识库中生成数据的动态视图的高级查询引擎/索引。你可以通过使用任意和页面相关联的值，如标签(tag)，文件夹(folder)，
内容(content)，或者字段(field)来生成视图。一个使用dataview的页面一般像这样：
```
# Daily Retrospective

#daily

Date:: 2020-08-15
Rating:: 7.5
Woke Up:: 10:30am
Slept:: 12:30am
```

如果你有许多这样的页面，你可以通过下述代码轻松的创建一个表格：

```
table date, rating, woke-up, slept FROM #daily
```

这将会生成一个像这样好看的表格：

![](/images/daily-retro-example-table.png)

你还可以通过过滤这个视图，仅展示高评分(rating)的一天；或者按评分对每天进行排序，亦或者按醒来的时间进行排序，诸如此类。