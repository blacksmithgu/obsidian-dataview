# Developing Against Dataview

Dataview includes a high-level plugin-facing API as well as TypeScript definitions and a utility library; to install it,
simply use:

```bash
npm install -D obsidian-dataview
```

To verify that it is the correct version installed, do `npm list obsidian-dataview`. If that fails to report the latest version, which currently is 0.5.64, you can do:

```bash
npm install obsidian-dataview@0.5.64
```

**Note**: If [Git](http://git-scm.com/) is not already installed on your local system, you will need to install it first. You may need to restart your device to complete the Git installation before you can install the Dataview API.

##### Accessing the Dataview API

You can use the `getAPI()` function to obtain the Dataview Plugin API; this returns a `DataviewApi` object which
provides various utilities, including rendering dataviews, checking dataview's version, hooking into the dataview event
life cycle, and querying dataview metadata.

```ts
import { getAPI } from "obsidian-dataview";

const api = getAPI();
```

For full API definitions available, check
[index.ts](https://github.com/blacksmithgu/obsidian-dataview/blob/master/src/index.ts) or the plugin API definition [plugin-api.ts](https://github.com/blacksmithgu/obsidian-dataview/blob/master/src/api/plugin-api.ts).

##### Binding to Dataview Events

You can bind to dataview metadata events, which fire on all file updates and changes, via:


```ts
plugin.registerEvent(plugin.app.metadataCache.on("dataview:index-ready", () => {
    ...
});

plugin.registerEvent(plugin.app.metadataCache.on("dataview:metadata-change",
    (type, file, oldPath?) => { ... }));
```

For all events hooked on MetadataCache, check [index.ts](https://github.com/blacksmithgu/obsidian-dataview/blob/master/src/index.ts).

##### Value Utilities

You can access various type utilities which let you check the types of objects and compare them via `Values`:

~~~ts
import { getAPI, Values } from "obsidian-dataview";

const field = getAPI(plugin.app)?.page('sample.md').field;
if (!field) return;

if (Values.isHtml(field)) // do something
else if (Values.isLink(field)) // do something
// ...
~~~
