
```dataview
TABLE file.tables WHERE length(file.tables) > 0
```

```dataviewjs

const tables = dv.pages('"tables"').file.tables

// show table for the last 5 days
for (let table of tables) {
  dv.table(
    table.headers,
    table.rows
  )
}
```
