# Developing Against Dataview

Dataview includes a high-level plugin-facing API as well as TypeScript definitions and a utility library; to set it up
for your plugin, follow these steps:

1. Install the utility library and types via `npm install -D obsidian-dataview` in your plugin directory.
2. Create a types file `types.d.ts`, with the contents below, which adds some dataview-related event typings and
   provides access to `app.plugins`:

    ~~~ts
    import "obsidian";
    import { DataviewApi } from "obsidian-dataview";

    declare module "obsidian" {
      interface App {
        plugins: {
          enabledPlugins: Set<string>;
          plugins: {
            [id: string]: any;
            dataview?: {
              api?: DataviewApi;
            };
          };
        };
      }
      interface MetadataCache {
        on(
          name: "dataview:api-ready",
          callback: (api: DataviewPlugin["api"]) => any,
          ctx?: any
        ): EventRef;
        on(
          name: "dataview:metadata-change",
          callback: (
            ...args:
              | [op: "rename", file: TAbstractFile, oldPath: string]
              | [op: "delete", file: TFile]
              | [op: "update", file: TFile]
          ) => any,
          ctx?: any
        ): EventRef;
      }
    }
    ~~~

Following these steps will allow you to access Dataview in a typed way, including doing things such as:

- **Checking if Dataview is enabled**: `plugin.app.enabledPlugins.has("dataview")`.
- **Accessing the Dataview API**: `plugin.app.plugins.dataview?.api`.
- **Bind to Dataview events**: `plugin.registerEvent(plugin.app.metadataCache.on("dataview:...", (...) => ...))`.

## Using the Dataview API Programatically

The Dataview API takes a short amount of time to initialize before being available (during which it may be `undefined`
or in an unknown state). To ensure the API is available, you can wait on the metadata cache `dataview:api-ready` event,
such as in the idiom below:

~~~ts
async onload() {
  const doSomethingWith = (api: DataviewPlugin["api"]) => {
    // do something
  };

  if (this.app.enabledPlugins.has("dataview")) {
    const api = this.app.plugins.dataview?.api;
    if (api) doSomethingWith(api);
    else
      this.registerEvent(
        this.app.metadataCache.on("dataview:api-ready", (api) =>
          doSomethingWith(api)
        )
      );
  }
}
~~~

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
