import {
    App,
    Component,
    debounce,
    MarkdownPostProcessorContext,
    MarkdownRenderChild,
    Plugin,
    PluginSettingTab,
    Setting,
} from "obsidian";
import { renderCodeBlock, renderErrorPre, renderValue } from "ui/render";
import { FullIndex } from "data-index/index";
import { Query } from "query/query";
import { parseField } from "expression/parse";
import { parseQuery } from "query/parse";
import { canonicalizeVarName, tryOrPropogate } from "util/normalize";
import { DataviewApi } from "api/plugin-api";
import { DataviewSettings, DEFAULT_QUERY_SETTINGS, DEFAULT_SETTINGS, QuerySettings } from "settings";
import { extractInlineFields, parseInlineValue } from "data-import/inline-field";
import { API_NAME, DvAPIInterface } from "./typings/api";
import { DataviewCalendarRenderer } from "ui/views/calendar-view";
import { DataviewInlineRenderer } from "ui/views/inline-view";
import { DataviewInlineJSRenderer, DataviewJSRenderer } from "ui/views/js-view";
import { currentLocale } from "util/locale";
import { DateTime } from "luxon";
import { DataviewInlineApi } from "api/inline-api";
import { createTaskView } from "ui/views/task-view";
import { createListView } from "ui/views/list-view";
import { createTableView } from "ui/views/table-view";

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
        this.addSettingTab(new GeneralSettingsTab(this.app, this));

        this.index = this.addChild(
            FullIndex.create(this.app, this.manifest.version, () => {
                if (this.settings.refreshEnabled) this.debouncedRefresh();
            })
        );

        // Set up automatic (intelligent) view refreshing that debounces.
        this.updateRefreshSettings();

        // From this point onwards the dataview API is fully functional (even if the index needs to do some background indexing).
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
        this.registerPriorityMarkdownPostProcessor(-100, async (el, ctx) => {
            this.dataviewInline(el, ctx, ctx.sourcePath);
        });

        // Dataview inline-inline query fancy rendering. Runs at a low priority; should apply to Dataview views.
        this.registerPriorityMarkdownPostProcessor(100, async (el, ctx) => {
            // Allow for lame people to disable the pretty rendering.
            if (!this.settings.prettyRenderInlineFields || isDataviewDisabled(ctx.sourcePath)) return;

            // Handle p, header elements explicitly (opt-in rather than opt-out for now).
            for (let p of el.findAllSelf("p,h1,h2,h3,h4,h5,h6,li,span,th,td"))
                await replaceInlineFields(ctx, p, ctx.sourcePath, this.settings);
        });

        // Dataview "force refresh" operation.
        this.addCommand({
            id: "dataview-force-refresh-views",
            name: "Force Refresh Views",
            callback: () => {
                this.index.touch();
                this.app.workspace.trigger("dataview:refresh-views");
            },
        });

        // Run index initialization, which actually traverses the vault to index files.
        if (!this.app.workspace.layoutReady) {
            this.app.workspace.onLayoutReady(async () => this.index.initialize());
        } else {
            this.index.initialize();
        }

        // Not required anymore, though holding onto it for backwards-compatibility.
        this.app.metadataCache.trigger("dataview:api-ready", this.api);
        console.log(`Dataview: version ${this.manifest.version} (requires obsidian ${this.manifest.minAppVersion})`);
    }

    private debouncedRefresh: () => void = () => null;

    private updateRefreshSettings() {
        this.debouncedRefresh = debounce(
            () => this.app.workspace.trigger("dataview:refresh-views"),
            this.settings.refreshInterval,
            true
        );
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
        if (isDataviewDisabled(sourcePath)) {
            renderCodeBlock(el, source);
            return;
        }

        let maybeQuery = tryOrPropogate(() => parseQuery(source));

        // In case of parse error, just render the error.
        if (!maybeQuery.successful) {
            renderErrorPre(el, "Dataview: " + maybeQuery.error);
            return;
        }

        let query = maybeQuery.value;
        let init = { app: this.app, settings: this.settings, index: this.index, container: el };
        switch (query.header.type) {
            case "task":
                component.addChild(createTaskView(init, query as Query, sourcePath));
                break;
            case "list":
                component.addChild(createListView(init, query as Query, sourcePath));
                break;
            case "table":
                component.addChild(createTableView(init, query as Query, sourcePath));
                break;
            case "calendar":
                component.addChild(
                    new DataviewCalendarRenderer(query as Query, el, this.index, sourcePath, this.settings, this.app)
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
        if (isDataviewDisabled(sourcePath)) {
            renderCodeBlock(el, source, "javascript");
            return;
        }

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
        if (isDataviewDisabled(sourcePath)) return;

        // Search for <code> blocks inside this element; for each one, look for things of the form `= ...`.
        let codeblocks = el.querySelectorAll("code");
        for (let index = 0; index < codeblocks.length; index++) {
            let codeblock = codeblocks.item(index);

            let text = codeblock.innerText.trim();
            if (this.settings.inlineJsQueryPrefix.length > 0 && text.startsWith(this.settings.inlineJsQueryPrefix)) {
                let code = text.substring(this.settings.inlineJsQueryPrefix.length).trim();
                if (code.length == 0) continue;

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
            } else if (this.settings.inlineQueryPrefix.length > 0 && text.startsWith(this.settings.inlineQueryPrefix)) {
                let potentialField = text.substring(this.settings.inlineQueryPrefix.length).trim();
                if (potentialField.length == 0) continue;

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
                            this.settings,
                            this.app
                        )
                    );
                }
            }
        }
    }

    /** Update plugin settings. */
    async updateSettings(settings: Partial<DataviewSettings>) {
        Object.assign(this.settings, settings);
        this.updateRefreshSettings();
        await this.saveData(this.settings);
    }

    /** @deprecated Call the given callback when the dataview API has initialized. */
    public withApi(callback: (api: DvAPIInterface) => void) {
        callback(this.api);
    }

    /**
     * Create an API element localized to the given path, with lifecycle management managed by the given component.
     * The API will output results to the given HTML element.
     */
    public localApi(path: string, component: Component, el: HTMLElement): DataviewInlineApi {
        return new DataviewInlineApi(this.index, component, el, this.app, this.settings, this.manifest.version, path);
    }
}

/** All of the dataview settings in a single, nice tab. */
class GeneralSettingsTab extends PluginSettingTab {
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
                    .onChange(async value => {
                        if (value.length == 0) return;

                        await this.plugin.updateSettings({ inlineQueryPrefix: value });
                    })
            );

        new Setting(this.containerEl)
            .setName("JavaScript Inline Query Prefix")
            .setDesc("The prefix to JavaScript inline queries (to mark them as DataviewJS queries). Defaults to '$='.")
            .addText(text =>
                text
                    .setPlaceholder("$=")
                    .setValue(this.plugin.settings.inlineJsQueryPrefix)
                    .onChange(async value => {
                        if (value.length == 0) return;

                        await this.plugin.updateSettings({ inlineJsQueryPrefix: value });
                    })
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
                    await this.plugin.updateSettings({ refreshEnabled: value });
                    this.plugin.index.touch();
                })
            );

        new Setting(this.containerEl)
            .setName("Refresh Interval")
            .setDesc("How long to wait (in milliseconds) for files to stop changing before updating views.")
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

/** Determines if source-path has a `?no-dataview` annotation that disables dataview. */
function isDataviewDisabled(sourcePath: string): boolean {
    let questionLocation = sourcePath.lastIndexOf("?");
    if (questionLocation == -1) return false;

    return sourcePath.substring(questionLocation).contains("no-dataview");
}
