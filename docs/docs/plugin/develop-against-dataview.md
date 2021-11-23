# Developing Against Dataview

Dataview includes a high-level plugin-facing API as well as TypeScript definitions and a utility library; to set it up
for your plugin, follow these steps:

1. Install the utility library and types via `npm install -D obsidian-dataview` in your plugin directory.
2. import utils to use Dataview API: `import { getAPI, isPluginEnabled } from "obsidian-dataview";`

Following these steps will allow you to access Dataview in a typed way, including doing things such as:

- **Checking if Dataview is enabled**: `isPluginEnabled(plugin.app)`.
- **Accessing the Dataview API**: `getAPI(plugin.app)` or just `getAPI()` (require version 0.4.22+), will return undefined if Dataview API is not available.
- **Check and compare Dataview API version**: use utils provided in [`api.ver`](../../../src/types/api.ts) (require version 0.4.22+)
- **Bind to Dataview events**: `plugin.registerEvent(plugin.app.metadataCache.on("dataview:...", (...) => ...))`.

> - For full API definitions available, check [api.ts](../../../src/types/api.ts)
> - For all events hooked on MetadataCache, check [index.ts](../../../src/index.ts)

## Value Utilities

You can access various type utilities which let you check the types of objects and compare them via `Values`:

~~~ts
import { Values } from "obsidian-dataview"

const field = plugin.app.plugins.dataview?.api.page('sample.md').field;
if (!field) return;

if (Values.isHtml(field)) // do something
else if (Values.isLink(field)) // do something
// ...
~~~
