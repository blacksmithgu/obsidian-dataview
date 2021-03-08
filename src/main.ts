import { MarkdownRenderChild, Plugin, Workspace, Vault, MarkdownPostProcessorContext, PluginSettingTab, App, Setting } from 'obsidian';
import { createAnchor, prettifyYamlKey, renderErrorPre, renderField, renderList, renderMinimalDate, renderTable } from 'src/render';
import { FullIndex, TaskCache } from 'src/index';
import * as Tasks from 'src/tasks';
import { Query } from 'src/query';
import { parseQuery } from "src/legacy-parse";
import { execute, executeTask, getFileName } from 'src/engine';

interface DataviewSettings {
	/** What to render 'null' as in tables. Defaults to '-'. */
	renderNullAs: string;
	/** If true, render a modal which shows no results were returned. */
	warnOnEmptyResult: boolean;
}

/** Default settings for dataview on install. */
const DEFAULT_SETTINGS: DataviewSettings = {
	renderNullAs: "-",
	warnOnEmptyResult: true
}

export default class DataviewPlugin extends Plugin {
	settings: DataviewSettings;
	workspace: Workspace;

	index: FullIndex;
	tasks: TaskCache;

	async onload() {
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
		this.workspace = this.app.workspace;
		this.index = null;
		this.tasks = null;

		this.addSettingTab(new DataviewSettingsTab(this.app, this));

		console.log("Dataview Plugin - Version 0.1.9 Loaded");

		if (!this.workspace.layoutReady) {
			this.workspace.on("layout-ready", async () => this.prepareIndexes());
		} else {
			await this.prepareIndexes();
		}

		// Main entry point for dataview.
		// TODO: Replace w/ code post processor & raise minimum version.
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			// Look for a <code> element with a 'language-dataview' class.
			let dataviewCode = el.find('code.language-dataview');
			if (!dataviewCode) return;
			el.removeChild(el.firstChild);

			let query = tryOrPropogate(() => parseQuery(dataviewCode.innerText));

			// In case of parse error, just render the error.
			if (typeof query === 'string') {
				renderErrorPre(el, "Dataview: " + query);
				return;
			}

			// TODO: Look into cleaner ways to ensure the indices are initialized before rendering.
			// We currently use a dummy render child which passes off to another render child upon success;
			// perhaps we can pass the ctx along?

			switch (query.type) {
				case 'task':
					ctx.addChild(this.wrapWithEnsureTaskIndex(ctx, el,
						() => new DataviewTaskRenderer(query as Query, el, this.index, this.tasks, this.app.vault, this.settings)));
					break;
				case 'list':
					ctx.addChild(this.wrapWithEnsureIndex(ctx, el,
						() => new DataviewListRenderer(query as Query, el, this.index, this.settings)));
					break;
				case 'table':
					ctx.addChild(this.wrapWithEnsureIndex(ctx, el,
						() => new DataviewTableRenderer(query as Query, el, this.index, this.settings)));
					break;
			}
		});
	}

	onunload() { }

	/** Prepare all dataview indices. */
	async prepareIndexes() {
		this.index = await FullIndex.generate(this.app.vault, this.app.metadataCache);
		this.tasks = await TaskCache.generate(this.app.vault);

		// TODO: A little hacky; improve the index to include the task cache in the future.
		this.index.on("reload", file => this.tasks.reloadFile(file));
	}

	/** Update plugin settings. */
	async updateSettings(settings: Partial<DataviewSettings>) {
		this.settings = Object.assign(this.settings, settings);
		await this.saveData(this.settings);
	}

	private wrapWithEnsureIndex(ctx: MarkdownPostProcessorContext, container: HTMLElement, success: () => MarkdownRenderChild): EnsurePredicateRenderer {
		return new EnsurePredicateRenderer(ctx, container, () => this.index != null, success);
	}

	private wrapWithEnsureTaskIndex(ctx: MarkdownPostProcessorContext, container: HTMLElement, success: () => MarkdownRenderChild): EnsurePredicateRenderer {
		return new EnsurePredicateRenderer(ctx, container,
			() => (this.index != null) && (this.tasks != null),
			success);
	}
}

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
	}
}

/** A generic renderer which waits for a predicate, only continuing on success. */
class EnsurePredicateRenderer extends MarkdownRenderChild {
	static CHECK_INTERVAL_MS = 1_000;

	update: () => boolean;
	success: () => MarkdownRenderChild;

	ctx: MarkdownPostProcessorContext;
	dead: boolean;
	container: HTMLElement;

	constructor(ctx: MarkdownPostProcessorContext,
		container: HTMLElement,
		update: () => boolean,
		success: () => MarkdownRenderChild) {
		super();

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

/** Renders a list dataview for the given query. */
class DataviewListRenderer extends MarkdownRenderChild {
	// If true, kill any waiting / pending operations since this view was killed.
	query: Query;
	container: HTMLElement;
	index: FullIndex;
	settings: DataviewSettings;

	constructor(query: Query, container: HTMLElement, index: FullIndex, settings: DataviewSettings) {
		super();

		this.query = query;
		this.container = container;
		this.index = index;
		this.settings = settings;
	}

	onload() {
		let result = tryOrPropogate(() => execute(this.query, this.index));
		if (typeof result === 'string') {
			renderErrorPre(this.container, "Dataview: " + result);
		} else if (result.data.length == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Dataview: Query returned 0 results.");
		} else {
			renderList(this.container, result.data.map(e => {
				let cleanName = getFileName(e.file).replace(".md", "");
				return createAnchor(cleanName, e.file.replace(".md", ""), true);
			}));
		}
	}
}

class DataviewTableRenderer extends MarkdownRenderChild {
	query: Query;
	container: HTMLElement;
	index: FullIndex;
	settings: DataviewSettings;

	constructor(query: Query, container: HTMLElement, index: FullIndex, settings: DataviewSettings) {
		super();

		this.query = query;
		this.container = container;
		this.index = index;
		this.settings = settings;
	}

	onload() {
		let result = tryOrPropogate(() => execute(this.query, this.index));
		if (typeof result === 'string') {
			renderErrorPre(this.container, "Dataview: " + result);
			return;
		}

		let prettyFields = result.names.map(prettifyYamlKey);
		renderTable(this.container, ["Name"].concat(prettyFields), result.data.map(row => {
			let filename = getFileName(row.file).replace(".md", "");
			let result: (string | HTMLElement)[] =
				[createAnchor(filename, row.file.replace(".md", ""), true)];

			for (let elem of row.data) {
				result.push(renderField(elem, this.settings.renderNullAs));
			}

			return result;
		}));

		// Render after the empty table, so the table header still renders.
		if (result.data.length == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Dataview: Query returned 0 results.");
		}
	}
}

class DataviewTaskRenderer extends MarkdownRenderChild {
	query: Query;
	container: HTMLElement;
	index: FullIndex;
	tasks: TaskCache;
	vault: Vault;
	settings: DataviewSettings;

	constructor(query: Query, container: HTMLElement, index: FullIndex, tasks: TaskCache, vault: Vault, settings: DataviewSettings) {
		super();

		this.query = query;
		this.container = container;

		this.index = index;
		this.tasks = tasks;
		this.vault = vault;
		this.settings = settings;
	}

	async onload() {
		let result = tryOrPropogate(() => executeTask(this.query, this.index, this.tasks));
		if (typeof result === 'string') {
			renderErrorPre(this.container, "Dataview: " + result);
		} else if (result.size == 0 && this.settings.warnOnEmptyResult) {
			renderErrorPre(this.container, "Query returned 0 results.");
		} else {
			Tasks.renderFileTasks(this.container, result);
			// TODO: Merge this into this renderer.
			this.addChild(new Tasks.TaskViewLifecycle(this.vault, this.container));
		}
	}
}

/** Wait for a given predicate (querying at the given interval). */
async function waitFor(interval: number, predicate: () => boolean, cancel: () => boolean): Promise<boolean> {
	if (cancel()) return false;

	const wait = (ms: number) => new Promise((re, rj) => setTimeout(re, ms));
	while (!predicate()) {
		if (cancel()) return false;
		await wait(interval);
	}
	
	return true;
}

/** Try calling the given function; on failure, return the error message.  */
function tryOrPropogate<T>(func: () => T): T | string {
	try {
		return func();
	} catch (error) {
		return "" + error + "\n\n" + error.stack;
	}
}