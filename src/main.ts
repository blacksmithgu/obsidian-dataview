import {
    MarkdownRenderChild,
    Plugin,
    Vault,
    MarkdownPostProcessorContext,
    PluginSettingTab,
    App,
    Setting,
    Component,
} from "obsidian";
import { renderErrorPre, renderList, renderTable, renderValue } from "ui/render";
import { FullIndex } from "data/index";
import * as Tasks from "ui/tasks";
import { ListQuery, Query, TableQuery } from "query/query";
import { Field } from "expression/field";
import { parseField } from "expression/parse";
import { parseQuery } from "query/parse";
import { executeInline, executeList, executeTable, executeTask } from "query/engine";
import { asyncTryOrPropogate, canonicalizeVarName, tryOrPropogate } from "util/normalize";
import { asyncEvalInContext, makeApiContext } from "api/inline-api";
import { DataviewApi } from "api/plugin-api";
import { DataviewSettings, DEFAULT_QUERY_SETTINGS, DEFAULT_SETTINGS, QuerySettings } from "settings";
import { Groupings, Link, LiteralValue, Task } from "data/value";
import { DateTime } from "luxon";
import { currentLocale } from "util/locale";
import { extractInlineFields, parseInlineValue } from "data/parse/inline-field";
import { API_NAME, DvAPIInterface } from "./typings/api";

const API_NAME: API_NAME extends keyof typeof window ? API_NAME : never = "DataviewAPI" as const; // this line will throw error if name out of sync

export default class DataviewPlugin extends Plugin {
    /** Plugin-wide default settigns. */
    public settings: DataviewSettings;

    /** The index that stores all dataview data. */
    public index: FullIndex;
    /** External-facing plugin API. */
    public api: DvAPIInterface;

    async onload() {
        // Settings initialization; write defaults first time around.
        this.settings = Object.assign(DEFAULT_SETTINGS, (await this.loadData()) ?? {});
        this.addSettingTab(new DataviewSettingsTab(this.app, this));

        this.index = FullIndex.create(this.app.vault, this.app.metadataCache);
        this.addChild(this.index);
        this.api = new DataviewApi(this.app, this.index, this.settings, this.manifest.version);

        // Register API to global window object.
        (window[API_NAME] = this.api) && this.register(() => delete window[API_NAME]);

        // Dataview query language code blocks.
        this.registerPriorityCodeblockPostProcessor("dataview", -100, async (source: string, el, ctx) =>
            this.dataview(source, el, ctx, ctx.sourcePath)
        );

        // DataviewJS codeblocks.
        this.registerPriorityCodeblockPostProcessor("dataviewjs", -100, async (source: string, el, ctx) =>
            this.dataviewjs(source, el, ctx, ctx.sourcePath)
        );

        // Dataview inline queries.
        this.registerPriorityMarkdownPostProcessor(-100, async (el, ctx) =>
            this.dataviewInline(el, ctx, ctx.sourcePath)
        );

        // Dataview inline-inline query fancy rendering. Runs at a low priority; should apply to Dataview views.
        this.registerPriorityMarkdownPostProcessor(100, async (el, ctx) => {
            // Allow for lame people to disable the pretty rendering.
            if (!this.settings.prettyRenderInlineFields) return;

            // Handle p, header elements explicitly (opt-in rather than opt-out for now).
            for (let p of el.findAllSelf("p,h1,h2,h3,h4,h5,h6,li,span,th,td"))
                await replaceInlineFields(ctx, p, ctx.sourcePath, this.settings);
        });

        // Run index initialization, which actually traverses the vault to index files.
        if (!this.app.workspace.layoutReady) {
            this.app.workspace.onLayoutReady(async () => this.index.initialize());
        } else {
            this.index.initialize();
        }

        // Not required anymore, though holding onto it for backwards-compatibility.
        this.app.metadataCache.trigger("dataview:api-ready", this.api);

        console.log(`Dataview: Version ${this.manifest.version} Loaded`);
    }

    onunload() {}

    /** Register a markdown post processor with the given priority. */
    public registerPriorityMarkdownPostProcessor(
        priority: number,
        processor: (el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>
    ) {
        let registered = this.registerMarkdownPostProcessor(processor);
        registered.sortOrder = priority;
    }

    /** Register a markdown codeblock post processor with the given priority. */
    public registerPriorityCodeblockPostProcessor(
        language: string,
        priority: number,
        processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>
    ) {
        let registered = this.registerMarkdownCodeBlockProcessor(language, processor);
        registered.sortOrder = priority;
    }

    /**
     * Based on the source, generate a dataview view. This works by doing an initial parsing pass, and then adding
     * a long-lived view object to the given component for life-cycle management.
     */
    public async dataview(
        source: string,
        el: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ) {
        let maybeQuery = tryOrPropogate(() => parseQuery(source));

        // In case of parse error, just render the error.
        if (!maybeQuery.successful) {
            renderErrorPre(el, "Dataview: " + maybeQuery.error);
            return;
        }

        let query = maybeQuery.value;
        switch (query.header.type) {
            case "task":
                component.addChild(
                    new DataviewTaskRenderer(query as Query, el, this.index, sourcePath, this.app.vault, this.settings)
                );
                break;
            case "list":
                component.addChild(new DataviewListRenderer(query as Query, el, this.index, sourcePath, this.settings));
                break;
            case "table":
                component.addChild(
                    new DataviewTableRenderer(query as Query, el, this.index, sourcePath, this.settings)
                );
                break;
        }
    }

    /** Generate a DataviewJS view running the given source in the given element. */
    public async dataviewjs(
        source: string,
        el: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ) {
        component.addChild(
            new DataviewJSRenderer(source, el, this.app, this.index, sourcePath, this.settings, this.manifest.version)
        );
    }

    /** Render all dataview inline expressions in the given element. */
    public async dataviewInline(
        el: HTMLElement,
        component: Component | MarkdownPostProcessorContext,
        sourcePath: string
    ) {
        // Search for <code> blocks inside this element; for each one, look for things of the form `= ...`.
        let codeblocks = el.querySelectorAll("code");
        for (let index = 0; index < codeblocks.length; index++) {
            let codeblock = codeblocks.item(index);

            let text = codeblock.innerText.trim();
            if (text.startsWith(this.settings.inlineJsQueryPrefix)) {
                let code = text.substring(this.settings.inlineJsQueryPrefix.length).trim();
                component.addChild(
                    new DataviewInlineJSRenderer(
                        code,
                        el,
                        codeblock,
                        this.app,
                        this.index,
                        sourcePath,
                        this.settings,
                        this.manifest.version
                    )
                );
            } else if (text.startsWith(this.settings.inlineQueryPrefix)) {
                let potentialField = text.substring(this.settings.inlineQueryPrefix.length).trim();

                let field = tryOrPropogate(() => parseField(potentialField));
                if (!field.successful) {
                    let errorBlock = el.createEl("div");
                    renderErrorPre(errorBlock, `Dataview (inline field '${potentialField}'): ${field.error}`);
                } else {
                    let fieldValue = field.value;
                    component.addChild(
                        new DataviewInlineRenderer(
                            fieldValue,
                            text,
                            el,
                            codeblock,
                            this.index,
                            sourcePath,
                            this.settings
                        )
                    );
                }
            }
        }
    }

    /** Update plugin settings. */
    async updateSettings(settings: Partial<DataviewSettings>) {
        Object.assign(this.settings, settings);
        await this.saveData(this.settings);
    }

    /** Call the given callback when the dataview API has initialized. */
    public withApi(callback: (api: DvAPIInterface) => void) {
        callback(this.api);
    }
}

/** All of the dataview settings in a single, nice tab. */
class DataviewSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: DataviewPlugin) {
        super(app, plugin);
    }

    public display(): void {
        this.containerEl.empty();
        this.containerEl.createEl("h2", { text: "General Settings" });

        new Setting(this.containerEl)
            .setName("Enable JavaScript Queries")
            .setDesc("Enable or disable executing DataviewJS queries.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.enableDataviewJs)
                    .onChange(async value => await this.plugin.updateSettings({ enableDataviewJs: value }))
            );

        new Setting(this.containerEl)
            .setName("Enable Inline JavaScript Queries")
            .setDesc(
                "Enable or disable executing inline DataviewJS queries. Requires that DataviewJS queries are enabled."
            )
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.enableInlineDataviewJs)
                    .onChange(async value => await this.plugin.updateSettings({ enableInlineDataviewJs: value }))
            );

        new Setting(this.containerEl)
            .setName("Enable Inline Field Highlighting")
            .setDesc("Enables or disables visual highlighting / pretty rendering for inline fields.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.prettyRenderInlineFields)
                    .onChange(async value => await this.plugin.updateSettings({ prettyRenderInlineFields: value }))
            );

        this.containerEl.createEl("h2", { text: "Codeblock Settings" });

        new Setting(this.containerEl)
            .setName("Inline Query Prefix")
            .setDesc("The prefix to inline queries (to mark them as Dataview queries). Defaults to '='.")
            .addText(text =>
                text
                    .setPlaceholder("=")
                    .setValue(this.plugin.settings.inlineQueryPrefix)
                    .onChange(async value => await this.plugin.updateSettings({ inlineQueryPrefix: value }))
            );

        new Setting(this.containerEl)
            .setName("JavaScript Inline Query Prefix")
            .setDesc("The prefix to JavaScript inline queries (to mark them as DataviewJS queries). Defaults to '$='.")
            .addText(text =>
                text
                    .setPlaceholder("$=")
                    .setValue(this.plugin.settings.inlineJsQueryPrefix)
                    .onChange(async value => await this.plugin.updateSettings({ inlineJsQueryPrefix: value }))
            );

        this.containerEl.createEl("h2", { text: "View Settings" });
        this.containerEl.createEl("h3", { text: "General" });

        new Setting(this.containerEl)
            .setName("Warn on Empty Result")
            .setDesc("If set, queries which return 0 results will render a warning message.")
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.warnOnEmptyResult).onChange(async value => {
                    await this.plugin.updateSettings({ warnOnEmptyResult: value });
                    this.plugin.index.touch();
                })
            );

        new Setting(this.containerEl)
            .setName("Render Null As")
            .setDesc("What null/non-existent should show up as in tables, by default. This supports Markdown notation.")
            .addText(text =>
                text
                    .setPlaceholder("-")
                    .setValue(this.plugin.settings.renderNullAs)
                    .onChange(async value => {
                        await this.plugin.updateSettings({ renderNullAs: value });
                        this.plugin.index.touch();
                    })
            );

        new Setting(this.containerEl)
            .setName("Automatic View Refreshing")
            .setDesc(
                "If enabled, views will automatically refresh when files in your vault change; this can negatively affect" +
                    " some functionality like embeds in views, so turn it off if such functionality is not working."
            )
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.refreshEnabled).onChange(async value => {
                    await this.plugin.updateSettings({ warnOnEmptyResult: value });
                    this.plugin.index.touch();
                })
            );

        new Setting(this.containerEl)
            .setName("Refresh Interval")
            .setDesc("How frequently views are updated (in milliseconds) in preview mode when files are changing.")
            .addText(text =>
                text
                    .setPlaceholder("500")
                    .setValue("" + this.plugin.settings.refreshInterval)
                    .onChange(async value => {
                        let parsed = parseInt(value);
                        if (isNaN(parsed)) return;
                        parsed = parsed < 100 ? 100 : parsed;
                        await this.plugin.updateSettings({ refreshInterval: parsed });
                    })
            );

        let dformat = new Setting(this.containerEl)
            .setName("Date Format")
            .setDesc(
                "The default date format (see Luxon date format options)." +
                    " Currently: " +
                    DateTime.now().toFormat(this.plugin.settings.defaultDateFormat, { locale: currentLocale() })
            )
            .addText(text =>
                text
                    .setPlaceholder(DEFAULT_QUERY_SETTINGS.defaultDateFormat)
                    .setValue(this.plugin.settings.defaultDateFormat)
                    .onChange(async value => {
                        dformat.setDesc(
                            "The default date format (see Luxon date format options)." +
                                " Currently: " +
                                DateTime.now().toFormat(value, { locale: currentLocale() })
                        );
                        await this.plugin.updateSettings({ defaultDateFormat: value });

                        this.plugin.index.touch();
                    })
            );

        let dtformat = new Setting(this.containerEl)
            .setName("Date + Time Format")
            .setDesc(
                "The default date and time format (see Luxon date format options)." +
                    " Currently: " +
                    DateTime.now().toFormat(this.plugin.settings.defaultDateTimeFormat, { locale: currentLocale() })
            )
            .addText(text =>
                text
                    .setPlaceholder(DEFAULT_QUERY_SETTINGS.defaultDateTimeFormat)
                    .setValue(this.plugin.settings.defaultDateTimeFormat)
                    .onChange(async value => {
                        dtformat.setDesc(
                            "The default date and time format (see Luxon date format options)." +
                                " Currently: " +
                                DateTime.now().toFormat(value, { locale: currentLocale() })
                        );
                        await this.plugin.updateSettings({ defaultDateTimeFormat: value });

                        this.plugin.index.touch();
                    })
            );

        this.containerEl.createEl("h3", { text: "Table Settings" });

        new Setting(this.containerEl)
            .setName("Primary Column Name")
            .setDesc(
                "The name of the default ID column in tables; this is the auto-generated first column that links to the source file."
            )
            .addText(text =>
                text
                    .setPlaceholder("File")
                    .setValue(this.plugin.settings.tableIdColumnName)
                    .onChange(async value => {
                        await this.plugin.updateSettings({ tableIdColumnName: value });
                        this.plugin.index.touch();
                    })
            );

        new Setting(this.containerEl)
            .setName("Grouped Column Name")
            .setDesc(
                "The name of the default ID column in tables, when the table is on grouped data; this is the auto-generated first column" +
                    "that links to the source file/group."
            )
            .addText(text =>
                text
                    .setPlaceholder("Group")
                    .setValue(this.plugin.settings.tableGroupColumnName)
                    .onChange(async value => {
                        await this.plugin.updateSettings({ tableGroupColumnName: value });
                        this.plugin.index.touch();
                    })
            );

        this.containerEl.createEl("h3", { text: "Task Settings" });

        new Setting(this.containerEl)
            .setName("Task Link Type")
            .setDesc("'Start' and 'End' place a symbol link in their respective location; 'None' disables linking.")
            .addDropdown(dropdown =>
                dropdown
                    .addOption("start", "Start")
                    .addOption("end", "End")
                    .addOption("none", "None")
                    .setValue(this.plugin.settings.taskLinkLocation)
                    .onChange(async value => {
                        await this.plugin.updateSettings({ taskLinkLocation: value as any });
                        this.plugin.index.touch();
                    })
            );

        new Setting(this.containerEl)
            .setName("Task Link Text")
            .setDesc("Text used when linking from a task to its source note in the 'Start' and 'End' link types.")
            .addText(text =>
                text.setValue(this.plugin.settings.taskLinkText).onChange(async value => {
                    await this.plugin.updateSettings({ taskLinkText: value.trim() });
                    this.plugin.index.touch();
                })
            );

        new Setting(this.containerEl)
            .setName("Automatic Task Completion Tracking")
            .setDesc(
                "If enabled, Dataview will automatically append tasks with their completion date when they are checked in Dataview views."
            )
            .addToggle(toggle =>
                toggle.setValue(this.plugin.settings.taskCompletionTracking).onChange(async value => {
                    await this.plugin.updateSettings({ taskCompletionTracking: value });
                })
            );

        new Setting(this.containerEl)
            .setName("Automatic Task Completion Field")
            .setDesc(
                "Text used as inline field key to track task completion date when toggling a task's checkbox in a dataview view."
            )
            .addText(text =>
                text.setValue(this.plugin.settings.taskCompletionText).onChange(async value => {
                    await this.plugin.updateSettings({ taskCompletionText: value.trim() });
                })
            );
    }
}

/** Renders a list dataview for the given query. */
class DataviewListRenderer extends MarkdownRenderChild {
    constructor(
        public query: Query,
        public container: HTMLElement,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        if (this.settings.refreshEnabled) {
            onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
                this.container.innerHTML = "";
                await this.render();
            });
        }
    }

    async render() {
        let maybeResult = await asyncTryOrPropogate(() =>
            executeList(this.query, this.index, this.origin, this.settings)
        );
        if (!maybeResult.successful) {
            renderErrorPre(this.container, "Dataview: " + maybeResult.error);
            return;
        } else if (maybeResult.value.data.length == 0 && this.settings.warnOnEmptyResult) {
            renderErrorPre(this.container, "Dataview: Query returned 0 results.");
            return;
        }

        let showId = (this.query.header as ListQuery).showId;
        let showValue = !!(this.query.header as ListQuery).format;

        let result = maybeResult.value;
        let rendered: LiteralValue[] = [];
        for (let row of result.data) {
            if (showValue && showId) {
                let span = document.createElement("span");
                await renderValue(row.primary, span, this.origin, this, this.settings, false, "list");
                span.appendText(": ");
                await renderValue(row.value || null, span, this.origin, this, this.settings, true, "list");

                rendered.push(span);
            } else if (showId) {
                rendered.push(row.primary);
            } else if (showValue) {
                rendered.push(row.value || null);
            }
        }

        await renderList(this.container, rendered, this, this.origin, this.settings);
    }
}

class DataviewTableRenderer extends MarkdownRenderChild {
    constructor(
        public query: Query,
        public container: HTMLElement,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        if (this.settings.refreshEnabled) {
            onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
                this.container.innerHTML = "";
                await this.render();
            });
        }
    }

    async render() {
        let maybeResult = await asyncTryOrPropogate(() =>
            executeTable(this.query, this.index, this.origin, this.settings)
        );
        if (!maybeResult.successful) {
            renderErrorPre(this.container, "Dataview: " + maybeResult.error);
            return;
        }

        let result = maybeResult.value;

        if ((this.query.header as TableQuery).showId) {
            let dataWithNames: LiteralValue[][] = [];
            for (let entry of result.data) {
                dataWithNames.push([entry.id].concat(entry.values));
            }
            let name =
                result.idMeaning.type === "group"
                    ? this.settings.tableGroupColumnName
                    : this.settings.tableIdColumnName;

            await renderTable(
                this.container,
                [name].concat(result.names),
                dataWithNames,
                this,
                this.origin,
                this.settings
            );
        } else {
            await renderTable(
                this.container,
                result.names,
                result.data.map(v => v.values),
                this,
                this.origin,
                this.settings
            );
        }

        // Render after the empty table, so the table header still renders.
        if (result.data.length == 0 && this.settings.warnOnEmptyResult) {
            renderErrorPre(this.container, "Dataview: Query returned 0 results.");
        }
    }
}

class DataviewTaskRenderer extends MarkdownRenderChild {
    taskBindings?: Component;

    constructor(
        public query: Query,
        public container: HTMLElement,
        public index: FullIndex,
        public origin: string,
        public vault: Vault,
        public settings: DataviewSettings
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        if (this.settings.refreshEnabled) {
            onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
                if (this.taskBindings) this.removeChild(this.taskBindings);

                this.container.innerHTML = "";
                await this.render();
            });
        }
    }

    async render() {
        let result = await asyncTryOrPropogate(() => executeTask(this.query, this.origin, this.index, this.settings));
        if (!result.successful) {
            renderErrorPre(this.container, "Dataview: " + result.error);
        } else {
            // If there is no grouping going on, group by the file path by default.
            let tasks = result.value.tasks;
            if (tasks.type == "base") {
                let byFile = new Map<string, Task[]>();
                for (let task of tasks.value as Task[]) {
                    if (!byFile.has(task.path)) byFile.set(task.path, []);
                    byFile.get(task.path)?.push(task);
                }

                tasks = Groupings.grouped(
                    Array.from(byFile.entries()).map(([path, tasks]) => {
                        return { key: Link.file(path), value: Groupings.base(tasks) };
                    })
                );
            }

            this.taskBindings = new Component();
            this.addChild(this.taskBindings);

            await Tasks.renderTasks(this.container, tasks, this.origin, this.taskBindings, this.vault, this.settings);
        }
    }
}

/** Renders inline query results. */
class DataviewInlineRenderer extends MarkdownRenderChild {
    // The box that the error is rendered in, if relevant.
    errorbox?: HTMLElement;

    constructor(
        public field: Field,
        public fieldText: string,
        public container: HTMLElement,
        public target: HTMLElement,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        if (this.settings.refreshEnabled) {
            onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
                this.errorbox?.remove();
                await this.render();
            });
        }
    }

    async render() {
        let result = tryOrPropogate(() => executeInline(this.field, this.origin, this.index, this.settings));
        if (!result.successful) {
            this.errorbox = this.container.createEl("div");
            renderErrorPre(this.errorbox, "Dataview (for inline query '" + this.fieldText + "'): " + result.error);
        } else {
            let temp = document.createElement("span");
            await renderValue(result.value, temp, this.origin, this, this.settings, false);

            this.target.replaceWith(temp);
        }
    }
}

class DataviewJSRenderer extends MarkdownRenderChild {
    static PREAMBLE: string = "const dataview = this;const dv = this;";

    constructor(
        public script: string,
        public container: HTMLElement,
        public app: App,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings,
        public verNum: string
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        if (this.settings.refreshEnabled) {
            onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
                this.container.innerHTML = "";
                await this.render();
            });
        }
    }

    async render() {
        if (!this.settings.enableDataviewJs) {
            this.containerEl.innerHTML = "";
            renderErrorPre(
                this.container,
                "Dataview JS queries are disabled. You can enable them in the Dataview settings."
            );
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            await asyncEvalInContext(
                DataviewJSRenderer.PREAMBLE + this.script,
                makeApiContext(this.index, this, this.app, this.settings, this.verNum, this.container, this.origin)
            );
        } catch (e) {
            this.containerEl.innerHTML = "";
            renderErrorPre(this.container, "Evaluation Error: " + e.stack);
        }
    }
}

/** Inline JS renderer accessible using '=$' by default. */
class DataviewInlineJSRenderer extends MarkdownRenderChild {
    static PREAMBLE: string = "const dataview = this;const dv=this;";

    // The box that the error is rendered in, if relevant.
    errorbox?: HTMLElement;

    constructor(
        public script: string,
        public container: HTMLElement,
        public target: HTMLElement,
        public app: App,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings,
        public verNum: string
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        if (this.settings.refreshEnabled) {
            onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
                this.errorbox?.remove();
                await this.render();
            });
        }
    }

    async render() {
        if (!this.settings.enableDataviewJs || !this.settings.enableInlineDataviewJs) {
            let temp = document.createElement("span");
            temp.innerText = "(disabled; enable in settings)";
            this.target.replaceWith(temp);
            this.target = temp;
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            let temp = document.createElement("span");
            let result = await asyncEvalInContext(
                DataviewInlineJSRenderer.PREAMBLE + this.script,
                makeApiContext(this.index, this, this.app, this.settings, this.verNum, temp, this.origin)
            );
            this.target.replaceWith(temp);
            this.target = temp;
            if (result === undefined) return;

            renderValue(result, temp, this.origin, this, this.settings, false);
        } catch (e) {
            this.errorbox = this.container.createEl("div");
            renderErrorPre(this.errorbox, "Dataview (for inline JS query '" + this.script + "'): " + e);
        }
    }
}

/** Adds a simple handler which runs the given action on any index update. */
function onIndexChange(index: FullIndex, interval: number, component: Component, action: () => any) {
    let lastReload = index.revision;

    component.registerInterval(
        window.setInterval(() => {
            // If the index revision has changed recently, then queue a reload.
            if (lastReload != index.revision) {
                action();
                lastReload = index.revision;
            }
        }, interval)
    );
}

/** Replaces raw textual inline fields in text containers with pretty HTML equivalents. */
async function replaceInlineFields(
    ctx: MarkdownPostProcessorContext,
    container: HTMLElement,
    originFile: string,
    settings: QuerySettings
): Promise<Component | undefined> {
    let inlineFields = extractInlineFields(container.innerHTML);
    if (inlineFields.length == 0) return undefined;

    let component = new MarkdownRenderChild(container);
    ctx.addChild(component);

    let result = container.innerHTML;
    for (let x = inlineFields.length - 1; x >= 0; x--) {
        let field = inlineFields[x];
        let renderContainer = document.createElement("span");
        renderContainer.addClasses(["dataview", "inline-field"]);

        // Block inline fields render the key, parenthesis ones do not.
        if (field.wrapping == "[") {
            renderContainer.createSpan({
                text: field.key,
                cls: ["dataview", "inline-field-key"],
                attr: {
                    "data-dv-key": field.key,
                    "data-dv-norm-key": canonicalizeVarName(field.key),
                },
            });

            let valueContainer = renderContainer.createSpan({ cls: ["dataview", "inline-field-value"] });
            await renderValue(parseInlineValue(field.value), valueContainer, originFile, component, settings, false);
        } else {
            let valueContainer = renderContainer.createSpan({ cls: ["dataview", "inline-field-standalone-value"] });
            await renderValue(parseInlineValue(field.value), valueContainer, originFile, component, settings, false);
        }

        result = result.slice(0, field.start) + renderContainer.outerHTML + result.slice(field.end);
    }

    container.innerHTML = result;
    return component;
}
