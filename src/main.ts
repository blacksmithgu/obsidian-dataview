import {
    MarkdownRenderChild,
    Plugin,
    Vault,
    MarkdownPostProcessorContext,
    PluginSettingTab,
    App,
    Setting,
    Component,
    MarkdownPostProcessor,
    TAbstractFile,
    TFile,
} from "obsidian";
import { renderErrorPre, renderList, renderTable, renderValue } from "ui/render";
import { FullIndex } from "data/index";
import * as Tasks from "ui/tasks";
import { ListQuery, Query, TableQuery } from "query/query";
import { Field } from "expression/field";
import { parseField } from "expression/parse";
import { parseQuery } from "query/parse";
import { executeInline, executeList, executeTable, executeTask } from "query/engine";
import { asyncTryOrPropogate, tryOrPropogate } from "util/normalize";
import { waitFor } from "util/concurrency";
import { asyncEvalInContext, makeApiContext } from "api/inline-api";
import { DataviewApi } from "api/plugin-api";
import { DataviewSettings, DEFAULT_QUERY_SETTINGS, DEFAULT_SETTINGS } from "settings";
import { Groupings, Link, LiteralValue, Task } from "data/value";
import { DateTime } from "luxon";
import { currentLocale } from "util/locale";

export default class DataviewPlugin extends Plugin {
    /** Plugin-wide default settigns. */
    public settings: DataviewSettings;

    /** The index that stores all dataview data. */
    public index: FullIndex;

    /**
     * The API for other plugins to access dataview functionality. Initialized once the index has been initalized,
     * so may be null when the plugin is first initializing.
     *
     * TODO: JavaScript async a little annoying w/o multi-threading; how do you verify it exists?
     */
    public api: DataviewApi;

    public trigger(name: "dataview:metadata-change", op: "rename", file: TAbstractFile, oldPath: string): void;
    public trigger(name: "dataview:metadata-change", op: "delete" | "update", file: TFile): void;
    public trigger(name: "dataview:api-ready", api: DataviewApi): void;
    public trigger(name: string, ...data: any[]): void {
        this.app.metadataCache.trigger(name, ...data);
    }

    async onload() {
        // Settings initialization; write defaults first time around.
        this.settings = Object.assign(DEFAULT_SETTINGS, (await this.loadData()) ?? {});

        this.addSettingTab(new DataviewSettingsTab(this.app, this));

        console.log("Dataview: Version 0.4.x Loaded");

        if (!this.app.workspace.layoutReady) {
            this.app.workspace.onLayoutReady(async () => this.prepareIndexes());
        } else {
            this.prepareIndexes();
        }

        // Dataview query language code blocks.
        this.registerHighPriorityCodeblockProcessor("dataview", async (source: string, el, ctx) => {
            let maybeQuery = tryOrPropogate(() => parseQuery(source));

            // In case of parse error, just render the error.
            if (!maybeQuery.successful) {
                renderErrorPre(el, "Dataview: " + maybeQuery.error);
                return;
            }

            let query = maybeQuery.value;
            switch (query.header.type) {
                case "task":
                    ctx.addChild(
                        this.wrapWithEnsureIndex(
                            ctx,
                            el,
                            () =>
                                new DataviewTaskRenderer(
                                    query as Query,
                                    el,
                                    this.index,
                                    ctx.sourcePath,
                                    this.app.vault,
                                    this.settings
                                )
                        )
                    );
                    break;
                case "list":
                    ctx.addChild(
                        this.wrapWithEnsureIndex(
                            ctx,
                            el,
                            () =>
                                new DataviewListRenderer(query as Query, el, this.index, ctx.sourcePath, this.settings)
                        )
                    );
                    break;
                case "table":
                    ctx.addChild(
                        this.wrapWithEnsureIndex(
                            ctx,
                            el,
                            () =>
                                new DataviewTableRenderer(query as Query, el, this.index, ctx.sourcePath, this.settings)
                        )
                    );
                    break;
            }
        });

        // DataviewJS codeblocks.
        this.registerHighPriorityCodeblockProcessor("dataviewjs", async (source: string, el, ctx) => {
            ctx.addChild(
                this.wrapWithEnsureIndex(
                    ctx,
                    el,
                    () => new DataviewJSRenderer(source, el, this.app, this.index, ctx.sourcePath, this.settings)
                )
            );
        });

        // Dataview inline queries.
        this.registerMarkdownPostProcessor(async (el, ctx) => {
            // Search for <code> blocks inside this element; for each one, look for things of the form `= ...`.
            let codeblocks = el.querySelectorAll("code");
            for (let index = 0; index < codeblocks.length; index++) {
                let codeblock = codeblocks.item(index);

                let text = codeblock.innerText.trim();
                if (text.startsWith(this.settings.inlineJsQueryPrefix)) {
                    let code = text.substring(this.settings.inlineJsQueryPrefix.length).trim();
                    ctx.addChild(
                        this.wrapInlineWithEnsureIndex(
                            ctx,
                            codeblock,
                            () =>
                                new DataviewInlineJSRenderer(
                                    code,
                                    el,
                                    codeblock,
                                    this.app,
                                    this.index,
                                    ctx.sourcePath,
                                    this.settings
                                )
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
                        ctx.addChild(
                            this.wrapInlineWithEnsureIndex(
                                ctx,
                                codeblock,
                                () =>
                                    new DataviewInlineRenderer(
                                        fieldValue,
                                        text,
                                        el,
                                        codeblock,
                                        this.index,
                                        ctx.sourcePath,
                                        this.settings
                                    )
                            )
                        );
                    }
                }
            }
        });
    }

    /**
     * Utility function for registering high priority codeblocks which run before any other post processing, such as
     * emoji-twitter.
     */
    public registerHighPriorityCodeblockProcessor(
        language: string,
        processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => Promise<void>
    ) {
        let postProcess: MarkdownPostProcessor = async (el, ctx) => {
            let codeblocks = el.querySelectorAll("pre > code");
            if (!codeblocks) return;

            for (let index = 0; index < codeblocks.length; index++) {
                let codeblock = codeblocks.item(index) as HTMLElement;

                let clanguages = Array.from(codeblock.classList)
                    .filter(c => c.startsWith("language-"))
                    .map(c => c.substring("language-".length));
                clanguages = clanguages.concat(
                    Array.from(codeblock.classList)
                        .filter(c => c.startsWith(":"))
                        .map(c => c.substring(":".length))
                );

                if (!clanguages.contains(language)) continue;
                if (!codeblock.parentElement) continue;

                let code = codeblock.innerText;

                // We know the parent element is a pre, replace it.
                let replacement = document.createElement("div");
                codeblock.parentElement.replaceWith(replacement);

                await processor(code, replacement, ctx);
            }
        };
        postProcess.sortOrder = -100;
        this.registerMarkdownPostProcessor(postProcess);
    }

    onunload() {}

    /** Prepare all dataview indices. */
    async prepareIndexes() {
        let index = await FullIndex.generate(this);
        this.index = index;

        this.api = new DataviewApi(this.app, this.index, this.settings);
        this.trigger("dataview:api-ready", this.api);
    }

    /** Update plugin settings. */
    async updateSettings(settings: Partial<DataviewSettings>) {
        Object.assign(this.settings, settings);
        await this.saveData(this.settings);
    }

    private wrapWithEnsureIndex(
        ctx: MarkdownPostProcessorContext,
        container: HTMLElement,
        success: () => MarkdownRenderChild
    ): EnsurePredicateRenderer {
        return new EnsurePredicateRenderer(
            ctx,
            container,
            () => this.index != undefined && this.index.pages && this.index.pages.size > 0,
            success
        );
    }

    private wrapInlineWithEnsureIndex(
        ctx: MarkdownPostProcessorContext,
        container: HTMLElement,
        success: () => MarkdownRenderChild
    ): EnsurePredicateRenderer {
        return new EnsureInlinePredicateRenderer(
            ctx,
            container,
            () => this.index != undefined && this.index.pages && this.index.pages.size > 0,
            success
        );
    }

    // User-facing utility functions.

    /** Call the given callback when the dataview API has initialized. */
    public withApi(callback: (api: DataviewApi) => void) {
        if (this.api) callback(this.api);
        else this.app.metadataCache.on("dataview:api-ready", callback);
    }
}

/** All of the dataview settings in a single, nice tab. */
class DataviewSettingsTab extends PluginSettingTab {
    constructor(app: App, private plugin: DataviewPlugin) {
        super(app, plugin);
    }

    display(): void {
        this.containerEl.empty();
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

        new Setting(this.containerEl)
            .setName("Enable JavaScript Queries")
            .setDesc("Enable or disable executing DataviewJS queries.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.enableDataviewJs)
                    .onChange(async value => await this.plugin.updateSettings({ enableDataviewJs: value }))
            );

        this.containerEl.createEl("h2", { text: "View Settings" });
        this.containerEl.createEl("h3", { text: "General" });

        new Setting(this.containerEl)
            .setName("Render Null As")
            .setDesc("What null/non-existent should show up as in tables, by default. This supports Markdown notation.")
            .addText(text =>
                text
                    .setPlaceholder("-")
                    .setValue(this.plugin.settings.renderNullAs)
                    .onChange(async value => await this.plugin.updateSettings({ renderNullAs: value }))
            );

        new Setting(this.containerEl)
            .setName("Warn on Empty Result")
            .setDesc("If set, queries which return 0 results will render a warning message.")
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.warnOnEmptyResult)
                    .onChange(async value => await this.plugin.updateSettings({ warnOnEmptyResult: value }))
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
                    .onChange(async value => await this.plugin.updateSettings({ tableIdColumnName: value }))
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
                    .onChange(async value => await this.plugin.updateSettings({ tableGroupColumnName: value }))
            );

        this.containerEl.createEl("h3", { text: "Task Settings" });

        new Setting(this.containerEl)
            .setName("Render task links as")
            .setDesc("Text used when linking from a task to its source note. Leave empty to remove links.")
            .addText(text =>
                text
                    .setValue(this.plugin.settings.taskLinkText)
                    .onChange(async value => await this.plugin.updateSettings({ taskLinkText: value.trim() }))
            );
    }
}

/** A generic renderer which waits for a predicate, only continuing on success. */
class EnsurePredicateRenderer extends MarkdownRenderChild {
    static CHECK_INTERVAL_MS = 1_000;

    dead: boolean;

    constructor(
        public ctx: MarkdownPostProcessorContext,
        public container: HTMLElement,
        public update: () => boolean,
        public success: () => MarkdownRenderChild
    ) {
        super(container);

        this.ctx = ctx;
        this.container = container;
        this.update = update;
        this.success = success;
        this.dead = false;
    }

    async onload() {
        let loadContainer = renderErrorPre(this.container, "Dataview indices are loading");

        // Wait for the given predicate to finally pass...
        await waitFor(
            EnsurePredicateRenderer.CHECK_INTERVAL_MS,
            () => {
                loadContainer.innerText += ".";
                return this.update();
            },
            () => this.dead
        );

        // Clear the container before passing it off to the child.
        this.container.innerHTML = "";

        // And then pass off rendering to a child context.
        this.ctx.addChild(this.success());
    }

    onunload() {
        this.dead = true;
    }
}

/** Inline version of EnsurePredicateRenderer; renders it's loading message differently. */
class EnsureInlinePredicateRenderer extends MarkdownRenderChild {
    static CHECK_INTERVAL_MS = 1_000;

    dead: boolean;

    constructor(
        public ctx: MarkdownPostProcessorContext,
        public container: HTMLElement,
        public update: () => boolean,
        public success: () => MarkdownRenderChild
    ) {
        super(container);

        this.ctx = ctx;
        this.container = container;
        this.update = update;
        this.success = success;
        this.dead = false;
    }

    async onload() {
        this.container.innerHTML = "<Indices loading>";

        // Wait for the given predicate to finally pass...
        await waitFor(
            EnsurePredicateRenderer.CHECK_INTERVAL_MS,
            () => {
                return this.update();
            },
            () => this.dead
        );

        // Clear the container before passing it off to the child.
        this.container.innerHTML = "";

        // And then pass off rendering to a child context.
        this.ctx.addChild(this.success());
    }

    onunload() {
        this.dead = true;
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

        onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
            this.container.innerHTML = "";
            await this.render();
        });
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

        onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
            this.container.innerHTML = "";
            await this.render();
        });
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
    taskView?: MarkdownRenderChild;

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

        onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
            if (this.taskView) this.removeChild(this.taskView);

            this.container.innerHTML = "";
            await this.render();
        });
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

            await Tasks.renderTasks(this.container, tasks, this.origin, this, this.settings);

            // TODO: Merge this into this renderer.
            this.addChild((this.taskView = new Tasks.TaskViewLifecycle(this.vault, this.container)));
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

        onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
            this.errorbox?.remove();
            await this.render();
        });
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
        public settings: DataviewSettings
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
            this.container.innerHTML = "";
            await this.render();
        });
    }

    async render() {
        if (!this.settings.enableDataviewJs) {
            this.containerEl.innerHTML = "";
            renderErrorPre(this.container, "Dataview JS queries are disabled.");
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            await asyncEvalInContext(
                DataviewJSRenderer.PREAMBLE + this.script,
                makeApiContext(this.index, this, this.app, this.settings, this.container, this.origin)
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
        public settings: DataviewSettings
    ) {
        super(container);
    }

    async onload() {
        await this.render();

        onIndexChange(this.index, this.settings.refreshInterval, this, async () => {
            this.errorbox?.remove();
            await this.render();
        });
    }

    async render() {
        if (!this.settings.enableDataviewJs) {
            let temp = document.createElement("span");
            temp.innerText = "<disabled>";
            this.target.replaceWith(temp);
            this.target = temp;
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            let temp = document.createElement("span");
            let result = await asyncEvalInContext(
                DataviewInlineJSRenderer.PREAMBLE + this.script,
                makeApiContext(this.index, this, this.app, this.settings, temp, this.origin)
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
