import { DateTime, Duration } from "luxon";
import { Result } from "api/result";
import * as P from "parsimmon";
import emojiRegex from "emoji-regex";
import { QuerySettings } from "settings";
import removeMd from "remove-markdown";

/** Normalize a duration to all of the proper units. */
export function normalizeDuration(dur: Duration) {
    if (dur === undefined || dur === null) return dur;

    return dur.shiftToAll().normalize();
}

/** Strip the time components of a date time object. */
export function stripTime(dt: DateTime): DateTime {
    if (dt === null || dt === undefined) return dt;

    return DateTime.fromObject({
        year: dt.year,
        month: dt.month,
        day: dt.day,
    });
}

/** Try to extract a YYYYMMDD date from a string. */
export function extractDate(str: string): DateTime | undefined {
    let dateMatch = /(\d{4})-(\d{2})-(\d{2})/.exec(str);
    if (!dateMatch) dateMatch = /(\d{4})(\d{2})(\d{2})/.exec(str);
    if (dateMatch) {
        let year = Number.parseInt(dateMatch[1]);
        let month = Number.parseInt(dateMatch[2]);
        let day = Number.parseInt(dateMatch[3]);
        return DateTime.fromObject({ year, month, day });
    }

    return undefined;
}

/** Get the folder containing the given path (i.e., like computing 'path/..'). */
export function getParentFolder(path: string): string {
    return path.split("/").slice(0, -1).join("/");
}

/** Get the file name for the file referenced in the given path, by stripping the parent folders. */
export function getFileName(path: string): string {
    return path.includes("/") ? path.substring(path.lastIndexOf("/") + 1) : path;
}

/** Get the "title" for a file, by stripping other parts of the path as well as the extension. */
export function getFileTitle(path: string): string {
    if (path.includes("/")) path = path.substring(path.lastIndexOf("/") + 1);
    if (path.endsWith(".md")) path = path.substring(0, path.length - 3);
    return path;
}

/** Get the extension of a file from the file path. */
export function getExtension(path: string): string {
    if (!path.includes(".")) return "";
    return path.substring(path.lastIndexOf(".") + 1);
}

/** Parse all subtags out of the given tag. I.e., #hello/i/am would yield [#hello/i/am, #hello/i, #hello]. */
export function extractSubtags(tag: string): string[] {
    let result = [tag];
    while (tag.includes("/")) {
        tag = tag.substring(0, tag.lastIndexOf("/"));
        result.push(tag);
    }

    return result;
}

/** Try calling the given function; on failure, return the error message.  */
export function tryOrPropagate<T>(func: () => Result<T, string>): Result<T, string> {
    try {
        return func();
    } catch (error) {
        return Result.failure("" + error + "\n\n" + error.stack);
    }
}

/** Try asynchronously calling the given function; on failure, return the error message. */
export async function asyncTryOrPropagate<T>(func: () => Promise<Result<T, string>>): Promise<Result<T, string>> {
    try {
        return await func();
    } catch (error) {
        return Result.failure("" + error + "\n\n" + error.stack);
    }
}

/**
 * Escape regex characters in a string.
 * See https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions.
 */
export function escapeRegex(str: string) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A parsimmon parser which canonicalizes variable names while properly respecting emoji. */
const VAR_NAME_CANONICALIZER: P.Parser<string> = P.alt(
    P.regex(new RegExp(emojiRegex(), "")),
    P.regex(/[0-9\p{Letter}_-]+/u).map(str => str.toLocaleLowerCase()),
    P.whitespace.map(_ => "-"),
    P.any.map(_ => "")
)
    .many()
    .map(result => result.join(""));

/** Convert an arbitrary variable name into something JS/query friendly. */
export function canonicalizeVarName(name: string): string {
    return VAR_NAME_CANONICALIZER.tryParse(name);
}

const HEADER_CANONICALIZER: P.Parser<string> = P.alt(
    P.regex(new RegExp(emojiRegex(), "")),
    P.regex(/[0-9\p{Letter}_-]+/u),
    P.whitespace.map(_ => " "),
    P.any.map(_ => " ")
)
    .many()
    .map(result => {
        return result.join("").split(/\s+/).join(" ").trim();
    });

/**
 * Normalizes the text in a header to be something that is actually linkable to. This mimics
 * how Obsidian does it's normalization, collapsing repeated spaces and stripping out control characters.
 */
export function normalizeHeaderForLink(header: string): string {
    return HEADER_CANONICALIZER.tryParse(header);
}

/** Render a DateTime in a minimal format to save space. */
export function renderMinimalDate(time: DateTime, settings: QuerySettings, locale: string): string {
    // If there is no relevant time specified, fall back to just rendering the date.
    if (time.second == 0 && time.minute == 0 && time.hour == 0) {
        return time.toLocal().toFormat(settings.defaultDateFormat, { locale });
    }

    return time.toLocal().toFormat(settings.defaultDateTimeFormat, { locale });
}

/** Render a duration in a minimal format to save space. */
export function renderMinimalDuration(dur: Duration): string {
    dur = normalizeDuration(dur);

    // toHuman outputs zero quantities e.g. "0 seconds"
    dur = Duration.fromObject(
        Object.fromEntries(Object.entries(dur.toObject()).filter(([, quantity]) => quantity != 0))
    );

    return dur.toHuman();
}

/** Determine if two sets are equal in contents. */
export function setsEqual<T>(first: Set<T>, second: Set<T>): boolean {
    if (first.size != second.size) return false;
    for (let elem of first) if (!second.has(elem)) return false;

    return true;
}

/** Normalize a markdown string. Removes all markdown tags and obsidian links. */
export function normalizeMarkdown(str: string): string {
    // [[test]] -> test
    let interim = str.replace(/\[\[([^\|]*?)\]\]/g, "$1");

    // [[test|test]] -> test
    interim = interim.replace(/\[\[.*?\|(.*?)\]\]/, "$1");

    // remove markdown tags
    interim = removeMd(interim);

    return interim;
}
