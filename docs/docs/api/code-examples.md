---
sidebar_position: 4
---
# Codeblock Examples

## Grouped Books

Group your books by genre, then create a table for each sorted by rating:

```
for (let group of dv.pages("#book").groupBy(p => p.genre)) {
	dv.header(3, group.key);
	dv.table(["Name", "Time Read", "Rating"],
		group.rows
			.sort(k => k.rating, 'desc')
			.map(k => [k.file.link, k["time-read"], k.rating]))
}
```

![Grouped Books Example](/assets/grouped-book-example.png)
