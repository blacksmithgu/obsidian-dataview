import { Duration } from "luxon";

/** Normalize a duration to all of the proper units. */
export function normalizeDuration(dur: Duration) {
	return dur.shiftTo("years", "months", "weeks", "days", "hours", "minutes", "seconds", "milliseconds").normalize();
}