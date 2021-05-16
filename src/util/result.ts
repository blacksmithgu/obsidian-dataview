/** Functional return type for error handling. */
export class Success<T, E> {
    public successful: true;

    public constructor(public value: T) {
        this.successful = true;
    }

    public map<U>(f: (a: T) => U): Success<U, E> {
        return new Success(f(this.value));
    }

    public flatMap<U>(f: (a: T) => Result<U, E>): Result<U, E> {
        return f(this.value);
    }

    public orElse(value: T): T {
        return this.value;
    }

    public orElseThrow(message?: (e: E) => string): T {
        return this.value;
    }
}

export class Failure<T, E> {
    public successful: false;

    public constructor(public error: E) {
        this.successful = false;
    }

    public map<U>(f: (a: T) => U): Failure<U, E> {
        return this as any as Failure<U, E>;
    }

    public flatMap<U>(f: (a: T) => Result<U, E>): Failure<U, E> {
        return this as any as Failure<U, E>;
    }

    public orElse(value: T): T {
        return value;
    }

    public orElseThrow(message?: (e: E) => string): T {
        if (message) throw new Error(message(this.error));
        else throw new Error("" + this.error);
    }
}

export type Result<T, E> = Success<T, E> | Failure<T, E>;

export namespace Result {
    export function success<T, E>(value: T): Result<T, E> {
        return new Success(value);
    }

    export function failure<T, E>(error: E): Result<T, E> {
        return new Failure(error);
    }

    export function flatMap2<T1, T2, O, E>(first: Result<T1, E>, second: Result<T2, E>, f: (a: T1, b: T2) => Result<O, E>): Result<O, E> {
        if (first.successful) {
            if (second.successful) return f(first.value, second.value);
            else return failure(second.error);
        } else {
            return failure(first.error);
        }
    }

    export function map2<T1, T2, O, E>(first: Result<T1, E>, second: Result<T2, E>, f: (a: T1, b: T2) => O): Result<O, E> {
        return flatMap2(first, second, (a, b) => success(f(a, b)));
    }
}
