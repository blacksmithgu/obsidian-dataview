# Introduction

Dataview is an advanced query engine / index for generating dynamic views of the data in your knowledge base. You can
collect pages by tags, folders, contents, or *fields*, which are arbitrary values associated with pages. A typical
page using dataview might look something like this:

``` md
# Daily Retrospective

#daily

Date:: 2020-08-15
Rating:: 7.5
Woke Up:: 10:30am
Slept:: 12:30am
```

If you have many such pages, you could easily create a table via

``` sql
TABLE 
  date AS "Date", 
  rating AS "Rating",
  woke-up AS "Woke Up",
  slept AS "Slept"
FROM #daily
```

which would produce a nice looking table like so:

|File|Date|Rating|Woke Up|Slept|
|-|-|-|-|-|
|[Daily Retro - 2020-08-15](#)|Sat, Aug 15, 2020|7.5|10:30am|12:30am|
|[Daily Retro - 2020-08-17](#)|Mon, Aug 17, 2020|5|7:30am|9:30pm|
|[Daily Retro - 2020-08-20](#)|Thu, Aug 20, 2020|9|11:30am|1:30am|

You could then filter this view to show only days with a high rating; or sort days by their rating or the time you woke
up, and so on so forth.
