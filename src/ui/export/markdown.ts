import { SListItem } from "data-model/serialized/markdown";
import { Grouping, Groupings, Literal, Values, Widgets } from "data-model/value";
import { DEFAULT_SETTINGS, ExportSettings, QuerySettings } from "settings";
import { nestItems } from "ui/views/task-view";

////////////
// Tables //
////////////

/** Render a table of literals to Markdown. */
export function markdownTable(
    headers: string[],
    values: Literal[][],
    settings?: QuerySettings & ExportSettings
): string {
    if (values.length > 0 && headers.length != values[0].length)
        throw new Error(
            `The number of headers (${headers.length}) must match the number of columns (${values[0].length})`
        );

    settings = settings ?? DEFAULT_SETTINGS;

    const mvalues: string[][] = [];
    const maxLengths: number[] = Array.from(headers, v => escapeTable(v).length);

    // Pre-construct the table in memory so we can size columns.
    for (let row = 0; row < values.length; row++) {
        const current: string[] = [];
        for (let col = 0; col < values[row].length; col++) {
            const text = tableLiteral(values[row][col], settings.allowHtml, settings);

            current.push(text);
            maxLengths[col] = Math.max(maxLengths[col], text.length);
        }
        mvalues.push(current);
    }

    // Then construct the actual table...
    // Append the header fields first.
    let table = `| ${headers.map((v, i) => padright(escapeTable(v), " ", maxLengths[i])).join(" | ")} |\n`;
    // Then the separating column.
    table += `| ${maxLengths.map(i => padright("", "-", i)).join(" | ")} |\n`;
    // Then the data columns.
    for (let row = 0; row < values.length; row++) {
        table += `| ${mvalues[row].map((v, i) => padright(v, " ", maxLengths[i])).join(" | ")} |\n`;
    }

    return table;
}

/** Convert a value to a Markdown-friendly string. */
function tableLiteral(value: Literal, allowHtml: boolean = true, settings?: QuerySettings): string {
    return escapeTable(rawTableLiteral(value, allowHtml, settings));
}

/** Convert a value to a Markdown-friendly string; does not do escaping. */
function rawTableLiteral(value: Literal, allowHtml: boolean = true, settings?: QuerySettings): string {
    if (!allowHtml) return Values.toString(value, settings);

    if (Values.isArray(value)) {
        return `<ul>${value.map(v => "<li>" + tableLiteral(v, allowHtml, settings) + "</li>").join("")}</ul>`;
    } else if (Values.isObject(value)) {
        const inner = Object.entries(value)
            .map(([k, v]) => {
                return `<li><b>${tableLiteral(k, allowHtml, settings)}</b>: ${tableLiteral(
                    v,
                    allowHtml,
                    settings
                )}</li>`;
            })
            .join("");

        return `<ul>${inner}</ul>`;
    } else {
        return Values.toString(value, settings);
    }
}

/** Don't need to import a library for this one... */
function padright(text: string, padding: string, length: number): string {
    if (text.length >= length) return text;
    return text + padding.repeat(length - text.length);
}

/** Escape bars inside table content to prevent it from messing up table rows. */
function escapeTable(text: string): string {
    return text.split(/(?!\\)\|/i).join("\\|");
}

///////////
// Lists //
///////////

/** Render a list of literal elements to a markdown list. */
export function markdownList(values: Literal[], settings?: QuerySettings & ExportSettings): string {
    return markdownListRec(values, settings, 0);
}

/** Internal recursive function which renders markdown lists. */
function markdownListRec(input: Literal, settings?: QuerySettings & ExportSettings, depth: number = 0): string {
    if (Values.isArray(input)) {
        let result = depth == 0 ? "" : "\n";
        for (let value of input) {
            result += "    ".repeat(depth) + "- ";
            result += markdownListRec(value, settings, depth);
            result += "\n";
        }

        return result;
    } else if (Values.isObject(input)) {
        let result = depth == 0 ? "" : "\n";
        for (let [key, value] of Object.entries(input)) {
            result += "    ".repeat(depth) + "- ";
            result += Values.toString(key) + ": ";
            result += markdownListRec(value, settings, depth);
            result += "\n";
        }

        return result;
    } else if (Values.isWidget(input) && Widgets.isListPair(input)) {
        return `${Values.toString(input.key)}: ${markdownListRec(input.value, settings, depth + 1)}`;
    }

    return Values.toString(input);
}

///////////
// Tasks //
///////////

/** Render the result of a task query to markdown. */
export function markdownTaskList(
    tasks: Grouping<SListItem>,
    settings?: QuerySettings & ExportSettings,
    depth: number = 0
): string {
    if (Groupings.isGrouping(tasks)) {
        let result = "";
        for (let element of tasks) {
            result += "#".repeat(depth + 1) + " " + Values.toString(element.key) + "\n\n";
            result += markdownTaskList(element.rows, settings, depth + 1);
        }
        return result;
    } else {
        // Remove task line duplicates if present to match `taskList()` behavior.
        const [dedupTasks, _] = nestItems(tasks);

        let result = "";
        for (let element of dedupTasks) {
            result += "    ".repeat(depth) + "- ";

            if (element.task) {
                result += `[${element.status}] ${(element.visual ?? element.text).split("\n").join(" ")}\n`;
            } else {
                result += `${(element.visual ?? element.text).split("\n").join(" ")}\n`;
            }

            result += markdownTaskList(element.children, settings, depth + 1);
        }

        return result;
    }
}
