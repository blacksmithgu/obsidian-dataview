# Sources

A dataview "source" is something that identifies a set of files, tasks, or other data object. Sources are indexed internally by
Dataview, so they are fast to query. Dataview currently supports three source types:

1. **Tags**: Sources of the form `#tag`.
2. **Folders**: Sources of the form `"folder"`.
3. **Specific Files**: You can select from a specific file by specifying it's full path: `"folder/File"`.
  - If you have both a file and a folder with the exact same path, Dataview will prefer the folder. You can force
    it to read from the file by specifying markdown: `folder/File.md`.
3. **Links**: You can either select links TO a file, or all links FROM a file.
  - To obtain all pages which link TO `[[note]]`, use `[[note]]`; you can use `[[]]` to reference the current file.
  - To obtain all pages which link FROM `[[note]]` (i.e., all the links in that file), use `outgoing([[note]])`.
  - `[[#]]` and `[[]]` means "this file" 

You can compose these filters in order to get more advanced sources using `and` and `or`.

- For example, `#tag and "folder"` will return all pages in `folder` and with `#tag`.
- Querying from `#food and !#fastfood` will only return pages that contain `#food` but does not contain `#fastfood`.
- `[[Food]] or [[Exercise]]` will give any pages which link to `[[Food]]` OR `[[Exercise]]`.

Sources are used in both the [FROM query statement](../queries#from), as well as various JavaScript API query calls. 
