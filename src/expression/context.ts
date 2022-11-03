/** Core implementation of the query language evaluation engine. */

import { DataObject, Literal, Values } from "data-model/value";
import { Result } from "api/result";
import { BinaryOpHandler, createBinaryOps } from "./binaryop";
import { Field, Fields } from "./field";
import { DEFAULT_FUNCTIONS, FunctionImpl } from "./functions";
import { QuerySettings } from "settings";

/** Handles link resolution and normalization inside of a context. */
export interface LinkHandler {
    /** Resolve a link to the metadata it contains. */
    resolve(path: string): Record<string, Literal> | null;
    /**
     * Normalize a link to it's fully-qualified path for comparison purposes.
     * If the path does not exist, returns it unchanged.
     */
    normalize(path: string): string;
    /** Return true if the given path actually exists, false otherwise. */
    exists(path: string): boolean;
}

/**
 * Evaluation context that expressions can be evaluated in. Includes global state, as well as available functions and a handler
 * for binary operators.
 */
export class Context {
    /**
     * Create a new context with the given namespace of globals, as well as optionally with custom binary operator, function,
     * and link handlers.
     */
    public constructor(
        public linkHandler: LinkHandler,
        public settings: QuerySettings,
        public globals: Record<string, Literal> = {},
        public binaryOps: BinaryOpHandler = createBinaryOps(linkHandler.normalize),
        public functions: Record<string, FunctionImpl> = DEFAULT_FUNCTIONS
    ) {}

    /** Set a global value in this context. */
    public set(name: string, value: Literal): Context {
        this.globals[name] = value;
        return this;
    }

    /** Get the value of a global variable by name. Returns null if not present. */
    public get(name: string): Literal {
        return this.globals[name] ?? null;
    }

    /** Try to evaluate an arbitrary field in this context, raising an exception on failure. */
    public tryEvaluate(field: Field, data: Record<string, Literal> = {}): Literal {
        return this.evaluate(field, data).orElseThrow();
    }

    /** Evaluate an arbitrary field in this context. */
    public evaluate(field: Field, data: Record<string, Literal> = {}): Result<Literal, string> {
        switch (field.type) {
            case "literal":
                return Result.success(field.value);
            case "variable":
                if (field.name in data) return Result.success(data[field.name]);
                else if (field.name in this.globals) return Result.success(this.globals[field.name]);
                else return Result.success(null);
            case "negated":
                return this.evaluate(field.child, data).map(s => !Values.isTruthy(s));
            case "binaryop":
                return Result.flatMap2(this.evaluate(field.left, data), this.evaluate(field.right, data), (a, b) =>
                    this.binaryOps.evaluate(field.op, a, b, this)
                );
            case "list":
                let result = [];
                for (let child of field.values) {
                    let subeval = this.evaluate(child, data);
                    if (!subeval.successful) return subeval;
                    result.push(subeval.value);
                }
                return Result.success(result);
            case "object":
                let objResult: DataObject = {};
                for (let [key, child] of Object.entries(field.values)) {
                    let subeval = this.evaluate(child, data);
                    if (!subeval.successful) return subeval;
                    objResult[key] = subeval.value;
                }
                return Result.success(objResult);
            case "lambda":
                // Just relying on JS to capture 'data' for us implicitly; unsure
                // if this is correct thing to do. Could cause weird behaviors.
                return Result.success((ctx: Context, ...args: Literal[]) => {
                    let copy: Record<string, Literal> = Object.assign({}, data);
                    for (let arg = 0; arg < Math.min(args.length, field.arguments.length); arg++) {
                        copy[field.arguments[arg]] = args[arg];
                    }

                    return ctx.evaluate(field.value, copy).orElseThrow();
                });
            case "function":
                let rawFunc =
                    field.func.type == "variable"
                        ? Result.success<string, string>(field.func.name)
                        : this.evaluate(field.func, data);
                if (!rawFunc.successful) return rawFunc;
                let func = rawFunc.value;

                let args: Literal[] = [];
                for (let arg of field.arguments) {
                    let resolved = this.evaluate(arg, data);
                    if (!resolved.successful) return resolved;
                    args.push(resolved.value);
                }

                let call: FunctionImpl;
                if (Values.isFunction(func)) call = func as FunctionImpl;
                else if (Values.isString(func) && func in this.functions) call = this.functions[func];
                else if (Values.isString(func)) return Result.failure(`Unrecognized function name '${func}'`);
                else return Result.failure(`Cannot call type '${Values.typeOf(func)}' as a function`);

                try {
                    return Result.success(call(this, ...args));
                } catch (e) {
                    return Result.failure(e.message);
                }
            case "index":
                // TODO: Will move this out to an 'primitives' module and add more content to it.
                let literalIndex = this.evaluate(field.index, data);
                let checkedIndex: Result<string | number | null, string> = literalIndex.flatMap(s =>
                    Values.isString(s) || Values.isNumber(s) || Values.isNull(s)
                        ? Result.success<string | number | null, string>(s)
                        : Result.failure("Can only index with a string or number")
                );
                if (!checkedIndex.successful) return checkedIndex;

                let index = checkedIndex.value;
                if (Values.isNull(index)) return Result.success(null);

                let checkedObject =
                    field.object.type == "variable" && field.object.name == "row"
                        ? Result.success<Literal, string>(Object.assign({}, this.globals, data))
                        : this.evaluate(field.object, data);
                if (!checkedObject.successful) return checkedObject;

                let object = Values.wrapValue(checkedObject.value);
                if (!object) return Result.failure("Unrecognized object to index into: " + object);

                switch (object.type) {
                    case "object":
                        if (!Values.isString(index))
                            return Result.failure('can only index into objects with strings (a.b or a["b"])');
                        return Result.success(object.value[index] ?? null);
                    case "link":
                        if (!Values.isString(index))
                            return Result.failure('can only index into links with strings (a.b or a["b"])');
                        let linkValue = this.linkHandler.resolve(object.value.path);
                        if (Values.isNull(linkValue)) return Result.success(null);
                        return Result.success(linkValue[index] ?? null);
                    case "array":
                        if (Values.isNumber(index)) {
                            if (index >= object.value.length || index < 0) return Result.success(null);
                            else return Result.success(object.value[index]);
                        } else if (Values.isString(index)) {
                            let result: Literal[] = [];
                            for (let value of object.value) {
                                let next = this.evaluate(Fields.index(Fields.literal(value), Fields.literal(index)));
                                if (!next.successful) continue;
                                result.push(next.value);
                            }
                            return Result.success(result);
                        } else {
                            return Result.failure(
                                "Array indexing requires either a number (to get a specific element), or a string (to map all elements inside the array)"
                            );
                        }
                    case "string":
                        if (!Values.isNumber(index))
                            return Result.failure("string indexing requires a numeric index (string[index])");
                        if (index >= object.value.length || index < 0) return Result.success(null);
                        return Result.success(object.value[index]);
                    case "date":
                        if (!Values.isString(index))
                            return Result.failure("date indexing requires a string representing the unit");
                        switch (index) {
                            case "year":
                                return Result.success(object.value.year);
                            case "month":
                                return Result.success(object.value.month);
                            case "weekyear":
                                return Result.success(object.value.weekNumber);
                            case "week":
                                return Result.success(Math.floor(object.value.day / 7) + 1);
                            case "weekday":
                                return Result.success(object.value.weekday);
                            case "day":
                                return Result.success(object.value.day);
                            case "hour":
                                return Result.success(object.value.hour);
                            case "minute":
                                return Result.success(object.value.minute);
                            case "second":
                                return Result.success(object.value.second);
                            case "millisecond":
                                return Result.success(object.value.millisecond);
                            default:
                                return Result.success(null);
                        }
                    case "duration":
                        if (!Values.isString(index))
                            return Result.failure("duration indexing requires a string representing the unit");
                        switch (index) {
                            case "year":
                            case "years":
                                return Result.success(object.value.shiftTo("years").years);
                            case "month":
                            case "months":
                                return Result.success(object.value.shiftTo("months").months);
                            case "weeks":
                                return Result.success(object.value.shiftTo("weeks").weeks);
                            case "day":
                            case "days":
                                return Result.success(object.value.shiftTo("days").days);
                            case "hour":
                            case "hours":
                                return Result.success(object.value.shiftTo("hours").hours);
                            case "minute":
                            case "minutes":
                                return Result.success(object.value.shiftTo("minutes").minutes);
                            case "second":
                            case "seconds":
                                return Result.success(object.value.shiftTo("seconds").seconds);
                            case "millisecond":
                            case "milliseconds":
                                return Result.success(object.value.shiftTo("milliseconds").milliseconds);
                            default:
                                return Result.success(null);
                        }
                    default:
                        return Result.success(null);
                }
        }
    }
}
