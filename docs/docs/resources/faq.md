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

You can write reusable Javascript Queries with the [dv.view](../../api/code-reference/#dvviewpath-input) function. In DQL, beside the possibility of writing your Query inside a Template and using this template (either with the [Core Plugin Templates](https://help.obsidian.md/Plugins/Templates) or the popular Community Plugin [Templater](https://obsidian.md/plugins?id=templater-obsidian)), you can **save calculations in metadata fields via [Inline DQL](../../queries/dql-js-inline#inline-dql)**, for example:

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