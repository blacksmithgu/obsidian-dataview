import { Duration } from "luxon";

/** Normalize a duration to all of the proper units. */
export function normalizeDuration(dur: Duration) {
	return dur.shiftTo("years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds").normalize();
}

/** Get the file name for the file, without any parent directories. */
export function getFileName(path: string): string {
	if (path.includes("/")) path = path.substring(path.lastIndexOf("/") + 1);
	if (path.endsWith(".md")) path = path.substring(0, path.length - 3);
	return path;
}
