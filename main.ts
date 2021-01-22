import { App, TFile, getAllTags, Plugin, Workspace, MarkdownRenderChild } from 'obsidian';

interface DataviewCodeblock {
	/** The type of dataview to render. */
	type: string;
	/** The query string (like '#nice' or 'tasks') to fetch data for. */
	query: string;
	/** The extra fields to render in this dataview. */
	fields: string[];
}

/** A specific task. */
interface Task {
	/** The text of this task. */
	text: string;
	/** The line this task shows up on. */
	line: number;
	/** Whether or not this task was completed. */
	completed: boolean;
	/** Any subtasks of this task. */
	subtasks: Task[];
}

interface DataviewSettings {
}

const DEFAULT_SETTINGS: DataviewSettings = {
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

			if (code.type == 'tasks') {
				let tasks = await findAllTasks(this.app);
				el.removeChild(el.firstChild);

				renderFileTasks(el, tasks);

				ctx.addChild(new TaskViewLifecycle(el));
			} else if (code.type == 'list') {
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

/** Holds DOM events for a rendered task view, including check functionality. */
class TaskViewLifecycle extends MarkdownRenderChild {
	constructor(container: HTMLElement) {
		super();
		this.containerEl = container;
	}

	onload() {
		let checkboxes = this.containerEl.querySelectorAll("input");
		console.log(checkboxes);
		/*
		for (let index = 0; index < checkboxes.length; index++) {
			const checkbox = checkboxes.item(index);
			this.registerDomEvent(checkbox, "click", event => {
				if (!checkbox.hasAttribute('checked')) {
					checkbox.setAttribute('checked', "");
					checkbox.parentElement.addClass('is-checked');
				} else {
					checkbox.removeAttribute('checked');
					checkbox.parentElement.removeClass('is-checked');
				}
			});
		}
		*/
	}
}

/** Make an Obsidian-friendly internal link. */
function createAnchor(text: string, target: string, internal: boolean) {
	let a = document.createElement("a");
	a.dataset.href = target;
	a.href = target;
	a.text = text;
	a.target = "_blank";
	a.rel = "noopener";
	if (internal) a.addClass("internal-link");

	return a;
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

/**
 * Returns a map of file path -> tasks in that file.
 */
async function findAllTasks(app: App): Promise<Record<string, Task[]>> {
	let result: Record<string, Task[]> = {};
	for (let file of app.vault.getMarkdownFiles()) {
		let tasks = await findTasksInFile(app, file);
		if (tasks.length > 0) result[file.path] = tasks;
	}

	return result;
}

/** Matches lines of the form "- [ ] <task thing>". */
const TASK_REGEX = /(\s*)-\s*\[([ Xx\.]?)\]\s*(.+)/i;

/**
 * A hacky approach to scanning for all tasks using regex. Does not support multiline 
 * tasks yet (though can probably be retro-fitted to do so).
*/
async function findTasksInFile(app: App, file: TFile): Promise<Task[]> {
	let text = await app.vault.cachedRead(file);

	// Dummy top of the stack that we'll just never get rid of.
	let stack: [Task, number][] = [];
	stack.push([{ text: "Root", line: -1, completed: false, subtasks: [] }, -4]);

	let lineno = 0;
	for (let line of text.replace("\r", "").split("\n")) {
		lineno += 1;

		let match = TASK_REGEX.exec(line);
		if (!match) continue;

		let indent = match[1].replace("\t" , "    ").length;
		let task: Task = {
			text: match[3],
			completed: match[2] == 'X' || match[2] == 'x',
			line: lineno,
			subtasks: []
		};

		while (indent <= stack.last()[1]) stack.pop();
		stack.last()[0].subtasks.push(task);
		stack.push([task, indent]);
	}

	// Return everything under the root, which should be all tasks.
	return stack[0][0].subtasks;
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

/** Render tasks from multiple files. */
function renderFileTasks(container: HTMLElement, tasks: Record<string, Task[]>) {
	for (let path of Object.keys(tasks)) {
		let basepath = path.replace(".md", "");

		let header = container.createEl('h4');
		header.appendChild(createAnchor(basepath, basepath, true));
		let div = container.createDiv();

		renderTasks(div, path, tasks[path]);
	}
}

/** Render a list of tasks as a single list. */
function renderTasks(container: HTMLElement, path: string, tasks: Task[]) {
	let ul = container.createEl('ul', { cls: 'contains-task-list' });
	for (let task of tasks) {
		let li = ul.createEl('li', { cls: 'task-list-item' });

		let check = li.createEl('input', { type: 'checkbox', cls: 'task-list-item-checkbox' });
		check.dataset["file"] = path;
		check.dataset["lineno"] = "" + task.line;

		// This fields is technically optional, but is provided to double-check
		// we are editing the right line!
		check.dataset["text"] = task.text;

		check.addEventListener("click", event => {
			console.log("clicky");
			check.checked = !check.checked;
		});

		if (task.completed) {
			li.addClass('is-checked');
			check.checked = true;
		} else {
			check.checked = false;
		}

		li.insertAdjacentText("beforeend", task.text);

		if (task.subtasks.length > 0) {
			renderTasks(li, path, task.subtasks);
		}
	}
}

/** Check a task in a file by rewriting it. */
async function setTaskCheckedInFile(app: App, path: string, task: Task, check: boolean) {
	if (check == task.completed) return;

	let text = await app.vault.adapter.read(path);

	// A little slow - read file, go to line, check if line is valid task, and replace it if it is.
	let lineno = 0;
	for (let line of text.replace("\r", "").split("\n")) {
		lineno += 1;

		let match = TASK_REGEX.exec(line);
		if (!match) continue;

		let indent = match[1].replace("\t" , "    ").length;
		let task: Task = {
			text: match[3],
			completed: match[2] == 'X' || match[2] == 'x',
			line: lineno,
			subtasks: []
		};
	}
}