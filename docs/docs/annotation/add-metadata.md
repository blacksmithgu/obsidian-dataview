# Adding metadata to your pages

Dataview is a data index first and foremost, so it supports relatively rich ways of adding metadata to your knowledge
base. Dataview tracks information at the *markdown page* and *markdown task* levels, where each page/task can have an
arbitrary amount of complex (numbers, objects, lists) *fields* associated with it. Each *field* is a named value with
a certain type (like "number" or "text"). Read more about types [here](./types-of-metadata.md).

To make information available in dataview queries, you need to store this information in fields. All fields you add to a page (a note in your vault) can be later accessed when writing dataview queries. 

You can add fields to a markdown page in three different ways.

## Frontmatter

Frontmatter is a common Markdown extension which allows for YAML metadata to be added to the top of a page. All YAML fields will be available as Dataview fields:
    ```yaml
    ---
    alias: "document"
    last-reviewed: 2021-08-17
    thoughts:
      rating: 8
      reviewable: false
    ---
    ```
## Inline Fields

For those wanting a more natural-looking annotation, Dataview supports "inline" fields, which
   offer a simple `Key:: Value` syntax that you can embed directly in your file:
    ```markdown
    # Markdown Page

    Basic Field:: Value
    **Bold Field**:: Nice!
    ```
    If you want to embed metadata inside sentences, or multiple fields on the same line, you can use the bracket syntax:
    ```markdown
    I would rate this a [rating:: 9]! It was [mood:: acceptable].
    ```
    There is also the alternative parenthesis syntax, which is functionally similar to brackets but hides the key when
    rendered in Reader mode:
    ```markdown
    This will not show the (very long key:: key).
    ```

## Implicit
 Dataview annotates pages and tasks with a large amount of metadata automatically, like the day the file was
   created (`file.cday`), any associated dates (`file.day`), links in the file (`file.outlinks`), tags (`file.tags`),
   and so on.