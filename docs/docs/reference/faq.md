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

Yes! Please see the [Resources](../resources-and-support.md) page.
