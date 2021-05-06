---
slug: 2021-05-05-whats-next
title: 0.3.0 & What's Next
author: Michael Brenan
author_title: Dataview Developer
author_url: https://github.com/blacksmithgu
author_image_url: https://avatars.githubusercontent.com/u/616490?v=4
tags: [release, roadmap]
---

Dataview has been quiet for a few weeks, and the bugs have been piling on - worry not, I am not dead yet! This release
of Dataview includes the first pass at the Dataview JS API, which allows you to directly query and manipulate data from
JavaScript, as well as create more complex HTML views! You can read the full docs [here](/docs/api/intro), but the short
of it is that you can now create DataviewJS blocks via the `dataviewjs` code block - as here, for example:

~~~
```dataviewjs
dv.table(["Name", "Genre", "Time Read", "Rating"],
    dv.pages("#book").map(p => [p.file.link, p.genre, p["time-read"], p.rating]));
```
~~~

Simple tables and lists are likely to look more verbose than the more compact query language, but the true power in the
JS API is that it enables much more complex filtering, analysis, and grouping. For example, you can now create multiple
tables, grouped by genre:

~~~
```dataviewjs
for (let entry of dv.pages("#book").groupBy(p => p.genre)) {
    dv.header(entry.key);
    dv.table(["Name", "Time Read", "Rating"],
        entry.rows.map(p => [p.file.link, p["time-read"], p.rating]))
}
```
~~~

Or filter by much more complex criteria:

~~~
```dataviewjs
function complex(value) {
    return Math.sin(value) > Math.cos(value);
}

let pages = dv.pages().where(complex);
...
```
~~~

The JS API is likely to be ahead in functionality of the query language, which I will continue to support but which will
likely be strictly less powerful. Currently, only the inline API is functional - an API which other plugins can easily
interface with will be arriving shortly (since most of the code is shared anyway).

#### What's Next

I'll focusing on improving the JavaScript API in the very short term, but after that, the features I'm looking at:

- Finally fix query language `TASK` queries!
- Add page sections to the index, and allow querying them.
- Allow embedding of pages, sections, and so on in a dataview.
- Fix some notable UX issues:
    - Allow disabling the 'File' column in table views.
    - Fix Obsidian slowdowns with huge markdown files, or thousands of markdown files.
    - Add various requested utility functions to the query language.