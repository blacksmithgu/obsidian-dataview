---
sidebar_position: 1
---

# Introduction

Dataview is an advanced query engine / index for generating dynamic views of the data in your knowledge base. You can
collect pages by tags, folders, contents, or *fields*, which are arbitrary values associated with pages. A typical
page using dataview might look something like this:

```
# Daily Retrospective

#daily

Date:: 2020-08-15
Rating:: 7.5
Woke Up:: 10:30am
Slept:: 12:30am
```

If you have many such pages, you could easily create a table via

```
table date, rating, woke-up, slept FROM #daily
```

which would produce nice looking table like so:

![](/images/daily-retro-example-table.png)

You could then filter this view to show only days with a high rating; or sort days by their rating or the time you woke
up, and so on so forth.