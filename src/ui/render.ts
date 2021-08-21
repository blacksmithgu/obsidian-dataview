import { DateTime, Duration } from 'luxon';
import { Component, MarkdownRenderer } from 'obsidian';
import { DataArray } from 'api/data-array';
import { QuerySettings } from 'settings';
import { currentLocale } from 'util/locale';
import { normalizeDuration } from 'util/normalize';
import { LiteralValue, Values } from 'data/value';

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
	settings: QuerySettings) {
	let listEl = container.createEl('ul', { cls: ['dataview', 'list-view-ul'] });
	for (let elem of elements) {
		let li = listEl.createEl('li');
		await renderValue(elem, li, originFile, component, settings, true, 'list');
	}
}

/** Create a table inside the given container, with the given data. */
export async function renderTable(container: HTMLElement, headers: string[], values: LiteralValue[][], component: Component,
	originFile: string, settings: QuerySettings) {
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
			await renderValue(value, td, originFile, component, settings, true);
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
export function renderMinimalDate(time: DateTime, settings: QuerySettings): string {
	// If there is no relevant time specified, fall back to just rendering the date.
	if (time.second == 0 && time.minute == 0 && time.hour == 0) {
		return time.toFormat(settings.defaultDateFormat, { locale: currentLocale() });
	}

	return time.toFormat(settings.defaultDateTimeFormat, { locale: currentLocale() });
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

export type ValueRenderContext = 'root' | 'list';

/** Prettily render a value into a container with the given settings. */
export async function renderValue(field: LiteralValue, container: HTMLElement, originFile: string, component: Component,
	settings: QuerySettings, expandList: boolean = false, context: ValueRenderContext = 'root') {

	if (Values.isNull(field)) {
		await renderCompactMarkdown(settings.renderNullAs, container, originFile, component);
	} else if (Values.isDate(field)) {
		container.appendText(renderMinimalDate(field, settings));
	} else if (Values.isDuration(field)) {
		container.appendText(renderMinimalDuration(field));
	} else if (Values.isString(field) || Values.isBoolean(field) || Values.isNumber(field)) {
		await renderCompactMarkdown("" + field, container, originFile, component);
	} else if (Values.isArray(field) || DataArray.isDataArray(field)) {
		if (expandList) {
			let list = container.createEl('ul', { cls: ['dataview', 'dataview-ul',
                (context == 'list' ? 'dataview-result-list-ul' : 'dataview-result-list-root-ul')] });
			for (let child of field) {
				let li = list.createEl('li', { cls: 'dataview-result-list-li' });
				await renderValue(child, li, originFile, component, settings, expandList, 'list');
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

				await renderValue(val, span, originFile, component, settings, expandList, 'list');
			}
		}
	} else if (Values.isLink(field)) {
		await renderCompactMarkdown(field.markdown(), container, originFile, component);
	} else if (Values.isHtml(field)) {
		container.appendChild(field);
    } else if (Values.isFunction(field)) {
        container.appendText("<function>");
	} else if (Values.isObject(field)) {
		if (expandList) {
			let list = container.createEl('ul', { cls: ['dataview', 'dataview-ul', 'dataview-result-object-ul' ]});
			for (let [key, value] of Object.entries(field)) {
				let li = list.createEl('li', { cls: ['dataview', 'dataview-li', 'dataview-result-object-li'] });
				li.appendText(key + ": ");
				await renderValue(value, li, originFile, component, settings, expandList);
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
				await renderValue(value, span, originFile, component, settings, expandList);
			}
		}
	} else {
		container.appendText("Unrecognized: " + JSON.stringify(field));
	}
}
