/** Monadic utility class for handling potentially failing computations. */
export class Result<T, E> {

    /** Create a successful result. */
    public static success<T, E>(result: T) {
        return new Result<T, E>(true, result, null);
    }

    /** Create a failing result. */
    public static failure<T, E>(error: E) {
        return new Result<T, E>(false, null, error);
    }

    success: boolean;
    result: T;
    error: E;

    private constructor(success: boolean, result: T, error: E) {
        this.success = success;
        this.result = result;
        this.error = error;
    }

    public map<U>(func: (res: T) => U): Result<U, E> {
        if (this.success) return Result.success(func(this.result));
        else return Result.failure<U, E>(this.error);
    }

    public mapErr<U>(func: (err: E) => U): Result<T, U> {
        if (this.success) return Result.success<T, U>(this.result);
        else return Result.failure<T, U>(func(this.error));
    }

    public flatMap<U>(func: (res: T) => Result<U, E>): Result<U, E> {
        if (this.success) return func(this.result);
        else return Result.failure<U, E>(this.error);
    }

    public flatMapErr<U>(func: (err: E) => Result<T, U>): Result<T, U> {
        if (this.success) return Result.success<T, U>(this.result);
        else return func(this.error);
    }
}