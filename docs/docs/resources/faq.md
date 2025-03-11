# Frequently Asked Questions

A collection of frequently asked questions for Dataview queries and the expression language.

### How do I use fields with the same name as keywords (like "from", "where")?

Dataview provides a special "fake" field called `row` which can be indexed into to obtain fields which conflict with
Dataview keywords:

```javascript
row.from /* Same as "from" */
row.where /* Same as "where" */
```


### How do I access fields with spaces in the name?

There are two ways:

1. Use the normalized Dataview name for such a field - just convert the name to lowercase and replace whitespace with
   dashes ("-"). Something like `Field With Space In It` becomes `field-with-space-in-it`.
2. Use the implicit `row` field:
    ```javascript
    row["Field With Space In It"]
    ```

### Do you have a list of resources to learn from?

Yes! Please see the [Resources](../resources/resources-and-support.md) page.

### Can I save the result of a query for reusability?

You can write reusable Javascript Queries with the [dv.view](../api/code-reference.md#dvviewpath-input) function. In DQL, beside the possibility of writing your Query inside a Template and using this template (either with the [Core Plugin Templates](https://help.obsidian.md/Plugins/Templates) or the popular Community Plugin [Templater](https://obsidian.md/plugins?id=templater-obsidian)), you can **save calculations in metadata fields via [Inline DQL](../queries/dql-js-inline.md#inline-dql)**, for example:

```markdown
start:: 07h00m
end:: 18h00m
pause:: 01h30m
duration:: `= this.end - this.start - this.pause`
```

You can list the value (9h 30m in our example) then i.e. in a TABLE without needing to repeat the calculation:

~~~markdown
```dataview
TABLE start, end, duration
WHERE duration
```
~~~

Gives you

| File (1)	| start| 	end| 	duration|
| ---- | ----- | ------ |  ----- |
| Example | 7 hours	| 18 hours| 	9 hours, 30 minutes |

**But storing a Inline DQL in a field comes with a limitation**: While the value that gets displayed in the result is the calculated one, **the saved value inside your metadata field is still your Inline DQL calculation**. The value is literally `= this.end - this.start - this.pause`. This means you cannot filter for the Inlines' result like:

~~~markdown
```dataview
TABLE start, end, duration
WHERE duration > dur("10h")
```
~~~

This will give you back the example page, even though the result doesn't fulfill the `WHERE` clause, because the value you are comparing against is `= this.end - this.start - this.pause` and is not a duration.

### How can I hide the result count on TABLE Queries?

With Dataview 0.5.52, you can hide the result count on TABLE and TASK Queries via a setting. Go to Dataview's settings -> Display result count.

### How can I style my queries?

You can use [CSS Snippets](https://help.obsidian.md/Extending+Obsidian/CSS+snippets) to define custom styling in general for Obsidian. So if you define `cssclasses: myTable` as a property, and enable the snippet below you could set the background color of a table from dataview. Similar to target the outer &lt;ul&gt; of a `TASK` or `LIST` query, you could use the `ul.contains-task-list` or `ul.list-view-ul` respectively.

```css
.myTable dataview.table {
    background-color: green
}
```

In general there are no unique ID's given to a specific table on a page, so the mentioned targeting applies to any note having that `cssclasses` defined and **all** tables on that page. Currently you can't target a specific table using an ordinary query, but if you're using javascript, you can add the class `clsname` directly to your query result by doing:

```js
dv.container.className += ' clsname'
```

However, there is a trick to target any table within Obsidian using tags like in the example below, and that would apply to any table having that tag tag within it. This would apply to both manually and dataview generated tables. To make the snippet below work add the tag `#myId` _anywhere_ within your table output.

```css
[href="#myId"] {
    display: none; /* Hides the tag from the table view */
}

table:has([href="#myId"]) {
   /* Style your table as you like */
  background-color: #262626;
  & tr:nth-child(even) td:first-child{
    background-color: #3f3f3f;
  }
}
```

Which would end up having a grey background on the entire table, and the first cell in every even row a different variant of grey. **Disclaimer:** We're not style gurus, so this is just an example to show some of the syntax needed for styling different parts of a table.

Furthermore, in [Style dataview table columns](https://s-blu.github.io/obsidian_dataview_example_vault/20%20Dataview%20Queries/Style%20dataview%20table%20columns/) @s-blu describes an alternate trick using `<span>` to style various parts of table cells (and columns).
