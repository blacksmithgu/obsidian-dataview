import { App, TFile, getAllTags, Plugin, Workspace } from 'obsidian';
import { createAnchor } from './render';

interface DataviewSettings { }

const DEFAULT_SETTINGS: DataviewSettings = { }

interface DataviewCodeblock {
	/** The type of dataview to render. */
	type: string;
	/** The query string (like '#nice' or 'tasks') to fetch data for. */
	query: string;
	/** The extra fields to render in this dataview. */
	fields: string[];
}

interface Query {

}

export default class DataviewPlugin extends Plugin {
	settings: DataviewSettings;
	workspace: Workspace;

	async onload() {
		this.settings = Object.assign(DEFAULT_SETTINGS, await this.loadData());
		this.workspace = this.app.workspace;
		
		console.log("Dataview Plugin - Version 0.0.1 Loaded");

		this.registerMarkdownPostProcessor(async (el, ctx) => {
			let code = parseDataviewBlock(el);
			if (!code) return;

			if (code.type == 'list') {
				let files = findFilesWithTag(this.app, code.query);
				el.removeChild(el.firstChild);

				let anchors = files.map(elem => createAnchor(
					elem.name.replace(".md", ""),
					elem.path.replace(".md", ""),
					true));

				renderList(el, anchors);
			} else if (code.type == 'table') {
				let files = findFilesWithTag(this.app, code.query);
				el.removeChild(el.firstChild);

				let filesWithMeta = files.map(elem => {
					let front = this.app.metadataCache.getFileCache(elem)?.frontmatter;
					let name = elem.name.replace(".md", "");

					let result: (string | HTMLElement)[] =
						[createAnchor(name, elem.path.replace(".md", ""), true)];

					for (let field of code.fields) {
						result.push("" + (front?.[field] ?? "-"));
					}
					return result;
				});

				let prettyFields = code.fields.map(prettifyYamlKey);
				renderTable(el, ["Name"].concat(prettyFields), filesWithMeta);
			}
		});
	}

	onunload() { }
}

/**
 * Checks if the second tag is the same, or a subset, of the first tag. For example,
 * '#game/shooter' is a subtag of '#game'.
 */
function isSubtag(tag: string, subtag: string): boolean {
	if (tag == subtag) return true;
	
	return subtag.length > tag.length && subtag.startsWith(tag)
		&& subtag.charAt(tag.length) == '/';
}

/** Find all markdown files in the vault which have the given tag. */
function findFilesWithTag(app: App, tag: string): TFile[] {
	// TODO: A simple linear scan for now until I find a more efficient way to do this.
	// We can make a fancier serialized index for better startup performance.
	// And we can additionally have an in-memory index for good performance while running.
	let result = [];
	for (let file of app.vault.getMarkdownFiles()) {
		let meta = app.metadataCache.getFileCache(file);
		let tags = getAllTags(meta);
		if (!tags) continue;

		if (tags.some(value => isSubtag(tag, value))) result.push(file);
	}

	return result;
}

/** Parse a div block from the postprocessor, looking for codeblocks. */
function parseDataviewBlock(element: HTMLElement): DataviewCodeblock | null {
	// Look for a <code> element with a 'language-dataview' class.
	let dataviewCode = element.find('code.language-dataview');
	if (!dataviewCode) return null;

	// Parse the inside of the code element for the type and query.
	let contents = dataviewCode.innerHTML;
	if (!contents.contains(" ")) return null; // TODO: Malformed.

	let split = contents.split(" ").map(elem => elem.trim());

	return {
		type: split[0],
		query: split[1],
		fields: split.slice(2)
	};
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
