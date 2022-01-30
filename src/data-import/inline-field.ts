/** Parse inline fields and other embedded metadata in a line. */

import { EXPRESSION } from "expression/parse";
import { Literal, Values } from "data-model/value";
import { DateTime } from "luxon";

/** A parsed inline field. */
export interface InlineField {
    /** The raw parsed key. */
    key: string;
    /** The raw value of the field. */
    value: string;
    /** The start column of the field. */
    start: number;
    /** The start column of the *value* for the field. */
    startValue: number;
    /** The end column of the field. */
    end: number;
    /** If this inline field was defined via a wrapping ('[' or '('), then the wrapping that was used. */
    wrapping: string | undefined;
}

/** The wrapper characters that can be used to define an inline field. */
export const INLINE_FIELD_WRAPPERS: Readonly<Record<string, string>> = Object.freeze({
    "[": "]",
    "(": ")",
});

/**
 * Find a matching closing bracket that occurs at or after `start`, respecting nesting and escapes. If found,
 * returns the value contained within and the string index after the end of the value.
 */
function findClosing(
    line: string,
    start: number,
    open: string,
    close: string
): { value: string; endIndex: number } | undefined {
    let nesting = 0;
    let escaped = false;
    for (let index = start; index < line.length; index++) {
        let char = line.charAt(index);

        // Allows for double escapes like '\\' to be rendered normally.
        if (char == "\\") {
            escaped = !escaped;
            continue;
        }

        if (escaped) {
            escaped = false;
            continue;
        }

        if (char == open) nesting++;
        else if (char == close) nesting--;

        // Only occurs if we are on a close character and trhere is no more nesting.
        if (nesting < 0) return { value: line.substring(start, index).trim(), endIndex: index + 1 };

        escaped = false;
    }

    return undefined;
}

/** Find the '::' separator in an inline field. */
function findSeparator(line: string, start: number): { key: string; valueIndex: number } | undefined {
    let sep = line.indexOf("::", start);
    let key = line.substring(start, sep);

    // Fail the match if we find any separator characters (not allowed in keys).
    for (let sep of Object.keys(INLINE_FIELD_WRAPPERS).concat(Object.values(INLINE_FIELD_WRAPPERS))) {
        if (key.includes(sep)) return undefined;
    }

    return { key: key.trim(), valueIndex: sep + 2 };
}

/** Try to completely parse an inline field starting at the given position. Assuems `start` is on a wrapping character. */
function findSpecificInlineField(line: string, start: number): InlineField | undefined {
    let open = line.charAt(start);

    let key = findSeparator(line, start + 1);
    if (key === undefined) return undefined;

    let value = findClosing(line, key.valueIndex, open, INLINE_FIELD_WRAPPERS[open]);
    if (value === undefined) return undefined;

    return {
        key: key.key,
        value: value.value,
        start: start,
        startValue: key.valueIndex,
        end: value.endIndex,
        wrapping: open,
    };
}

/** Parse a textual inline field value into something we can work with. */
export function parseInlineValue(value: string): Literal {
    // The stripped literal field parser understands all of the non-array/non-object fields and can parse them for us.
    // Inline field objects are not currently supported; inline array objects have to be handled by the parser
    // separately.
    let inline = EXPRESSION.inlineField.parse(value);
    if (inline.status) return inline.value;
    else return value;
}

/** Extracts inline fields of the form '[key:: value]' from a line of text. This is done in a relatively
 * "robust" way to avoid failing due to bad nesting or other interfering Markdown symbols:
 *
 * - Look for any wrappers ('[' and '(') in the line, trying to parse whatever comes after it as an inline key::.
 * - If successful, scan until you find a matching end bracket, and parse whatever remains as an inline value.
 */
export function extractInlineFields(line: string): InlineField[] {
    let fields: InlineField[] = [];
    for (let wrapper of Object.keys(INLINE_FIELD_WRAPPERS)) {
        let foundIndex = line.indexOf(wrapper);
        while (foundIndex >= 0) {
            let parsedField = findSpecificInlineField(line, foundIndex);
            if (!parsedField) {
                foundIndex = line.indexOf(wrapper, foundIndex + 1);
                continue;
            }

            fields.push(parsedField);
            foundIndex = line.indexOf(wrapper, parsedField.end);
        }
    }

    fields.sort((a, b) => a.start - b.start);
    return fields;
}

export const CREATED_DATE_REGEX = /\u{2795}\s*(\d{4}-\d{2}-\d{2})/u;
export const DUE_DATE_REGEX = /[\u{1F4C5}\u{1F4C6}\u{1F5D3}]\s*(\d{4}-\d{2}-\d{2})/u;
export const DONE_DATE_REGEX = /\u{2705}\s*(\d{4}-\d{2}-\d{2})/u;

/** Parse special completed/due/done task fields which are marked via emoji. */
export function extractSpecialTaskFields(
    line: string,
    annotations?: Record<string, Literal>
): {
    created?: DateTime;
    due?: DateTime;
    completed?: DateTime;
} {
    let result: { created?: DateTime; due?: DateTime; completed?: DateTime } = {};

    let createdMatch = CREATED_DATE_REGEX.exec(line);
    if (createdMatch) result.created = DateTime.fromISO(createdMatch[1]);

    let dueMatch = DUE_DATE_REGEX.exec(line);
    if (dueMatch) result.due = DateTime.fromISO(dueMatch[1]);

    let completedMatch = DONE_DATE_REGEX.exec(line);
    if (completedMatch) result.completed = DateTime.fromISO(completedMatch[1]);

    // Allow for textual fields to be used instead of the emoji for losers like me.
    if (annotations) {
        let anCreated = annotations.created ?? annotations.ctime ?? annotations.cday;
        if (anCreated && Values.isDate(anCreated)) result.created = result.created ?? anCreated;

        let anCompleted = annotations.completion ?? annotations.comptime ?? annotations.compday;
        if (anCompleted && Values.isDate(anCompleted)) result.completed = result.completed ?? anCompleted;

        let anDue = annotations.due ?? annotations.duetime ?? annotations.dueday;
        if (anDue && Values.isDate(anDue)) result.due = result.due ?? anDue;
    }

    return result;
}

/** Sets or replaces the value of an inline field; if the value is 'undefined', deletes the key. */
export function setInlineField(source: string, key: string, value?: string): string {
    let existing = extractInlineFields(source);
    let existingKeys = existing.filter(f => f.key == key);

    // Don't do anything if there are duplicate keys OR the key already doesn't exist.
    if (existingKeys.length > 2 || (existingKeys.length == 0 && !value)) return source;
    let existingKey = existingKeys[0];

    let annotation = value ? `[${key}:: ${value}]` : "";
    if (existingKey) {
        let prefix = source.substring(0, existingKey.start);
        let suffix = source.substring(existingKey.end);

        if (annotation) return `${prefix}${annotation}${suffix}`;
        else return `${prefix}${suffix.trimStart()}`;
    } else if (annotation) {
        return `${source.trimEnd()} ${annotation}`;
    }

    return source;
}
