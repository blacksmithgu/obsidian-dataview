import { Plugin, Workspace } from 'obsidian';
import { createAnchor } from './render';
import { FullIndex, TaskCache } from './index';
import * as Tasks from './tasks';
import { parseQuery } from './query';
import { execute, executeTask, getFileName } from './engine';

interface DataviewSettings { }

const DEFAULT_SETTINGS: DataviewSettings = { }

export default class DataviewPlugin extends Plugin {
	settings: DataviewSettings;
	workspace: Workspace;

	index: FullIndex;
	tasks: TaskCache;

	async onload() {
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
		this.workspace = this.app.workspace;
		
		console.log("Dataview Plugin - Version 0.1.0 Loaded");

		// Wait for layout-ready so the vault is ready for traversal (doing it before leads to
		// an empty vault object, yielding no markdown files).
		this.workspace.on("layout-ready", async () => {
			this.index = await FullIndex.generate(this.app.vault, this.app.metadataCache);
			this.tasks = await TaskCache.generate(this.app.vault);

			// TODO: A little hacky; improve the index to include the task cache in the future.
			this.index.on("reload", file => this.tasks.reloadFile(file));
		});

		// Main entry point for dataview.
		this.registerMarkdownPostProcessor(async (el, ctx) => {
			let code = parseDataviewBlock(el);
			if (!code) return;

			el.removeChild(el.firstChild);

			// Don't need the index to parse the query, in case of errors.
			let query = parseQuery(code);
			if (typeof query === 'string') {
				el.createEl('h2', { text: query });
				return;
			}

			// Not initialized yet, stall...
			if (this.index === undefined || this.index === null) {
				let header = el.createEl('h2', { text: "Dataview is still indexing files"});

				while (this.index === undefined || this.index === null) {
					// TODO: Move to utility. Then again, this is an anti-pattern :D.
					const wait = (ms: number) => new Promise((re, rj) => setTimeout(re, ms));
					await wait(1_000);
					header.textContent += ".";
				}

				el.removeChild(header);
			}

			if (query.type == 'task') {
				if (this.tasks === undefined || this.tasks === null) {
					let header = el.createEl('h2', { text: "Dataview is still indexing tasks..." });
					while (this.tasks === undefined || this.tasks === null) {
						const wait = (ms: number) => new Promise((re, rj) => setTimeout(re, ms));
						await wait(1_000);
						header.textContent += ".";
					}

					el.removeChild(header);
				}

				let result = executeTask(query, this.index, this.tasks);
				if (typeof result === 'string') {
					el.createEl('h2', { text: result });
				} else {
					Tasks.renderFileTasks(el, result);
					ctx.addChild(new Tasks.TaskViewLifecycle(this.app, el));
				}
			} else if (query.type == 'list') {
				let result = execute(query, this.index);
				if (typeof result === 'string') {
					el.createEl('h2', { text: result });
				} else {
					renderList(el, result.data.map(e => {
						let cleanName = getFileName(e.file).replace(".md", "");
						return createAnchor(cleanName, e.file.replace(".md", ""), true);
					}));
				}
			} else if (query.type == 'table') {
				let result = execute(query, this.index);
				if (typeof result === 'string') {
					el.createEl('h2', { text: result });
					return;
				}

				let prettyFields = result.names.map(prettifyYamlKey);
				renderTable(el, ["Name"].concat(prettyFields), result.data.map(row => {
					let filename = getFileName(row.file).replace(".md", "");
					let result: (string | HTMLElement)[] =
						[createAnchor(filename, row.file.replace(".md", ""), true)];
				
					for (let elem of row.data) {
						result.push("" + elem.value);
					}

					return result;
				}));
			}
		});
	}

	onunload() { }
}

/** Parse a div block from the postprocessor, looking for codeblocks. Returns the query on success. */
function parseDataviewBlock(element: HTMLElement): string | null {
	// Look for a <code> element with a 'language-dataview' class.
	let dataviewCode = element.find('code.language-dataview');
	if (!dataviewCode) return null;

	// Parse the inside of the code element for the type and query.
	return dataviewCode.innerText;
}

/** Pretifies YAML keys like 'time-played' into 'Time Played' */
function prettifyYamlKey(key: string): string {
	if (key.length == 0) return key;
	let result = key[0].toUpperCase();

	// Hacky camel case detection. Will do unwanted things for stuff like 'LaTeX'.
	// May remove in the future, dunno.
	for (let index = 1; index < key.length; index++) {
		let isNewWord = key[index].toUpperCase() == key[index]
			&& key[index - 1].toLowerCase() == key[index - 1];
		isNewWord = isNewWord || (key[index - 1] == "_");
		isNewWord = isNewWord || (key[index - 1] == "-");
		
		if (isNewWord) {
			result += " " + key[index].toUpperCase();
		} else {
			result += key[index];
		}
	}

	return result.replace("-", "").replace("_", "");
}

/** Create a list inside the given container, with the given data. */
function renderList(container: HTMLElement, elements: (string | HTMLElement)[]) {
	let listEl = container.createEl('ul', { cls: 'list-view-ul' });
	for (let elem of elements) {
		if (typeof elem == "string") {
			listEl.createEl('li', { text: elem });
		} else {
			listEl.appendChild(elem);
		}
	}
}

/** Create a table inside the given container, with the given data. */
function renderTable(container: HTMLElement, headers: string[], values: (string | HTMLElement)[][]) {
	let tableEl = container.createEl('table', { cls: 'table-view-table' });

	let headerEl = tableEl.createEl('tr');
	for (let header of headers) {
		headerEl.createEl('th', { text: header });
	}

	for (let row of values) {
		let rowEl = tableEl.createEl('tr');
		for (let value of row) {
			if (typeof value == "string") {
				rowEl.createEl('td', { text: value });
			} else {
				rowEl.appendChild(value);
			}
		}
	}
}
