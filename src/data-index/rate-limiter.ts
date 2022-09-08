/**
 * Simple asynchronous rate limiter which uses a token-based system to throttle tasks.
 * If a token is available, the task will run immediately; otherwise, it will be paused
 * until the next token is available. Tokens can either be infinite or generated on a fixed
 * time schedule.
 *
 * Tasks are identified by a string key (or null if there is no reasonable key); outstanding tasks
 * by the same key will be skipped if another task with the same key is currently in queue for execution.
 */
export class RateLimiter {
    private outstanding: Record<string, Promise<any>>;

    public constructor(public token: TokenProvider) {
        this.outstanding = {};
    }

    /**
     * Call a function once it would be allowed through by the rate limiter; if a
     * function with the same key is already executing, then return the result of that
     * execution in leiu of starting a new one.
     */
    public async run<T>(key: string | null, func: () => Promise<T>): Promise<T> {
        if (key !== null && key in this.outstanding) {
            return await this.outstanding[key];
        } else if (key !== null) {
            let promise = this.outstanding[key] = this.execute(func);
            let result = await promise;

            delete this.outstanding[key];
            return result;
        } else {
            return await this.execute(func);
        }
    }

    /** Internally wait for a token and execute the function. */
    private async execute<T>(func: () => Promise<T>): Promise<T> {
        await this.token.take();
        return await func();
    }
}

/** Simple interface which asynchronously gives out tokens when they become available. */
export interface TokenProvider {
    /** Asynchronously wait for a new token to be available from this token provider. */
    async take(): Promise<void>;
}

/** Rate-limiting token provider which allows at most N requests/second */
export class RegularTimingTokenProvider implements TokenProvider {

}
