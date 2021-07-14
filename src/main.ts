import { MarkdownRenderChild, Plugin, Vault, MarkdownPostProcessorContext, PluginSettingTab, App, Setting, Component, FileSystemAdapter } from 'obsidian';
import { renderErrorPre, renderList, renderTable, renderValue } from 'src/ui/render';
import { FullIndex } from 'src/data/index';
import * as Tasks from 'src/ui/tasks';
import { Query } from 'src/query/query';
import { Field } from 'src/expression/field';
import { parseField } from "src/expression/parse";
import { parseQuery } from "src/query/parse";
import { executeInline, executeList, executeTable, executeTask } from 'src/query/engine';
import { tryOrPropogate } from 'src/util/normalize';
import { waitFor } from 'src/util/concurrency';
import { evalInContext, makeApiContext } from 'src/api/inline-api';
import { DataviewApi } from './api/plugin-api';
import { DataviewSettings, DEFAULT_SETTINGS } from './settings';
import { LiteralValue } from './data/value';

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

	async onload() {
		// Settings initialization; write defaults first time around.
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData() ?? {});

		this.addSettingTab(new DataviewSettingsTab(this.app, this));

		console.log("Dataview: Version 0.4.x Loaded");

		if (!this.app.workspace.layoutReady) {
			this.app.workspace.onLayoutReady(async () => this.prepareIndexes());
		} else {
			this.prepareIndexes();
		}

		// Main entry point for dataview.
		this.registerMarkdownCodeBlockProcessor("dataview", async (source: string, el, ctx) => {
			let maybeQuery = tryOrPropogate(() => parseQuery(source, this.settings));

			// In case of parse error, just render the error.
			if (!maybeQuery.successful) {
				renderErrorPre(el, "Dataview: " + maybeQuery.error);
				return;
			}

            let query = maybeQuery.value;
			switch (query.header.type) {
				case 'task':
					ctx.addChild(this.wrapWithEnsureIndex(ctx, el,
						() => new DataviewTaskRenderer(query as Query, el, this.index, ctx.sourcePath, this.app.vault, this.settings)));
					break;
				case 'list':
					ctx.addChild(this.wrapWithEnsureIndex(ctx, el,
						() => new DataviewListRenderer(query as Query, el, this.index, ctx.sourcePath, this.settings)));
					break;
				case 'table':
					ctx.addChild(this.wrapWithEnsureIndex(ctx, el,
						() => new DataviewTableRenderer(query as Query, el, this.index, ctx.sourcePath, this.settings)));
					break;
			}
		});

		// Main entry point for Dataview.
		this.registerMarkdownCodeBlockProcessor("dataviewjs", async (source: string, el, ctx) => {
			ctx.addChild(this.wrapWithEnsureIndex(ctx, el,
				() => new DataviewJSRenderer(source, el, this.app, this.index, ctx.sourcePath, this.settings)));
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
                    ctx.addChild(this.wrapInlineWithEnsureIndex(ctx, codeblock,
                        () => new DataviewInlineJSRenderer(code, el, codeblock, this.app, this.index, ctx.sourcePath, this.settings)));
				} else if (text.startsWith(this.settings.inlineQueryPrefix)) {
                    let potentialField = text.substring(this.settings.inlineQueryPrefix.length).trim();

                    let field = tryOrPropogate(() => parseField(potentialField));
                    if (!field.successful) {
                        let errorBlock = el.createEl('div');
                        renderErrorPre(errorBlock, `Dataview (inline field '${potentialField}'): ${field.error}`);
                    } else {
                        let fieldValue = field.value;
                        ctx.addChild(this.wrapInlineWithEnsureIndex(ctx, codeblock,
                            () => new DataviewInlineRenderer(fieldValue, text, el, codeblock, this.index, ctx.sourcePath, this.settings)));
                    }
                }
			}
		});

		/** Create folder for inline JS template views, if it doesn’t already exist. */
        if (this.app.vault.adapter instanceof FileSystemAdapter) {
			let viewsPath = `${this.app.vault.configDir}/dataviews`;

			this.app.vault.adapter.exists(viewsPath).then(pathExists => {
				if (!pathExists) this.app.vault.adapter.mkdir(viewsPath);
			});
        }
	}

	onunload() { }

	/** Prepare all dataview indices. */
	async prepareIndexes() {
		let index = await FullIndex.generate(this.app.vault, this.app.metadataCache);
		this.index = index;

        this.api = new DataviewApi(this.app, this.index, this.settings);
        this.app.metadataCache.trigger("dataview:api-ready", this.api);
	}

	/** Update plugin settings. */
	async updateSettings(settings: Partial<DataviewSettings>) {
		Object.assign(this.settings, settings);
		await this.saveData(this.settings);
	}

	private wrapWithEnsureIndex(ctx: MarkdownPostProcessorContext, container: HTMLElement, success: () => MarkdownRenderChild): EnsurePredicateRenderer {
		return new EnsurePredicateRenderer(ctx, container, () => this.index != undefined && this.index.pages && this.index.pages.size > 0, success);
	}

	private wrapInlineWithEnsureIndex(ctx: MarkdownPostProcessorContext, container: HTMLElement, success: () => MarkdownRenderChild): EnsurePredicateRenderer {
		return new EnsureInlinePredicateRenderer(ctx, container, () => this.index != undefined && this.index.pages && this.index.pages.size > 0, success);
	}
}

/** All of the dataview settings in a single, nice tab. */
class DataviewSettingsTab extends PluginSettingTab {
	constructor(app: App, private plugin: DataviewPlugin) {
		super(app, plugin);
	}

	display(): void {
		this.containerEl.empty();
		this.containerEl.createEl("h2", { text: "Dataview Settings" });

		new Setting(this.containerEl)
			.setName("Render Null As")
			.setDesc("What null/non-existent should show up as in tables, by default.")
			.addText(text =>
				text.setPlaceholder("-")
					.setValue(this.plugin.settings.renderNullAs)
					.onChange(async (value) => await this.plugin.updateSettings({ renderNullAs: value })));

		new Setting(this.containerEl)
			.setName("Warn on Empty Result")
			.setDesc("If set, queries which return 0 results will render a warning message.")
			.addToggle(toggle =>
				toggle.setValue(this.plugin.settings.warnOnEmptyResult)
					.onChange(async (value) => await this.plugin.updateSettings({ warnOnEmptyResult: value })));

		new Setting(this.containerEl)
			.setName("Inline Query Prefix")
			.setDesc("The prefix to inline queries (to mark them as Dataview queries). Defaults to '='.")
			.addText(text =>
				text.setPlaceholder("=")
				.setValue(this.plugin.settings.inlineQueryPrefix)
				.onChange(async (value) => await this.plugin.updateSettings({ inlineQueryPrefix: value })))

		new Setting(this.containerEl)
			.setName("JavaScript Inline Query Prefix")
			.setDesc("The prefix to JavaScript inline queries (to mark them as DataviewJS queries). Defaults to '$='.")
			.addText(text =>
				text.setPlaceholder("$=")
				.setValue(this.plugin.settings.inlineJsQueryPrefix)
				.onChange(async (value) => await this.plugin.updateSettings({ inlineJsQueryPrefix: value })))

		new Setting(this.containerEl)
			.setName("Dataview Refresh Interval (milliseconds)")
			.setDesc("How frequently dataviews are updated in preview mode when files are changing.")
			.addText(text =>
				text.setPlaceholder("5000")
				.setValue("" + this.plugin.settings.refreshInterval)
				.onChange(async (value) => {
					let parsed = parseInt(value);
					if (isNaN(parsed)) return;
					parsed = (parsed < 100) ? 100 : parsed;
					await this.plugin.updateSettings({ refreshInterval: parsed });
				}));
	}
}

/** A generic renderer which waits for a predicate, only continuing on success. */
class EnsurePredicateRenderer extends MarkdownRenderChild {
	static CHECK_INTERVAL_MS = 1_000;

	dead: boolean;

	constructor(public ctx: MarkdownPostProcessorContext,
		public container: HTMLElement,
		public update: () => boolean,
		public success: () => MarkdownRenderChild) {
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
		await waitFor(EnsurePredicateRenderer.CHECK_INTERVAL_MS,
			() => { loadContainer.innerText += "."; return this.update(); },
			() => this.dead);

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

	constructor(public ctx: MarkdownPostProcessorContext,
		public container: HTMLElement,
		public update: () => boolean,
		public success: () => MarkdownRenderChild) {
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
		await waitFor(EnsurePredicateRenderer.CHECK_INTERVAL_MS,
			() => { return this.update(); },
			() => this.dead);

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
	constructor(public query: Query,
		public container: HTMLElement,
		public index: FullIndex,
		public origin: string,
		public settings: DataviewSettings) {
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
		let maybeResult = tryOrPropogate(() => executeList(this.query, this.index, this.origin));
		if (!maybeResult.successful) {
			renderErrorPre(this.container, "Dataview: " + maybeResult.error);
            return;
		} else if (maybeResult.value.data.length == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Dataview: Query returned 0 results.");
            return;
		}
        let result = maybeResult.value;
        let rendered: LiteralValue[] = [];
        for (let row of result.data) {
            if (row.value) {
                let span = document.createElement('span');
                await renderValue(row.primary, span, this.origin, this, this.settings.renderNullAs, true);
                span.appendText(": ");
                await renderValue(row.value, span, this.origin, this, this.settings.renderNullAs, true);

                rendered.push(span);
            } else {
                rendered.push(row.primary);
            }
        }

        await renderList(this.container, rendered, this, this.origin, this.settings.renderNullAs);
	}
}

class DataviewTableRenderer extends MarkdownRenderChild {
	constructor(
		public query: Query,
		public container: HTMLElement,
		public index: FullIndex,
		public origin: string,
		public settings: DataviewSettings) {
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
		let maybeResult = tryOrPropogate(() => executeTable(this.query, this.index, this.origin));
		if (!maybeResult.successful) {
			renderErrorPre(this.container, "Dataview: " + maybeResult.error);
			return;
		}

        let result = maybeResult.value;
        let dataWithNames: LiteralValue[][] = [];
        for (let entry of result.data) {
            dataWithNames.push([entry.id].concat(entry.values));
        }
        let name = result.idMeaning.type === "group" ? "Group" : "File";

        await renderTable(this.container, [name].concat(result.names), dataWithNames, this, this.origin, this.settings.renderNullAs);

		// Render after the empty table, so the table header still renders.
		if (result.data.length == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Dataview: Query returned 0 results.");
		}
	}
}

class DataviewTaskRenderer extends MarkdownRenderChild {

	taskView?: MarkdownRenderChild;

	constructor(public query: Query,
		public container: HTMLElement,
		public index: FullIndex,
		public origin: string,
		public vault: Vault,
		public settings: DataviewSettings) {
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
		let result = tryOrPropogate(() => executeTask(this.query, this.origin, this.index));
		if (!result.successful) {
			renderErrorPre(this.container, "Dataview: " + result.error);
		} else if (result.value.tasks.size == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Query returned 0 results.");
		} else {
			await Tasks.renderFileTasks(this.container, result.value.tasks);

			// TODO: Merge this into this renderer.
			this.addChild(this.taskView = new Tasks.TaskViewLifecycle(this.vault, this.container));
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
		public settings: DataviewSettings) {
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
		let result = tryOrPropogate(() => executeInline(this.field, this.origin, this.index));
		if (!result.successful) {
			this.errorbox = this.container.createEl('div');
			renderErrorPre(this.errorbox, "Dataview (for inline query '" + this.fieldText + "'): " + result.error);
		} else {
            let temp = document.createElement("span");
			await renderValue(result.value, temp, this.origin, this, this.settings.renderNullAs, false);

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
		public settings: DataviewSettings) {
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
		// Assume that the code is javascript, and try to eval it.
		try {
			evalInContext(DataviewJSRenderer.PREAMBLE + this.script,
				makeApiContext(this.index, this, this.app, this.settings, this.container, this.origin));
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
		public settings: DataviewSettings) {
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
		// Assume that the code is javascript, and try to eval it.
		try {
            let temp = document.createElement("span");
			let result = evalInContext(DataviewInlineJSRenderer.PREAMBLE + this.script,
				makeApiContext(this.index, this, this.app, this.settings, temp, this.origin));
            this.target.replaceWith(temp);
            this.target = temp;
            if (result === undefined) return;

            renderValue(result, temp, this.origin, this, this.settings.renderNullAs, false);
		} catch (e) {
			this.errorbox = this.container.createEl('div');
			renderErrorPre(this.errorbox, "Dataview (for inline JS query '" + this.script + "'): " + e);
		}
    }
}

function onIndexChange(index: FullIndex, interval: number, component: Component, action: () => any) {
    let lastReload = index.revision;

    component.registerInterval(window.setInterval(() => {
        // If the index revision has changed recently, then queue a reload.
        if (lastReload != index.revision) {
            action();
            lastReload = index.revision;
        }
    }, interval));
}
