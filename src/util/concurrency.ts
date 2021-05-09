/**
 * Busily wait for a promise to return with a maximum timeout. This should only be used if you KNOW you are not on the
 * main application thread.
 */
export function busyAwait<T>(promise: Promise<T>, timeoutMs: number): T | undefined {
	let finished = false;
	let result: T | undefined = undefined;
	promise.then(
		val => {
			result = val;
			finished = true;
		},
		reason => {
			finished = true;
		});

	let startTime = new Date().getTime();
	while (!finished && (new Date().getTime() - startTime) < timeoutMs);

	return result;
}

/** Wait for a given predicate (querying at the given interval). */
export async function waitFor(interval: number, predicate: () => boolean, cancel: () => boolean): Promise<boolean> {
	if (cancel()) return false;

	const wait = (ms: number) => new Promise((re, rj) => setTimeout(re, ms));
	while (!predicate()) {
		if (cancel()) return false;
		await wait(interval);
	}

	return true;
}
