import { Vault, App, TFile, MarkdownRenderChild, MarkdownRenderer } from 'obsidian';
import { createAnchor } from 'src/render';

/**
 * This is work-in-progress, and not currently used anywhere. Enables a special task view
 * and querying on tasks.
 */

/** A specific task. */
export interface Task {
	/** The text of this task. */
	text: string;
	/** The line this task shows up on. */
	line: number;
	/** Whether or not this task was completed. */
	completed: boolean;
	/** Any subtasks of this task. */
	subtasks: Task[];
}

/** Holds DOM events for a rendered task view, including check functionality. */
export class TaskViewLifecycle extends MarkdownRenderChild {
	vault: Vault;

	constructor(vault: Vault, container: HTMLElement) {
		super();
		this.vault = vault;
		this.containerEl = container;
	}

	onload() {
		let checkboxes = this.containerEl.querySelectorAll("input");
		for (let index = 0; index < checkboxes.length; index++) {
			const checkbox = checkboxes.item(index);
			console.log(checkbox);
			this.registerHandler(checkbox);
		}
	}

	registerHandler(checkbox: HTMLInputElement) {
		this.registerDomEvent(checkbox, "click", event => {
			if (!checkbox.hasAttribute('checked')) {
				let newCheckbox = createCheckbox(checkbox.dataset["file"],
					parseInt(checkbox.dataset["lineno"]),
					checkbox.dataset["text"], true);

				checkbox.parentElement.addClass('is-checked');
				checkbox.parentElement.replaceChild(newCheckbox, checkbox);
				this.registerHandler(newCheckbox);

				setTaskCheckedInFile(this.vault, checkbox.dataset["file"], parseInt(checkbox.dataset["lineno"]),
					checkbox.dataset["text"], false, true);
			} else {
				let newCheckbox = createCheckbox(checkbox.dataset["file"],
					parseInt(checkbox.dataset["lineno"]),
					checkbox.dataset["text"], false);

				checkbox.parentElement.removeClass('is-checked');
				checkbox.parentElement.replaceChild(newCheckbox, checkbox);
				this.registerHandler(newCheckbox);

				setTaskCheckedInFile(this.vault, checkbox.dataset["file"], parseInt(checkbox.dataset["lineno"]),
					checkbox.dataset["text"], true, false);
			}
		});
	}
}

/** Matches lines of the form "- [ ] <task thing>". */
const TASK_REGEX = /(\s*)-\s*\[([ Xx\.]?)\]\s*(.+)/i;

/**
 * A hacky approach to scanning for all tasks using regex. Does not support multiline 
 * tasks yet (though can probably be retro-fitted to do so).
*/
export async function findTasksInFile(vault: Vault, file: TFile): Promise<Task[]> {
	let text = await vault.cachedRead(file);

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

/** Render tasks from multiple files. */
export async function renderFileTasks(container: HTMLElement, tasks: Map<string, Task[]>) {
	for (let path of tasks.keys()) {
		let basepath = path.replace(".md", "");

		let header = container.createEl('h4');
		header.appendChild(createAnchor(basepath, basepath, true));
		let div = container.createDiv();

		await renderTasks(div, path, tasks.get(path));
	}
}

/** Render a list of tasks as a single list. */
export async function renderTasks(container: HTMLElement, path: string, tasks: Task[]) {
	let ul = container.createEl('ul', { cls: 'contains-task-list' });
	for (let task of tasks) {
		let li = ul.createEl('li', { cls: 'task-list-item' });

		if (task.completed) {
			li.addClass('is-checked');
		}

		// Render the text as markdown so that bolds, links, and other things work properly.
		await MarkdownRenderer.renderMarkdown(task.text, li, path, null);

		// Unwrap the paragraph element that is created.
		let paragraph = li.querySelector("p");
		if (paragraph) {
			li.innerHTML = paragraph.innerHTML;
			paragraph.remove();
		}

		let check = createCheckbox(path, task.line, task.text, task.completed);
		li.prepend(check);

		if (task.subtasks.length > 0) {
			renderTasks(li, path, task.subtasks);
		}
	}
}

function createCheckbox(file: string, line: number, text: string, checked: boolean): HTMLInputElement {
	let check = document.createElement("input");
	check.addClass('task-list-item-checkbox');
	check.type = 'checkbox';
	check.dataset["file"] = file;
	check.dataset["lineno"] = "" + line;

	// This field is technically optional, but is provided to double-check
	// we are editing the right line!
	check.dataset["text"] = text;

	if (checked) {
		check.setAttribute('checked', '');
	}

	return check;
}

/** Check a task in a file by rewriting it. */
export async function setTaskCheckedInFile(vault: Vault, path: string, taskLine: number, taskText: string, wasChecked: boolean, check: boolean) {
	if (check == wasChecked) return;

	let text = await vault.adapter.read(path);
	let splitText = text.replace("\r", "").split("\n");

	if (splitText.length < taskLine) return;

	let match = TASK_REGEX.exec(splitText[taskLine - 1]);
	if (!match) return;

	let indent = match[1].replace("\t" , "    ").length;
	let foundText = match[3];
	let foundCompleted = match[2] == 'X' || match[2] == 'x';

	if (taskText.trim() != foundText.trim()) return;
	if (wasChecked != foundCompleted) return;

	if (check) {
		splitText[taskLine - 1] = splitText[taskLine - 1]
			.replace("- [ ]", "- [X]")
			.replace("- []", "- [X]")
			.replace("-[]", "- [X]");
	} else {
		splitText[taskLine - 1] = splitText[taskLine - 1]
			.replace("- [X]", "- [ ]")
			.replace("-[X]", "- [ ]")
			.replace("- [x]", "- [ ]")
			.replace("-[x]", "- [ ]");
	}
	
	let hasRn = text.contains("\r");
	if (hasRn) {
		let final = splitText.join("\r\n");
		await vault.adapter.write(path, final);
	} else {
		let final = splitText.join("\n");
		await vault.adapter.write(path, final);
	}
}