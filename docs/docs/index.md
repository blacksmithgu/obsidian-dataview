# Overview

Dataview is a live index and query engine over your knowledge base. You can associate *data* (like tags, dates,
snippets, numbers, and so on) with your markdown pages, and then *query* (like filter, sort, transform) this data. This
is a simple but powerful idea:

- Track sleep schedules and habits by recording them in daily notes, and automatically create weekly tables of your
  sleep schedule.
- Automatically collect links to books in your notes, and render them all sorted by rating.
- Automatically collect pages annotated with a given date, showing them in your daily note or elsewhere.
- Find pages with no tags for follow-up, or show pretty views of specifically-tagged pages.
- Create dynamic views which show upcoming birthdays or events, annotated with notes.

Dataview is highly generic and high performance, scaling up to hundreds of thousands of annotated notes without
issue. If the built in [query language](query/queries/) is insufficient for your purpose, you can run arbitrary
JavaScript against the [dataview API](api/intro/).

## Basic Usage

Dataview has two major components: *annotation* and *querying*. Each operates largely independently and are described below.

#### Annotation

The dataview **index** is responsible for constantly parsing markdown files and other metadata in your vault, creating
an in-memory index which allows for fast queries over your data. Annotation is done at the *markdown page*, *section*,
and *task* level, where you can either use:

1. **Frontmatter**, a common Markdown extension which allows for adding arbitrary YAML at the top of a document):
    ```yaml
    ---
    alias: "document"
    last-reviewed: 2021-08-17
    thoughts:
      rating: 8
      reviewable: false
    ---
    ```
2. **Inline Fields**, a Dataview-specific way to provide metadata in an intuitive `Key:: Value` syntax:
    ```markdown
    # Markdown Page

    Some text, and then [Inline Field:: Value] [Another Inline Field On The Same Line:: With A New Value!]

    Basic Field:: Value
    **Bold Field**:: Nice!

    - [ ] I am a task with [metadata::value]!
      - [X] I am another task with completed::2020-09-15
    ```

You can combine both methods if desired. Dataview also adds a significant number
of "implicit" fields, like `file.name` for the file name, `file.size` for the
size, and so on; you can find more details in the [data annotation documentation](data-annotation).

#### Querying

Once you have some pages that you've annotated, all that's left to do is query them to create dynamic table, list, or
JavaScript views. There are four ways to do this:

1. **Dataview Query Language (DQL)**: A pipeline-based, vaguely SQL-looking expression language which can support basic
   use cases. See the [guide](writing-dql) for an overview of how to use DQL, or check out the [reference material](query/queries/) for details.

    ~~~markdown
    ```dataview
    TABLE file.name AS "File", rating AS "Rating" FROM #book
    ```
    ~~~

2. **Inline Expressions**: DQL expressions which you can embed directly inside markdown and which will be evaluated in
   preview mode. See the [documentation](query/expressions/) for
   allowable queries.

    ```markdown
    We are on page `= this.file.name`.
    ```

3. **DataviewJS**: A high-powered JavaScript API which gives full access to the Dataview index and some convienent
   rendering utilities. Highly recommended if you know JavaScript, since this is far more powerful than the query
   language. Check the [documentation](api/intro/) for more details.

    ~~~markdown
    ```dataviewjs
    dv.taskList(dv.pages().file.tasks.where(t => !t.completed));
    ```
    ~~~

4. **Inline JS Expressions**: The JavaScript equivalent to inline expressions, which allow you to execute arbitary JS
   inline:

    ~~~markdown
    This page was last modified at `$= dv.current().file.mtime`.
    ~~~

## Resources and Help

See [getting started](./resources-and-support.md) for a list of resources and how to find support.