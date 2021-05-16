import { MarkdownRenderChild, Plugin, Workspace, Vault, MarkdownPostProcessorContext, PluginSettingTab, App, Setting } from 'obsidian';
import { renderErrorPre, renderList, renderTable, renderValue } from 'src/render';
import { FullIndex } from 'src/data/index';
import * as Tasks from 'src/tasks';
import { Field, Fields, Query, QuerySettings } from 'src/query';
import { parseField, parseQuery } from "src/parse";
import { execute, executeInline, executeTask } from 'src/engine';
import { tryOrPropogate } from 'src/util/normalize';
import { waitFor } from 'src/util/concurrency';
import { evalInContext, makeApiContext } from 'src/api/inline-api';

interface DataviewSettings extends QuerySettings {
	/** What to render 'null' as in tables. Defaults to '-'. */
	renderNullAs: string;
	/** If true, render a modal which shows no results were returned. */
	warnOnEmptyResult: boolean;
	/** The prefix for inline queries by default. */
	inlineQueryPrefix: string;
	/** The interval that views are refreshed, by default. */
	refreshInterval: number;

	// Internal properties //

	/** A monotonically increasing version which tracks what schema we are on, used for migrations. */
	schemaVersion: number;
}

/** Default settings for dataview on install. */
const DEFAULT_SETTINGS: DataviewSettings = {
	renderNullAs: "\\-",
	warnOnEmptyResult: true,
	inlineQueryPrefix: "=",
	refreshInterval: 5000,
	schemaVersion: 1
}

export default class DataviewPlugin extends Plugin {
	settings: DataviewSettings;
	workspace: Workspace;

	index: FullIndex;

	async onload() {
		// Settings initialization; write defaults first time around.
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData() ?? {});
		this.workspace = this.app.workspace;

		this.addSettingTab(new DataviewSettingsTab(this.app, this));

		console.log("Dataview Plugin - Version 0.2.x Loaded");

		if (!this.workspace.layoutReady) {
			this.workspace.on("layout-ready", async () => this.prepareIndexes());
		} else {
			await this.prepareIndexes();
		}

		// Main entry point for dataview. Runs at a very high priority before other tasks.
		this.registerMarkdownCodeBlockProcessor("dataview", async (source: string, el, ctx) => {
			let query = tryOrPropogate(() => parseQuery(source, this.settings));

			// In case of parse error, just render the error.
			if (typeof query === 'string') {
				renderErrorPre(el, "Dataview: " + query);
				return;
			}

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
			// Search for <code> blocks inside this element; for each one, look for things of the form `
			let codeblocks = el.querySelectorAll("code");
			for (let index = 0; index < codeblocks.length; index++) {
				let codeblock = codeblocks.item(index);

				let text = codeblock.innerText.trim();
				if (!text.startsWith(this.settings.inlineQueryPrefix)) continue;

				let potentialField = text.substring(this.settings.inlineQueryPrefix.length).trim();

				let field = tryOrPropogate(() => parseField(potentialField));
				if (typeof field === "string") {
					let errorBlock = el.createEl('div');
					renderErrorPre(errorBlock, `Dataview (inline field '${potentialField}'): ${field}`);
				} else {
					ctx.addChild(this.wrapInlineWithEnsureIndex(ctx, codeblock,
						() => new DataviewInlineRenderer(field as Field, text, el, codeblock, this.index, ctx.sourcePath, this.settings)));
				}
			}
		});
	}

	onunload() { }

	/** Prepare all dataview indices. */
	async prepareIndexes() {
		let index = await FullIndex.generate(this.app.vault, this.app.metadataCache);
		this.index = index;
	}

	/** Update plugin settings. */
	async updateSettings(settings: Partial<DataviewSettings>) {
		this.settings = Object.assign(this.settings, settings);
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

		this.registerInterval(window.setInterval(async () => {
			this.container.innerHTML = "";
			await this.render();
		}, this.query.settings.refreshInterval));
	}

	async render() {
		let result = tryOrPropogate(() => execute(this.query, this.index, this.origin));
		if (typeof result === 'string') {
			renderErrorPre(this.container, "Dataview: " + result);
		} else if (result.data.length == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Dataview: Query returned 0 results.");
		} else {
			if (result.names.length == 2) {
				let rendered: HTMLElement[] = [];
				for (let [file, value] of result.data) {
					let span = document.createElement('span');
					await renderValue(Fields.fieldToValue(file), span, this.origin, this, this.settings.renderNullAs, true);
					span.appendText(": ");
					await renderValue(Fields.fieldToValue(value), span, this.origin, this, this.settings.renderNullAs, true);

					rendered.push(span);
				}

				await renderList(this.container, rendered, this, this.origin, this.settings.renderNullAs);
			} else {
				await renderList(this.container, result.data.map(v => v.length == 0 ? null : Fields.fieldToValue(v[0])),
					this, this.origin, this.settings.renderNullAs);
			}
		}
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

		this.registerInterval(window.setInterval(async () => {
			this.container.innerHTML = "";
			await this.render();
		}, this.query.settings.refreshInterval));
	}

	async render() {
		let result = tryOrPropogate(() => execute(this.query, this.index, this.origin));
		if (typeof result === 'string') {
			renderErrorPre(this.container, "Dataview: " + result);
			return;
		}

		await renderTable(this.container, result.names, result.data.map(l => l.map(Fields.fieldToValue)),
			this, this.origin, this.settings.renderNullAs);

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

		this.registerInterval(window.setInterval(async () => {
			if (this.taskView) this.removeChild(this.taskView);

			this.container.innerHTML = "";
			await this.render();
		}, this.query.settings.refreshInterval));
	}

	async render() {
		let result = tryOrPropogate(() => executeTask(this.query, this.origin, this.index));
		if (typeof result === 'string') {
			renderErrorPre(this.container, "Dataview: " + result);
		} else if (result.size == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Query returned 0 results.");
		} else {
			await Tasks.renderFileTasks(this.container, result);
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

		this.registerInterval(window.setInterval(async () => {
			this.errorbox?.remove();
			await this.render();
		}, this.settings.refreshInterval));
	}

	async render() {
		let result = tryOrPropogate(() => executeInline(this.field, this.origin, this.index));
		if (typeof result === 'string') {
			this.errorbox = this.container.createEl('div');
			renderErrorPre(this.errorbox, "Dataview (for inline query '" + this.fieldText + "'): " + result);
		} else {
            let temp = document.createElement("span");
			await renderValue(Fields.fieldToValue(result), temp, this.origin, this, this.settings.renderNullAs, false);

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
		// Assume that the code is javascript, and try to eval it.
		try {
			evalInContext(DataviewJSRenderer.PREAMBLE + this.script,
				makeApiContext(this.index, this, this.app, this.container, this.origin));
		} catch (e) {
			this.containerEl.innerHTML = "";
			renderErrorPre(this.container, "Evaluation Error: " + e.stack);
		}
	}
}
