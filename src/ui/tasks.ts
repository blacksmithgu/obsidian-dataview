import { Vault, MarkdownRenderChild, MarkdownRenderer, Component } from 'obsidian';
import { Task, TASK_REGEX } from 'src/data/file';
import { createAnchor } from './render';
import { getFileName } from 'src/util/normalize';

/** Holds DOM events for a rendered task view, including check functionality. */
export class TaskViewLifecycle extends MarkdownRenderChild {
	vault: Vault;

	constructor(vault: Vault, container: HTMLElement) {
		super(container);
		this.vault = vault;
		this.containerEl = container;
	}

	onload() {
		let checkboxes = this.containerEl.querySelectorAll("input");
		for (let index = 0; index < checkboxes.length; index++) {
			const checkbox = checkboxes.item(index);
			this.registerHandler(checkbox);
		}
	}

	registerHandler(checkbox: HTMLInputElement) {
		this.registerDomEvent(checkbox, "click", event => {
			let file = checkbox.dataset["file"];
			let lineno = checkbox.dataset["lineno"];
			let text = checkbox.dataset["text"];
			if (!file || !lineno || !text) return;

			if (!checkbox.hasAttribute('checked')) {
				let newCheckbox = createCheckbox(file, parseInt(lineno), text, true);

				checkbox.parentElement?.addClass('is-checked');
				checkbox.parentElement?.replaceChild(newCheckbox, checkbox);
				this.registerHandler(newCheckbox);

				setTaskCheckedInFile(this.vault, file, parseInt(lineno), text, false, true);
			} else {
				let newCheckbox = createCheckbox(file, parseInt(lineno), text, false);

				checkbox.parentElement?.removeClass('is-checked');
				checkbox.parentElement?.replaceChild(newCheckbox, checkbox);
				this.registerHandler(newCheckbox);

				setTaskCheckedInFile(this.vault, file, parseInt(lineno), text, true, false);
			}
		});
	}
}

/** Render tasks from multiple files. */
export async function renderFileTasks(container: HTMLElement, tasks: Map<string, Task[]>) {
	for (let [path, list] of tasks.entries()) {
		let basepath = path.replace(".md", "");

		let header = container.createEl('h4');
		header.appendChild(createAnchor(getFileName(basepath), basepath, true));
		let div = container.createDiv();

		await renderTasks(div, list);
	}
}

/** Render a list of tasks as a single list. */
export async function renderTasks(container: HTMLElement, tasks: Task[]) {
	let ul = container.createEl('ul', { cls: 'contains-task-list' });
	for (let task of tasks) {
		let li = ul.createEl('li');

		if (task.real) {
            li.addClass('task-list-item');
			if (task.completed) li.addClass('is-checked');
		}

		// Render the text as markdown so that bolds, links, and other things work properly.
		await MarkdownRenderer.renderMarkdown(task.text, li, task.path, new Component());

		// Unwrap the paragraph element that is created.
		let paragraph = li.querySelector("p");
		if (paragraph) {
			li.innerHTML = paragraph.innerHTML;
			paragraph.remove();
		}

        if (task.real) {
            let check = createCheckbox(task.path, task.line, task.text, task.completed);
            li.prepend(check);
        }

		if (task.subtasks.length > 0) {
			renderTasks(li, task.subtasks);
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

	let foundText = match[3];
	let foundCompleted = match[2] == 'X' || match[2] == 'x';

	if (taskText.trim() != foundText.trim()) return;
	if (wasChecked != foundCompleted) return;

	if (check) {
		splitText[taskLine - 1] = splitText[taskLine - 1]
			.replace("- [ ]", "- [x]")
			.replace("- []", "- [x]")
			.replace("-[]", "- [x]");
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
