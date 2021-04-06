import { DateTime, Duration } from 'luxon';
import { LiteralField } from 'src/query';
import { getFileName, normalizeDuration } from './util/normalize';

/** Make an Obsidian-friendly internal link. */
export function createAnchor(text: string, target: string, internal: boolean): HTMLAnchorElement {
	let a = document.createElement("a");
	a.dataset.href = target;
	a.href = target;
	a.text = text;
	a.target = "_blank";
	a.rel = "noopener";
	if (internal) a.addClass("internal-link");

	return a;
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

	let theadEl = tableEl.createEl('thead');
	let headerEl = theadEl.createEl('tr');
	for (let header of headers) {
		headerEl.createEl('th', { text: header });
	}

	let tbodyEl = tableEl.createEl('tbody');
	for (let row of values) {
		let rowEl = tbodyEl.createEl('tr');
		for (let value of row) {
			if (typeof value == "string") {
				rowEl.createEl('td', { text: value });
			} else {
				let wrapper = rowEl.createEl('td');
				wrapper.appendChild(value);
			}
		}
	}
}

/** Render a pre block with an error in it; returns the element to allow for dynamic updating. */
export function renderErrorPre(container: HTMLElement, error: string): HTMLElement {
	let pre = container.createEl('pre', { cls: ["dataview", "dataview-error"] });
	pre.appendText(error);
	return pre;
}

/** Render a DateTime in a minimal format to save space. */
export function renderMinimalDate(time: DateTime): string {
	// If there is no relevant time specified, fall back to just rendering the date.
	if (time.second == 0 && time.minute == 0 && time.hour == 0) {
		return time.toLocaleString(DateTime.DATE_MED_WITH_WEEKDAY);
	}

	return time.toLocaleString(DateTime.DATETIME_MED);
}

/** Render a duration in a minimal format to save space. */
export function renderMinimalDuration(dur: Duration): string {
	dur = normalizeDuration(dur);

	let result = "";
	if (dur.years) result += `${dur.years} years, `;
	if (dur.months) result += `${dur.months} months, `;
	if (dur.weeks) result += `${dur.weeks} weeks, `;
	if (dur.days) result += `${dur.days} days, `;
	if (dur.hours) result += `${dur.hours} hours, `;
	if (dur.minutes) result += `${dur.minutes} minutes, `;
	if (dur.seconds) result += `${Math.round(dur.seconds)} seconds, `;
	if (dur.milliseconds) result += `${Math.round(dur.milliseconds)} ms, `;
	
	if (result.endsWith(", ")) result = result.substring(0, result.length - 2);
	return result;
}

/** Prettily render a field with the given settings. */
export function renderField(field: LiteralField, nullField: string, expandList: boolean = false): HTMLElement | string {
	switch (field.valueType) {
		case "date":
			return renderMinimalDate(field.value);
		case "duration":
			return renderMinimalDuration(field.value);
		case "array":
			if (expandList) {
				if (field.value.length == 0) return "";
				else if (field.value.length == 1) return renderField(field.value[0], nullField, expandList);

				let list = document.createElement('ul');
				list.classList.add('dataview', 'dataview-ul');
				for (let child of field.value) {
					let li = list.createEl('li');
					let value = renderField(child, nullField, expandList);
					if (typeof value == 'string') {
						li.textContent = value;
					} else {
						li.appendChild(value);
					}
				}

				return list;
			} else {
				return "[" + field.value.map(f => renderField(f, nullField, expandList)).join(", ") + "]";
			}
		case "object":
			if (expandList) {
				if (field.value.size == 0) return "";
				else if (field.value.size == 1) return field.value.keys().next().value + ": " + renderField(field.value.values().next().value, nullField, expandList);

				let list = document.createElement('ul');
				list.classList.add('dataview', 'dataview-ul');
				for (let entry of field.value) {
					let li = list.createEl('li');
					let value = renderField(entry[1], nullField, expandList);
					if (typeof value == 'string') {
						li.textContent = `${entry[0]}: ${value}`;
					} else {
						li.appendText(entry[0] + ":");
						li.appendChild(value);
					}
				}

				return list;
			} else {
				let entries: string[] = [];
				for (let entry of field.value) {
					entries.push(entry[0] + ": " + renderField(entry[1], nullField, expandList));
				}
				return "{ " + entries.join(", ") + " }";
			}
		case "link":
			return createAnchor(getFileName(field.value), field.value.replace(".md", ""), true);
		case "null":
			return nullField;
		case "html":
			return field.value;
		default:
			return "" + field.value;
	}
}