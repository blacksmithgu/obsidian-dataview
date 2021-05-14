import { DateTime, Duration } from 'luxon';
import { Component, MarkdownRenderer } from 'obsidian';
import { Fields, LiteralValue } from 'src/query';
import { DataArray } from './api/data-array';
import { normalizeDuration } from './util/normalize';

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

/** Render simple fields compactly, removing wrapping content like '<p>'. */
export async function renderCompactMarkdown(markdown: string, container: HTMLElement, sourcePath: string, component: Component) {
	let subcontainer = container.createSpan();
	await MarkdownRenderer.renderMarkdown(markdown, subcontainer, sourcePath, component);

	if (subcontainer.children.length == 1 && subcontainer.querySelector("p")) {
		subcontainer.innerHTML = subcontainer.querySelector("p")?.innerHTML ?? "";
	}
}

/** Create a list inside the given container, with the given data. */
export async function renderList(container: HTMLElement, elements: LiteralValue[], component: Component, originFile: string,
	nullField: string) {
	let listEl = container.createEl('ul', { cls: ['dataview', 'list-view-ul'] });
	for (let elem of elements) {
		let li = listEl.createEl('li');
		await renderValue(elem, li, originFile, component, nullField, true);
	}
}

/** Create a table inside the given container, with the given data. */
export async function renderTable(container: HTMLElement, headers: string[], values: LiteralValue[][], component: Component,
	originFile: string, nullField: string) {
	let tableEl = container.createEl('table', { cls: ['dataview', 'table-view-table'] });

	let theadEl = tableEl.createEl('thead', { cls: 'table-view-thead' });
	let headerEl = theadEl.createEl('tr', { cls: 'table-view-tr-header' });
	for (let header of headers) {
		headerEl.createEl('th', { text: header, cls: 'table-view-th' });
	}

	let tbodyEl = tableEl.createEl('tbody', { cls: 'table-view-tbody' });
	for (let row of values) {
		let rowEl = tbodyEl.createEl('tr');
		for (let value of row) {
			let td = rowEl.createEl('td');
			await renderValue(value, td, originFile, component, nullField, true);
		}
	}
}

/** Render a pre block with an error in it; returns the element to allow for dynamic updating. */
export function renderErrorPre(container: HTMLElement, error: string): HTMLElement {
	let pre = container.createEl('pre', { cls: ["dataview", "dataview-error"] });
	pre.appendText(error);
	return pre;
}

/** Render a span block with an error in it; returns the element to allow for dynamic updating. */
export function renderErrorSpan(container: HTMLElement, error: string): HTMLElement {
	let pre = container.createEl('span', { cls: ["dataview", "dataview-error"] });
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

/** Prettily render a value into a container with the given settings. */
export async function renderValue(field: LiteralValue, container: HTMLElement, originFile: string, component: Component,
	nullField: string, expandList: boolean = false) {

	if (Fields.isNull(field)) {
		await renderCompactMarkdown(nullField, container, originFile, component);
	} else if (Fields.isDate(field)) {
		container.appendText(renderMinimalDate(field));
	} else if (Fields.isDuration(field)) {
		container.appendText(renderMinimalDuration(field));
	} else if (Fields.isString(field) || Fields.isBoolean(field) || Fields.isNumber(field)) {
		await renderCompactMarkdown("" + field, container, originFile, component);
	} else if (Fields.isArray(field) || DataArray.isDataArray(field)) {
		if (expandList) {
			if (field.length == 0) {
                container.appendText("<empty list>");
                return;
            }

			let list = container.createEl('ul', { cls: ['dataview', 'dataview-ul', 'dataview-result-list-ul'] });
			for (let child of field) {
				let li = list.createEl('li', { cls: 'dataview-result-list-li' });
				await renderValue(child, li, originFile, component, nullField, expandList);
			}
		} else {
			if (field.length == 0) {
				container.appendText("<empty list>");
				return;
			}

			let span = container.createEl('span', { cls: ['dataview', 'dataview-result-list-span' ]});
			let first = true;
			for (let val of field) {
				if (first) first = false;
				else span.appendText(", ");

				await renderValue(val, span, originFile, component, nullField, expandList);
			}
		}
	} else if (Fields.isLink(field)) {
		await renderCompactMarkdown(field.markdown(), container, originFile, component);
	} else if (Fields.isHtml(field)) {
		container.appendChild(field);
	} else if (Fields.isObject(field)) {
		if (expandList) {
			if (Object.keys(field).length == 0) {
				container.appendText("<empty object>");
				return;
			}

			let list = container.createEl('ul', { cls: ['dataview', 'dataview-ul', 'dataview-result-object-ul' ]});
			for (let [key, value] of Object.entries(field)) {
				let li = list.createEl('li', { cls: ['dataview', 'dataview-li', 'dataview-result-object-li'] });
				li.appendText(key + ": ");
				await renderValue(value, li, originFile, component, nullField, expandList);
			}
		} else {
            if (Object.keys(field).length == 0) {
                container.appendText("<empty object>");
                return;
            }

			let span = container.createEl("span", { cls: ['dataview', 'dataview-result-object-span'] });
			let first = true;
			for (let [key, value] of Object.entries(field)) {
				if (first) first = false;
				else span.appendText(", ");

				span.appendText(key + ": ");
				await renderValue(value, span, originFile, component, nullField, expandList);
			}
		}
	} else {
		container.appendText("Unrecognized: " + JSON.stringify(field));
	}
}
