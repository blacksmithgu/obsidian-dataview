# Adding Metadata to your Pages

Dataview cannot query all content of your vault. In order to be able to search, filter and display content, this content needs to be **indexed**. Some content is indexed automatically, like bullet points or task lists - so called **Implicit fields**, more on that below - and other data needs to be saved in a metadata **field** to be accessible through dataview. 

## What is a "field"?

A metadata field is a pair of a **key** and a **value**. The _value_ of a field has a data type (more on that [here](./types-of-metadata.md)) that determines how this field will behave when querying it. 

You can add any number of fields to a **note**, a **list item** or a **task**. 

## How do I add fields?

You can add fields to a **note** in three different ways. How a field look like depends on the way you add it.

On **tasks or list items**, you will have YAML Frontmatter information available, but won't be able to add them to a specific list item. If you want to add metadata to one list item or task only, use [Inline Fields](#inline-fields).

### Frontmatter

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

- `alias` is a [text](types-of-metadata.md#text), because its wrapped in ""
- `last-reviewed` is a [date](types-of-metadata.md#date), because it follows the ISO date format
- `thoughts` is a [object](types-of-metadata.md#object) field, because it uses the YAML Frontmatter object syntax

You could query for this note with the following query:

~~~
```dataview
LIST
WHERE thoughts.rating = 8
```
~~~

### Inline Fields

For those wanting a more natural-looking annotation, Dataview supports "inline" fields via a `Key:: Value` syntax that you can use everywhere in your file. This allows you to write your queryable data right where you need it - for example in the middle of a sentence. 

If your inline field has an own line, without any content beforehand, you can write it like this: 

```markdown
# Markdown Page

Basic Field:: Some random Value
**Bold Field**:: Nice!
```

All content after the `::` is the value of the field until the next line break.

!!! hint "Mind the `::`"
    Note that you need to use a double colon `::` between key and value when using inline fields, contrary to YAML Frontmatter fields where one colon is enough. 

If you want to embed metadata inside sentences, or multiple fields on the same line, you can use the bracket syntax and wrap your field in square brackets:

```markdown
I would rate this a [rating:: 9]! It was [mood:: acceptable].
```

!!! info "Fields on list items and tasks"
    When you want to annotate a list item, e.g. a task, with metadata, you always need to use the bracket syntax (because the field is not the only information in this line)
    ```markdown
    - [ ] Send an mail to David about the deadline [due:: 2022-04-05].
    ```
    Bracketed inline fields are the only way to explicitly add fields to specific list items, YAML frontmatter always applies to the whole page (but is also available in context of list items.)

There is also the alternative parenthesis syntax, which hides the key when
rendered in Reader mode:

```markdown
This will not show the (longKeyIDontNeedWhenReading:: key).
```

will render to:

```markdown
This will not show the key.
```

You can use YAML Frontmatter and Inline fields with all syntax variants together in one file. You do not need to decide for one and can mix them to fit your workflow.

## Field names

Imagine you used all the examples for Inline fields you see above in one note, then following metadata would be available to you:

| Metadata Key | Sanitized Metadata key | Value | Data Type of Value |
| ----------- | ------------------------|----------- | ----------- |
| `Basic Field` | `basic-field`  | Some random Value | Text |
| `Bold Field` | `bold-field`  | Nice! | Text |
| `rating` | - | 9 | Number |
| `mood` | - | acceptable | Text |
| `due` | - | Date Object for 2022-04-05 | Date |
| `longKeyIDontNeedWhenReading` | `longkeyidontneedwhenreading` | key | Text |

Like you can see in the table, if you are using **spaces or capitalized letters** in your metadata key name, dataview will provide you with a **sanitized version** of the key. 

**Keys with spaces** cannot be used in a query as-is. You have two possibilities here: Either use the sanitized name, that is always all lowercase and with dashes instead of spaces or use the **row** variable syntax. Find out more [in the FAQ](../resources/faq.md).

**Keys with capitalized letters** can be used as-is, if you wish. The sanitized version allows you to query for a key independent of its capitalization and makes it easier to use: You can query the same field that's, for example, in one file named `someMetadata` and in another `someMetaData` when using the sanitized key `somemetadata`. 

In addition, the **bold field key is missing its formatting tokens**. Even though the `**` used to make it appear bold are part of the key name in the file, they are left out when indexing your note. The same goes for all other built-in formatting, like strike through or italic. This means formatted keys can only be queried without their formatting. This allows you to format the key in context of the note without worrying that you might create different keys for the same type of information. 

### Usage of emojis and non-latin characters

You are not limited to latin characters when naming your metadata fields. You can use all characters available in UTF-8:

```markdown
Noël:: Un jeu de console
クリスマス:: 家庭用ゲーム機
[🎅:: a console game]
[xmas🎄:: a console game]
```

**Using emojis as metadata keys** is possible, but it comes with some limitations. When using emojis in field names, you need to put them into square brackets so that dataview recognize them correctly. 
Also, please be aware when switching the OS (i.e. from Windows to Android), the same emoji could use another character code and you might not find your metadata when querying it.

!!! info "Task Field Shorthands"
    An exception to this are the [shorthand syntax](./metadata-tasks.md#field-shorthands) in Tasks. You can use shorthands without bracketing. Please mind though that this only counts for listed shorthands - every other field (if with emojis or not) need to use the `[key:: value]` syntax.

## Implicit fields

Even if you do not add any metadata explicitly to your note, dataview provides you with a big amount of indexed data out of the box. Some examples for implicit fields are:

- day the file was created (`file.cday`)
- links in the file (`file.outlinks`)
- tags in the file (`file.etags`)
- all list items in the file (`file.lists` and `file.tasks`)

and many more. Available implicit fields differ depending if you look at a page or a list item. Find the full list of available implicit fields on [Metadata on pages](metadata-pages.md) and [Metadata on Tasks and Lists](metadata-tasks.md).
