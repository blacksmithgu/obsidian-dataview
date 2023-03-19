# Sources

A dataview **source** is something that identifies a set of files, tasks, or other data. Sources are indexed internally by
Dataview, so they are fast to query. The most prominent use of sources is the [FROM data command](../queries#from). They are also used in various JavaScript API query calls.

## Types of Sources

Dataview currently supports **four source types**.

### Tags

Sources of the form `#tag`. These match all files / sections / tasks with the given tag.

~~~
```dataview
LIST
FROM #homework
```
~~~

### Folders

Sources of the form `"folder"`. These match all files / sections / tasks contained in the given folder and its sub folders. The full vault path is expected instead of just the folder name. Note that trailing slashes are not supported, i.e. `"Path/To/Folder/"` will not work but `"Path/To/Folder"` will.

~~~
```dataview
TABLE file.ctime, status
FROM "projects/brainstorming"
```
~~~


### Specific Files

You can select from a specific file by specifying it's full path: `"folder/File"`.

- If you have both a file and a folder with the exact same path, Dataview will prefer the folder. You can force it to read from the file by specifying an extension: `folder/File.md`.

~~~
```dataview
LIST WITHOUT ID next-in-line
FROM "30 Hobbies/Games/Dashboard"
```
~~~


### Links

 You can either select links **to** a file, or all links **from** a file.
 
- To obtain all pages which link **to** `[[note]]`, use `[[note]]`.
- To obtain all pages which link **from** `[[note]]` (i.e., all the links in that file), use `outgoing([[note]])`.
- You can implicitly reference the current file via `[[#]]` or `[[]]`, i.e. `[[]]` lets you query from all files linking to the current file.

~~~
```dataview
LIST
FROM [[]]
```

```dataview
LIST
FROM outgoing([[Dashboard]])
```
~~~


## Combining Sources

You can compose these filters in order to get more advanced sources using `and` and `or`.

- For example, `#tag and "folder"` will return all pages in `folder` and with `#tag`.
- Querying from `#food and !#fastfood` will only return pages that contain `#food` but does not contain `#fastfood`.
- `[[Food]] or [[Exercise]]` will give any pages which link to `[[Food]]` OR `[[Exercise]]`.

If you have complex queries where grouping or precedence matters, you can use parenthesis to logically group them:

- `#tag and ("folder" or #other-tag)`
- `(#tag1 or #tag2) and (#tag3 or #tag4)`


