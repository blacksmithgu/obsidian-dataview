---
sidebar_position: 4
---
# 代码块示例

## 书籍分组

按体裁对你的书籍进行分组，然后为每本书创建一个按评级分类的表格。

```
for (let group of dv.pages("#book").groupBy(p => p.genre)) {
	dv.header(3, group.key);
	dv.table(["Name", "Time Read", "Rating"],
		group.rows
			.sort(k => k.rating, 'desc')
			.map(k => [k.file.link, k["time-read"], k.rating]))
}
```

![Grouped Books Example](/images/grouped-book-example.png)