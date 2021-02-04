/** Make an Obsidian-friendly internal link. */
export function createAnchor(text: string, target: string, internal: boolean) {
	let a = document.createElement("a");
	a.dataset.href = target;
	a.href = target;
	a.text = text;
	a.target = "_blank";
	a.rel = "noopener";
	if (internal) a.addClass("internal-link");

	return a;
}

/** Pretifies YAML keys like 'time-played' into 'Time Played' */
export function prettifyYamlKey(key: string): string {
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
export function renderList(container: HTMLElement, elements: (string | HTMLElement)[]) {
	let listEl = container.createEl('ul', { cls: 'list-view-ul' });
	for (let elem of elements) {
		let li = listEl.createEl('li');
		if (typeof elem == "string") {
			li.appendText(elem);
		} else {
			li.appendChild(elem);
		}
	}
}

/** Create a table inside the given container, with the given data. */
export function renderTable(container: HTMLElement, headers: string[], values: (string | HTMLElement)[][]) {
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

/** Render a pre block with an error in it; returns the element to allow for dynamic updating. */
export function renderErrorPre(container: HTMLElement, error: string): HTMLElement {
	let pre = container.createEl('pre');
	pre.appendText(error);
	return pre;
}