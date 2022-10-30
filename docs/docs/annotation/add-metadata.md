# Adding Metadata to your Pages

Dataview cannot query all content of your vault. In order to be able to search, filter and display content, this content needs to be **indexed**. Some content is indexed automatically, like bullet points or task lists - so called **Implicit fields**, more on that below - and other data needs to be saved in a metadata **field** to be accessible through dataview. 

## What is a "field"?

A metadata field is a pair of a **key** and a **value**. The _value_ of a field has a data type (more on that [here](./types-of-metadata.md)) that determines how this field will behave when querying it. 

You can add any number of fields to a **note**, a **list item** or a **task**. 


## How does a field look like? How do I add fields?

You can add fields to a **note** in three different ways. How a field look like depends on the way you add it.

## Frontmatter

Frontmatter is a common Markdown extension which allows for YAML metadata to be added to the top of a page. It is natively supported by Obsidian and explained in its [official documentation](https://help.obsidian.md/Advanced+topics/YAML+front+matter). All YAML Frontmatter fields will be automatically available as Dataview fields.

```yaml
    ---
    alias: "document"
    last-reviewed: 2021-08-17
    thoughts:
      rating: 8
      reviewable: false
    ---
```

With this your note has metadata fields named `alias`, `last-reviewed`, and `thoughts`. Each of these have different **data types**:

- `alias` is a [text](./types-of-metadata/#text), because its wrapped in ""
- `last-reviewed` a [date](./types-of-metadata/#date), because it follows the ISO date format
- `thoughts` a [object](./types-of-metadata/#object) field, because it uses the [YAML Frontmatter object syntax]() TODO link is missing, is this somewhere documented?

You could i.e. query for this note with the following query, because `thoughts` is a object with the value `rating`:

~~~
```dataview
LIST
WHERE thoughts.rating = 8
```
~~~

## Inline Fields

For those wanting a more natural-looking annotation, Dataview supports "inline" fields via a `Key:: Value` syntax that you can use everywhere in your file. This allows you do write your queryable data right where you need it - for example in the middle of a sentence. 

If your inline field has an own line, without any content beforehand, you can write it like this: 

```markdown
# Markdown Page

Basic Field:: Value
**Bold Field**:: Nice!
```

!!! hint 
    Note that you need to use a double colon `::` between key and value when using inline fields, contrary to YAML Frontmatter fields where one colon is enough. 


If you want to embed metadata inside sentences, or multiple fields on the same line, you can use the bracket syntax and wrap your field in square brackets:

```markdown
I would rate this a [rating:: 9]! It was [mood:: acceptable].
```

!!! info "Inline fields on list items and tasks"
    When you want to annotate a list item, e.g. a task, with meta data, you always need to use the bracket syntax (because the field is not the only information in this line)

There is also the alternative parenthesis syntax, which hides the key when
rendered in Reader mode:

```markdown
This will not show the (very long key:: key).
```

TODO example what is available now and how to query it

## Field names

TODO sanitized values for bold, camelcase and spaces

## Implicit TODO
 Dataview annotates pages and tasks with a large amount of metadata automatically, like the day the file was
   created (`file.cday`), any associated dates (`file.day`), links in the file (`file.outlinks`), tags (`file.tags`),
   and so on. Find the full list on [Metadata on pages](metadata-pages.md) and [Metadata on Tasks and Lists](metadata-tasks.md).