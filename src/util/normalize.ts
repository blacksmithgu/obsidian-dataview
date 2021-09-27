import { DateTime, Duration } from "luxon";
import { Result } from "api/result";

/** Normalize a duration to all of the proper units. */
export function normalizeDuration(dur: Duration) {
    return dur.shiftTo("years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds").normalize();
}

/** Strip the time components of a date time object. */
export function stripTime(dt: DateTime): DateTime {
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

const ALLOWABLE_VAR_CHARACTERS = /[0-9\w\p{Letter}\p{Extended_Pictographic}\-]/u;
const WHITESPACE = /\s/;

/** Convert an arbitrary variable name into something JS/query friendly. */
export function canonicalizeVarName(name: string): string {
    // Strip down to purely alphanumeric + spaces.
    let result = "";
    let lastWasWhitespace = false;
    for (let index = 0; index < name.length; index++) {
        let ch = name[index];
        if (ch.match(WHITESPACE)) {
            if (!lastWasWhitespace) result += "-";
            lastWasWhitespace = true;
            continue;
        }
        lastWasWhitespace = false;

        if (!ch.match(ALLOWABLE_VAR_CHARACTERS)) continue;
        result += ch.toLocaleLowerCase();
    }

    return result;
}

/** Try calling the given function; on failure, return the error message.  */
export function tryOrPropogate<T>(func: () => Result<T, string>): Result<T, string> {
    try {
        return func();
    } catch (error) {
        return Result.failure("" + error + "\n\n" + error.stack);
    }
}

/** Try asynchronously calling the given function; on failure, return the error message. */
export async function asyncTryOrPropogate<T>(func: () => Promise<Result<T, string>>): Promise<Result<T, string>> {
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
