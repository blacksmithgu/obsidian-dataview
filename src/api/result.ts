/** Functional return type for error handling. */
export class Success<T, E> {
    public successful: true;

    public constructor(public value: T) {
        this.successful = true;
    }

    public map<U>(f: (a: T) => U): Result<U, E> {
        return new Success(f(this.value));
    }

    public flatMap<U>(f: (a: T) => Result<U, E>): Result<U, E> {
        return f(this.value);
    }

    public mapErr<U>(f: (e: E) => U): Result<T, U> {
        return this as any as Result<T, U>;
    }

    public bimap<T2, E2>(succ: (a: T) => T2, _fail: (b: E) => E2): Result<T2, E2> {
        return this.map(succ) as any;
    }

    public orElse(_value: T): T {
        return this.value;
    }

    public cast<U>(): Result<U, E> {
        return this as any;
    }

    public orElseThrow(_message?: (e: E) => string): T {
        return this.value;
    }
}

/** Functional return type for error handling. */
export class Failure<T, E> {
    public successful: false;

    public constructor(public error: E) {
        this.successful = false;
    }

    public map<U>(_f: (a: T) => U): Result<U, E> {
        return this as any as Failure<U, E>;
    }

    public flatMap<U>(_f: (a: T) => Result<U, E>): Result<U, E> {
        return this as any as Failure<U, E>;
    }

    public mapErr<U>(f: (e: E) => U): Result<T, U> {
        return new Failure(f(this.error));
    }

    public bimap<T2, E2>(_succ: (a: T) => T2, fail: (b: E) => E2): Result<T2, E2> {
        return this.mapErr(fail) as any;
    }

    public orElse(value: T): T {
        return value;
    }

    public cast<U>(): Result<U, E> {
        return this as any;
    }

    public orElseThrow(message?: (e: E) => string): T {
        if (message) throw new Error(message(this.error));
        else throw new Error("" + this.error);
    }
}

export type Result<T, E> = Success<T, E> | Failure<T, E>;

/** Monadic 'Result' type which encapsulates whether a procedure succeeded or failed, as well as it's return value. */
export namespace Result {
    /** Construct a new success result wrapping the given value. */
    export function success<T, E>(value: T): Result<T, E> {
        return new Success(value);
    }

    /** Construct a new failure value wrapping the given error. */
    export function failure<T, E>(error: E): Result<T, E> {
        return new Failure(error);
    }

    /** Join two results with a bi-function and return a new result. */
    export function flatMap2<T1, T2, O, E>(
        first: Result<T1, E>,
        second: Result<T2, E>,
        f: (a: T1, b: T2) => Result<O, E>
    ): Result<O, E> {
        if (first.successful) {
            if (second.successful) return f(first.value, second.value);
            else return failure(second.error);
        } else {
            return failure(first.error);
        }
    }

    /** Join two results with a bi-function and return a new result. */
    export function map2<T1, T2, O, E>(
        first: Result<T1, E>,
        second: Result<T2, E>,
        f: (a: T1, b: T2) => O
    ): Result<O, E> {
        return flatMap2(first, second, (a, b) => success(f(a, b)));
    }
}
