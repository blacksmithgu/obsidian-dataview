---
sidebar_position: 5
---
# 示例

一个简单的dataview查询语言使用的小集合。

---

利用一些元数据，显示所有games文件夹下的文件，按评分排序：

~~~
```dataview
TABLE time-played, length, rating FROM "games"
SORT rating DESC
```
~~~

![Game Example](/images/game.png)

---

列表列举所有MOBA游戏或CRPG游戏：

~~~
```dataview
LIST FROM #game/moba or #game/crpg
```
~~~

![Game List](/images/game-list.png)

---

任务列表列举所有未完成项目的

~~~
```dataview
TASK FROM #projects/active
```
~~~

![Task List](/images/project-task.png)

---

表格列举所有在`books`文件夹下的文件，按最后编辑时间排序：

~~~
```dataview
TABLE file.mtime FROM "books"
SORT file.mtime DESC
```
~~~

---

列表列举所有标题中有日期的文件(格式为`yyyy-mm-dd`)，按日期排序：

~~~
```dataview
LIST file.day WHERE file.day
SORT file.day DESC
```
~~~