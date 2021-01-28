import { Vault, App, TFile, MarkdownRenderChild } from 'obsidian';
import { createAnchor } from './render';

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
	app: App;

	constructor(app: App, container: HTMLElement) {
		super();
		this.app = app;
		this.containerEl = container;
	}

	onload() {
		let checkboxes = this.containerEl.querySelectorAll("input");
		console.log(checkboxes);

		for (let index = 0; index < checkboxes.length; index++) {
			const checkbox = checkboxes.item(index);
			this.registerDomEvent(checkbox, "click", event => {
				if (!checkbox.hasAttribute('checked')) {
					console.log("checking");
					checkbox.setAttribute('checked', "true");
					checkbox.parentElement.addClass('is-checked');

					setTaskCheckedInFile(this.app, checkbox.dataset["file"], parseInt(checkbox.dataset["lineno"]),
						checkbox.dataset["text"], false, true);
				} else {
					console.log("unchecking");
					checkbox.removeAttribute('checked');
					checkbox.parentElement.removeClass('is-checked');

					setTaskCheckedInFile(this.app, checkbox.dataset["file"], parseInt(checkbox.dataset["lineno"]),
						checkbox.dataset["text"], true, false);
				}
			});
		}
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
export function renderFileTasks(container: HTMLElement, tasks: Record<string, Task[]>) {
	for (let path of Object.keys(tasks)) {
		let basepath = path.replace(".md", "");

		let header = container.createEl('h4');
		header.appendChild(createAnchor(basepath, basepath, true));
		let div = container.createDiv();

		renderTasks(div, path, tasks[path]);
	}
}

/** Render a list of tasks as a single list. */
export function renderTasks(container: HTMLElement, path: string, tasks: Task[]) {
	let ul = container.createEl('ul', { cls: 'contains-task-list' });
	for (let task of tasks) {
		let li = ul.createEl('li', { cls: 'task-list-item' });

		let check = li.createEl('input', { type: 'checkbox', cls: 'task-list-item-checkbox' });
		check.dataset["file"] = path;
		check.dataset["lineno"] = "" + task.line;

		// This fields is technically optional, but is provided to double-check
		// we are editing the right line!
		check.dataset["text"] = task.text;

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
export async function setTaskCheckedInFile(app: App, path: string, taskLine: number, taskText: string, wasChecked: boolean, check: boolean) {
	if (check == wasChecked) return;

	let text = await app.vault.adapter.read(path);
	let splitText = text.replace("\r", "").split("\n");

	if (splitText.length < taskLine) return;
	console.log("past length");

	let match = TASK_REGEX.exec(splitText[taskLine - 1]);
	if (!match) return;

	let indent = match[1].replace("\t" , "    ").length;
	let foundText = match[3];
	let foundCompleted = match[2] == 'X' || match[2] == 'x';

	console.log(`${taskText.trim()} | ${foundText.trim()}`);
	if (taskText.trim() != foundText.trim()) return;
	console.log("text matches");
	console.log(splitText[taskLine - 1]);
	console.log(wasChecked);
	console.log(foundCompleted);
	if (wasChecked != foundCompleted) return;
	console.log("check matches");

	if (check) {
		splitText[taskLine - 1] = splitText[taskLine - 1]
			.replace("- [ ]", "- [X]")
			.replace("- []", "- [X]")
			.replace("-[]", "- [X]");
	} else {
		splitText[taskLine - 1] = splitText[taskLine - 1]
			.replace("- [X]", "- [ ]")
			.replace("-[X]", "- [ ]");
	}
	
	let hasRn = text.contains("\r");
	if (hasRn) {
		let final = splitText.join("\r\n");
		await app.vault.adapter.write(path, final);
	} else {
		let final = splitText.join("\n");
		await app.vault.adapter.write(path, final);
	}
}