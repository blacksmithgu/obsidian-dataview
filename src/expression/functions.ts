/** Default function implementations for the expression evaluator. */

import { DateTime } from "luxon";
import { LiteralType, Link, Literal, Values, Widgets } from "data-model/value";
import { currentLocale } from "util/locale";
import { LiteralReprAll, LiteralTypeOrAll } from "./binaryop";
import { Context } from "./context";
import { Fields } from "./field";
import { EXPRESSION } from "./parse";
import { escapeRegex, normalizeMarkdown } from "util/normalize";
import { DataArray } from "api/data-array";
import { cyrb53 } from "util/hash";

/**
 * A function implementation which takes in a function context and a variable number of arguments. Throws an error if an
 * invalid number/type of arguments are passed.
 */
export type FunctionImpl = (context: Context, ...rest: Literal[]) => Literal;
/** A "bound" function implementation which has already had a function context passed to it. */
export type BoundFunctionImpl = (...args: Literal[]) => Literal;

/** A function variant used in the function builder which holds the argument types. */
interface FunctionVariant {
    args: LiteralTypeOrAll[];
    varargs: boolean;
    /** The implementing function for this specific variant. */
    impl: FunctionImpl;
}

/**
 * Allows for the creation of functions that check the number and type of their arguments, and dispatch
 * to different implementations based on the types of the inputs.
 */
export class FunctionBuilder {
    variants: FunctionVariant[];
    vectorized: Record<number, number[]>;

    public constructor(public name: string) {
        this.variants = [];
        this.vectorized = {};
    }

    /** Add a general function variant which accepts any number of arguments of any type. */
    public vararg(impl: FunctionImpl): FunctionBuilder {
        this.variants.push({ args: [], varargs: true, impl });
        return this;
    }

    /** Add a function variant which takes in a single argument. */
    public add1<T extends LiteralTypeOrAll>(
        argType: T,
        impl: (a: LiteralReprAll<T>, context: Context) => Literal
    ): FunctionBuilder {
        this.variants.push({
            args: [argType],
            varargs: false,
            impl: (c, ...rest) => impl(rest[0] as LiteralReprAll<T>, c),
        });
        return this;
    }

    /** Add a function variant which takes in two typed arguments. */
    public add2<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(
        arg1: T,
        arg2: U,
        impl: (a: LiteralReprAll<T>, b: LiteralReprAll<U>, context: Context) => Literal
    ): FunctionBuilder {
        this.variants.push({
            args: [arg1, arg2],
            varargs: false,
            impl: (c, ...rest) => impl(rest[0] as LiteralReprAll<T>, rest[1] as LiteralReprAll<U>, c),
        });
        return this;
    }

    /** Add a function variant which takes in three typed arguments. */
    public add3<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll, V extends LiteralTypeOrAll>(
        arg1: T,
        arg2: U,
        arg3: V,
        impl: (a: LiteralReprAll<T>, b: LiteralReprAll<U>, c: LiteralReprAll<V>, context: Context) => Literal
    ): FunctionBuilder {
        this.variants.push({
            args: [arg1, arg2, arg3],
            varargs: false,
            impl: (c, ...rest) =>
                impl(rest[0] as LiteralReprAll<T>, rest[1] as LiteralReprAll<U>, rest[2] as LiteralReprAll<V>, c),
        });
        return this;
    }

    /** Add vectorized variants which accept the given number of arguments and delegate. */
    public vectorize(numArgs: number, positions: number[]): FunctionBuilder {
        this.vectorized[numArgs] = positions;
        return this;
    }

    /** Return a function which checks the number and type of arguments, passing them on to the first matching variant. */
    public build(): FunctionImpl {
        let self: FunctionImpl = (context: Context, ...args: Literal[]) => {
            let types: LiteralType[] = [];
            for (let arg of args) {
                let argType = Values.typeOf(arg);
                if (!argType) throw Error(`Unrecognized argument type for argument '${arg}'`);
                types.push(argType);
            }

            // Handle vectorization, possibly in multiple fields.
            if (this.vectorized[types.length]) {
                let vectorizedPositions = this.vectorized[types.length].filter(k => types[k] == "array");
                if (vectorizedPositions.length > 0) {
                    let minLength = vectorizedPositions
                        .map(p => (args[p] as any[]).length)
                        .reduce((p, c) => Math.min(p, c));

                    // Call the subfunction for each element in the longest array.
                    // If you call a vectorized function with different-length arrays,
                    // the output is limited by the length of the shortest array.
                    let result = [];
                    for (let vpos = 0; vpos < minLength; vpos++) {
                        let subargs = [];
                        for (let index = 0; index < args.length; index++) {
                            if (vectorizedPositions.includes(index)) {
                                let arr = args[index] as any[];
                                subargs.push(arr[vpos]);
                            } else {
                                subargs.push(args[index]);
                            }
                        }

                        result.push(self(context, ...subargs));
                    }

                    return result;
                }
            }

            outer: for (let variant of this.variants) {
                if (variant.varargs) return variant.impl(context, ...args);
                if (variant.args.length != types.length) continue;

                for (let index = 0; index < variant.args.length; index++) {
                    if (variant.args[index] != "*" && variant.args[index] != types[index]) continue outer;
                }

                return variant.impl(context, ...args);
            }

            throw Error(`No implementation of '${this.name}' found for arguments: ${types.join(", ")}`);
        };

        return self;
    }
}

/** Utilities for managing function implementations. */
export namespace Functions {
    /** Bind a context to a function implementation, yielding a function which does not need the context argument. */
    export function bind(func: FunctionImpl, context: Context): BoundFunctionImpl {
        return (...args: Literal[]) => func(context, ...args);
    }

    /** Bind a context to all functions in the given map, yielding a new map of bound functions. */
    export function bindAll(funcs: Record<string, FunctionImpl>, context: Context): Record<string, BoundFunctionImpl> {
        let result: Record<string, BoundFunctionImpl> = {};
        for (let [key, func] of Object.entries(funcs)) {
            result[key] = Functions.bind(func, context);
        }

        return result;
    }
}

/**
 * Collection of all defined functions; defined here so that they can be called from within dataview,
 * and test code.
 */
export namespace DefaultFunctions {
    export const typeOf = new FunctionBuilder("type")
        .add1("array", _ => "array")
        .add1("boolean", _ => "boolean")
        .add1("date", _ => "date")
        .add1("duration", _ => "duration")
        .add1("function", _ => "function")
        .add1("widget", _ => "widget")
        .add1("link", _ => "link")
        .add1("null", _ => "null")
        .add1("number", _ => "number")
        .add1("object", _ => "object")
        .add1("string", _ => "string")
        .add1("*", _ => "unknown")
        .build();

    /** Compute the length of a data type. */
    export const length = new FunctionBuilder("length")
        .add1("array", a => a.length)
        .add1("object", a => Object.keys(a).length)
        .add1("string", a => a.length)
        .add1("null", _a => 0)
        .build();

    /** List constructor function. */
    export const list: FunctionImpl = (_context, ...args) => args;

    /** Object constructor function. */
    export const object: FunctionImpl = (_context, ...args) => {
        if (args.length % 2 != 0) throw Error("object() requires an even number of arguments");
        let result: Record<string, Literal> = {};
        for (let index = 0; index < args.length; index += 2) {
            let key = args[index];
            if (!Values.isString(key)) throw Error("keys should be of type string for object(key1, value1, ...)");
            result[key] = args[index + 1];
        }

        return result;
    };

    /** Internal link constructor function. */
    export const link: FunctionImpl = new FunctionBuilder("link")
        .add1("string", (a, c) => Link.file(c.linkHandler.normalize(a), false))
        .add1("link", a => a)
        .add1("null", _a => null)
        .vectorize(1, [0])
        .add2("string", "string", (t, d, c) => Link.file(c.linkHandler.normalize(t), false, d))
        .add3("string", "string", "boolean", (t, d, e, c) => Link.file(c.linkHandler.normalize(t), e, d))
        .add2("link", "string", (t, d) => t.withDisplay(d))
        .add2("null", "*", () => null)
        .add2("*", "null", (t, _n, c) => link(c, t))
        .vectorize(2, [0, 1])
        .build();

    /** Embed and un-embed a link. */
    export const embed: FunctionImpl = new FunctionBuilder("embed")
        .add1("link", l => l.toEmbed())
        .vectorize(1, [0])
        .add2("link", "boolean", (l, e, c) => (e ? l.toEmbed() : l.fromEmbed()))
        .add1("null", () => null)
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .vectorize(2, [0, 1])
        .build();

    /** External link constructor function. */
    export const elink: FunctionImpl = new FunctionBuilder("elink")
        .add2("string", "string", (a, d) => Widgets.externalLink(a, d))
        .add2("string", "null", (s, _n, c) => elink(c, s, s))
        .add2("null", "*", () => null)
        .vectorize(2, [0])
        .add1("string", (a, c) => elink(c, a, a))
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    /** Date constructor function. */
    export const date = new FunctionBuilder("date")
        .add1("string", str => {
            let parsedDate = EXPRESSION.datePlus.parse(str);
            if (parsedDate.status) return parsedDate.value;
            else return null;
        })
        .add1("date", d => d)
        .add1("link", (link, c) => {
            // Try to parse from the display...
            if (link.display) {
                let parsedDate = EXPRESSION.date.parse(link.display);
                if (parsedDate.status) return parsedDate.value;
            }

            // Then try to parse from the path...
            let parsedDate = EXPRESSION.date.parse(link.path);
            if (parsedDate.status) return parsedDate.value;

            // Then pull it from the file.
            let resolved = c.linkHandler.resolve(link.path);
            if (resolved && (resolved as any)?.file?.day) {
                return (resolved as any)?.file?.day;
            }

            return null;
        })
        .add2("string", "string", (d, f) => {
            if (f === "x" || f === "X") {
                let match = NUMBER_REGEX.exec(d);
                if (match) return DateTime.fromMillis(Number.parseInt(match[0]) * (f === "X" ? 1000 : 1));
                else {
                    throw Error("Not a number for format( (${ f }): ${ d }");
                }
            } else {
                let parsedDate = DateTime.fromFormat(d, f);
                if (parsedDate.isValid) return parsedDate;
                else {
                    throw Error(`Can't handle format (${f}) on date string (${d})`);
                }
            }
        })
        .add2("null", "string", () => null)
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    /** Duration constructor function. */
    export const dur = new FunctionBuilder("dur")
        .add1("string", str => {
            let parsedDur = EXPRESSION.duration.parse(str.trim());
            if (parsedDur.status) return parsedDur.value;
            else return null;
        })
        .add1("duration", d => d)
        .add1("null", d => d)
        .vectorize(1, [0])
        .build();

    /** Format a date using a luxon/moment-style date format. */
    export const dateformat = new FunctionBuilder("dateformat")
        .add2("date", "string", (date, format) => date.toFormat(format, { locale: currentLocale() }))
        .add2("null", "string", (_nul, _format) => null)
        .vectorize(2, [0])
        .build();

    export const durationformat = new FunctionBuilder("durationformat")
        .add2("duration", "string", (dur, format) => dur.toFormat(format))
        .add2("null", "string", (_nul, _format) => null)
        .vectorize(2, [0])
        .build();

    export const localtime = new FunctionBuilder("localtime")
        .add1("date", d => d.toLocal())
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    const NUMBER_REGEX = /-?[0-9]+(\.[0-9]+)?/;

    /** Number constructor function. */
    export const number = new FunctionBuilder("number")
        .add1("number", a => a)
        .add1("string", str => {
            let match = NUMBER_REGEX.exec(str);
            if (match) return Number.parseFloat(match[0]);
            else return null;
        })
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    /** Format a number using a standard currency format. */
    export const currencyformat = new FunctionBuilder("currencyformat")
        .add2("number", "string", (num, format) =>
            Intl.NumberFormat(currentLocale(), { style: "currency", currency: format }).format(num)
        )
        .add2("null", "string", (_nul, _format) => null)
        .add1("number", num => Intl.NumberFormat(currentLocale(), { style: "currency", currency: "USD" }).format(num))
        .add1("null", () => null)
        .vectorize(2, [0])
        .build();

    /**
     * Convert any value to a reasonable internal string representation. Most useful for dates, strings, numbers, and
     * so on.
     */
    export const string = new FunctionBuilder("string").add1("*", (a, ctx) => Values.toString(a, ctx.settings)).build();

    export const round = new FunctionBuilder("round")
        .add1("number", n => Math.round(n))
        .add1("null", () => null)
        .vectorize(1, [0])
        .add2("number", "number", (n, p) => {
            if (p <= 0) return Math.round(n);
            return parseFloat(n.toFixed(p));
        })
        .add2("number", "null", n => Math.round(n))
        .add2("null", "*", () => null)
        .vectorize(2, [0])
        .build();

    export const trunc = new FunctionBuilder("trunc")
        .add1("number", n => Math.trunc(n))
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    export const floor = new FunctionBuilder("floor")
        .add1("number", n => Math.floor(n))
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    export const ceil = new FunctionBuilder("ceil")
        .add1("number", n => Math.ceil(n))
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    export const min: FunctionImpl = new FunctionBuilder("min")
        .add2("*", "null", (a, _n) => a)
        .add2("null", "*", (_n, a) => a)
        .add2("*", "*", (a, b, ctx) => (Values.compareValue(a, b, ctx.linkHandler.normalize) <= 0 ? a : b))
        .add1("array", (a, ctx) => min(ctx, ...a))
        .vararg((ctx, ...args) => (args.length == 0 ? null : args.reduce((p, c) => min(ctx, p, c))))
        .build();

    export const max: FunctionImpl = new FunctionBuilder("max")
        .add2("*", "null", (a, _n) => a)
        .add2("null", "*", (_n, a) => a)
        .add2("*", "*", (a, b, ctx) => (Values.compareValue(a, b, ctx.linkHandler.normalize) > 0 ? a : b))
        .add1("array", (a, ctx) => max(ctx, ...a))
        .vararg((ctx, ...args) => (args.length == 0 ? null : args.reduce((p, c) => max(ctx, p, c))))
        .build();

    export const minby: FunctionImpl = new FunctionBuilder("minby")
        .add2("array", "function", (arr, func, ctx) => {
            if (arr.length == 0) return null;

            let values = arr.map(v => {
                return { value: v, mapped: func(ctx, v) };
            });
            let filtered = values.filter(v => !Values.isNull(v.mapped));
            if (filtered.length == 0) return arr[0];

            return filtered.reduce((p, c) => {
                if (Values.compareValue(p.mapped, c.mapped, ctx.linkHandler.normalize) <= 0) return p;
                else return c;
            }).value;
        })
        .add2("null", "function", (_arr, _func, _ctx) => null)
        .build();

    export const maxby: FunctionImpl = new FunctionBuilder("maxby")
        .add2("array", "function", (arr, func, ctx) => {
            if (arr.length == 0) return null;

            let values = arr.map(v => {
                return { value: v, mapped: func(ctx, v) };
            });
            let filtered = values.filter(v => !Values.isNull(v.mapped));
            if (filtered.length == 0) return arr[0];

            return filtered.reduce((p, c) => {
                if (Values.compareValue(p.mapped, c.mapped, ctx.linkHandler.normalize) > 0) return p;
                else return c;
            }).value;
        })
        .add2("null", "function", (_arr, _func, _ctx) => null)
        .build();

    export const striptime = new FunctionBuilder("striptime")
        .add1("date", d => DateTime.fromObject({ year: d.year, month: d.month, day: d.day }))
        .add1("null", _n => null)
        .vectorize(1, [0])
        .build();

    // Default contains, which looks through data structures recursively.
    export const contains: FunctionImpl = new FunctionBuilder("contains")
        .add2("array", "*", (l, elem, context) => l.some(e => contains(context, e, elem)))
        .add2("string", "string", (haystack, needle) => haystack.includes(needle))
        .add2("object", "string", (obj, key) => key in obj)
        .add2("*", "*", (elem1, elem2, context) =>
            context.evaluate(Fields.binaryOp(Fields.literal(elem1), "=", Fields.literal(elem2))).orElseThrow()
        )
        .vectorize(2, [1])
        .build();

    // Case insensitive version of contains.
    export const icontains: FunctionImpl = new FunctionBuilder("icontains")
        .add2("array", "*", (l, elem, context) => l.some(e => icontains(context, e, elem)))
        .add2("string", "string", (haystack, needle) =>
            haystack.toLocaleLowerCase().includes(needle.toLocaleLowerCase())
        )
        .add2("object", "string", (obj, key) => key in obj)
        .add2("*", "*", (elem1, elem2, context) =>
            context.evaluate(Fields.binaryOp(Fields.literal(elem1), "=", Fields.literal(elem2))).orElseThrow()
        )
        .vectorize(2, [1])
        .build();

    // "exact" contains, does not look recursively.
    export const econtains: FunctionImpl = new FunctionBuilder("econtains")
        .add2("array", "*", (l, elem, context) =>
            l.some(e => context.evaluate(Fields.binaryOp(Fields.literal(elem), "=", Fields.literal(e))).orElseThrow())
        )
        .add2("string", "string", (haystack, needle) => haystack.includes(needle))
        .add2("object", "string", (obj, key) => key in obj)
        .add2("*", "*", (elem1, elem2, context) =>
            context.evaluate(Fields.binaryOp(Fields.literal(elem1), "=", Fields.literal(elem2))).orElseThrow()
        )
        .vectorize(2, [1])
        .build();

    // Case insensitive contains which looks for exact word matches (i.e., boundary-to-boundary match).
    export const containsword: FunctionImpl = new FunctionBuilder("containsword")
        .add2(
            "string",
            "string",
            (hay, needle) => !!hay.match(new RegExp(".*\\b" + escapeRegex(needle) + "\\b.*", "i"))
        )
        .add2("null", "*", (_a, _b) => null)
        .add2("*", "null", (_a, _b) => null)
        .vectorize(2, [0, 1])
        .build();

    /** Extract 0 or more keys from a given object via indexing. */
    export const extract: FunctionImpl = (context: Context, ...args: Literal[]) => {
        if (args.length == 0) return "extract(object, key1, ...) requires at least 1 argument";

        // Manually handle vectorization in the first argument.
        let object = args[0];
        if (Values.isArray(object)) return object.map(v => extract(context, v, ...args.slice(1)));

        let result: Record<string, Literal> = {};
        for (let index = 1; index < args.length; index++) {
            let key = args[index];
            if (!Values.isString(key)) throw Error("extract(object, key1, ...) must be called with string keys");

            result[key] = context.evaluate(Fields.index(Fields.literal(object), Fields.literal(key))).orElseThrow();
        }

        return result;
    };

    // Reverse an array or string.
    export const reverse = new FunctionBuilder("reverse")
        .add1("array", l => {
            let result = [];
            for (let index = l.length - 1; index >= 0; index--) result.push(l[index]);
            return result;
        })
        .add1("string", l => {
            let result = "";
            for (let c = 0; c < l.length; c++) result += l[l.length - c - 1];
            return result;
        })
        .add1("*", e => e)
        .build();

    // Sort an array; if given two arguments, sorts by the key returned.
    export const sort: FunctionImpl = new FunctionBuilder("sort")
        .add1("array", (list, context) => sort(context, list, (_ctx: Context, a: Literal) => a))
        .add2("array", "function", (list, key, context) => {
            let result = ([] as Literal[]).concat(list);
            result.sort((a, b) => {
                let akey = key(context, a);
                let bkey = key(context, b);
                let le = context
                    .evaluate(Fields.binaryOp(Fields.literal(akey), "<", Fields.literal(bkey)))
                    .orElseThrow();
                if (Values.isTruthy(le)) return -1;

                let eq = context
                    .evaluate(Fields.binaryOp(Fields.literal(akey), "=", Fields.literal(bkey)))
                    .orElseThrow();
                if (Values.isTruthy(eq)) return 0;

                return 1;
            });
            return result;
        })
        .add1("*", e => e)
        .build();

    export const regextest = new FunctionBuilder("regextest")
        .add2("string", "string", (pattern: string, field: string) => RegExp(pattern).test(field))
        .add2("null", "*", (_n, _a) => false)
        .add2("*", "null", (_a, _n) => false)
        .vectorize(2, [0, 1])
        .build();

    export const regexmatch = new FunctionBuilder("regexmatch")
        .add2("string", "string", (pattern: string, field: string) => {
            if (!pattern.startsWith("^") && !pattern.endsWith("$")) pattern = "^" + pattern + "$";
            return !!field.match(pattern);
        })
        .add2("null", "*", (_n, _a) => false)
        .add2("*", "null", (_a, _n) => false)
        .vectorize(2, [0, 1])
        .build();

    export const regexreplace = new FunctionBuilder("regexreplace")
        .add3("string", "string", "string", (field: string, pat: string, rep: string) => {
            try {
                let reg = new RegExp(pat, "g");
                return field.replace(reg, rep);
            } catch (ex) {
                throw Error(`Invalid regexp '${pat}' in regexreplace`);
            }
        })
        .add3("null", "*", "*", () => null)
        .add3("*", "null", "*", () => null)
        .add3("*", "*", "null", () => null)
        .vectorize(3, [0, 1, 2])
        .build();

    export const lower = new FunctionBuilder("lower")
        .add1("string", s => s.toLocaleLowerCase())
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    export const upper = new FunctionBuilder("upper")
        .add1("string", s => s.toLocaleUpperCase())
        .add1("null", () => null)
        .vectorize(1, [0])
        .build();

    export const replace = new FunctionBuilder("replace")
        .add3("string", "string", "string", (str, pat, repr) => str.split(pat).join(repr))
        .add3("null", "*", "*", () => null)
        .add3("*", "null", "*", () => null)
        .add3("*", "*", "null", () => null)
        .vectorize(3, [0, 1, 2])
        .build();

    // Ensure undefined matches turn into empty strings for split/2 and split/3.
    const splitImpl = (str: string, delim: string, limit?: number): string[] =>
        str.split(new RegExp(delim), limit).map(str => str || "");

    /** Split a string on a given string. */
    export const split: FunctionImpl = new FunctionBuilder("split")
        .add2("string", "string", (string, splitter) => splitImpl(string, splitter))
        .add3("string", "string", "number", (string, splitter, limit) => splitImpl(string, splitter, limit))
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .add3("*", "*", "null", () => null)
        .add3("*", "null", "*", () => null)
        .add3("null", "*", "*", () => null)
        .build();

    export const startswith: FunctionImpl = new FunctionBuilder("startswith")
        .add2("string", "string", (str, starting) => str.startsWith(starting))
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .vectorize(2, [0, 1])
        .build();

    export const endswith: FunctionImpl = new FunctionBuilder("endswith")
        .add2("string", "string", (str, ending) => str.endsWith(ending))
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .vectorize(2, [0, 1])
        .build();

    export const padleft: FunctionImpl = new FunctionBuilder("padleft")
        .add2("string", "number", (str, len) => str.padStart(len, " "))
        .add3("string", "number", "string", (str, len, padding) => str.padStart(len, padding))
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .add3("null", "*", "*", () => null)
        .add3("*", "null", "*", () => null)
        .add3("*", "*", "null", () => null)
        .vectorize(2, [0, 1])
        .vectorize(3, [0, 1, 2])
        .build();

    export const padright: FunctionImpl = new FunctionBuilder("padright")
        .add2("string", "number", (str, len) => str.padEnd(len, " "))
        .add3("string", "number", "string", (str, len, padding) => str.padEnd(len, padding))
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .add3("null", "*", "*", () => null)
        .add3("*", "null", "*", () => null)
        .add3("*", "*", "null", () => null)
        .vectorize(2, [0, 1])
        .vectorize(3, [0, 1, 2])
        .build();

    export const substring: FunctionImpl = new FunctionBuilder("substring")
        .add2("string", "number", (str, start) => str.substring(start))
        .add3("string", "number", "number", (str, start, end) => str.substring(start, end))
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .add3("null", "*", "*", () => null)
        .add3("*", "null", "*", () => null)
        .add3("*", "*", "null", () => null)
        .vectorize(2, [0, 1])
        .vectorize(3, [0, 1, 2])
        .build();

    export const truncate: FunctionImpl = new FunctionBuilder("truncate")
        .add3("string", "number", "string", (str, length, suffix) => {
            if (str.length > length - suffix.length) {
                return str.substring(0, Math.max(0, length - suffix.length)) + suffix;
            } else {
                return str;
            }
        })
        .add2("string", "number", (str, length, ctx) => truncate(ctx, str, length, "..."))
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .add3("null", "*", "*", () => null)
        .add3("*", "null", "*", () => null)
        .add3("*", "*", "null", () => null)
        .vectorize(2, [0, 1])
        .vectorize(3, [0, 1, 2])
        .build();

    export const fdefault = new FunctionBuilder("default")
        .add2("*", "*", (v, bk) => (Values.isNull(v) ? bk : v))
        .vectorize(2, [0, 1])
        .build();

    export const ldefault = new FunctionBuilder("ldefault")
        .add2("*", "*", (v, bk) => (Values.isNull(v) ? bk : v))
        .build();

    // Returns the display name of the element.
    export const display = new FunctionBuilder("display")
        .add1("null", (): Literal => "")
        .add1("array", (a: Literal[], ctx: Context): Literal => {
            return a.map(e => display(ctx, e)).join(", ");
        })
        .add1("string", (str: string): Literal => normalizeMarkdown(str))
        .add1("link", (a: Link, ctx: Context): Literal => {
            if (a.display) {
                return display(ctx, a.display);
            } else {
                return Values.toString(a, ctx.settings).replace(/\[\[.*\|(.*)\]\]/, "$1");
            }
        })
        .add1("*", (a: Literal, ctx: Context): Literal => {
            return Values.toString(a, ctx.settings);
        })
        .build();

    export const choice = new FunctionBuilder("choice")
        .add3("*", "*", "*", (b, left, right) => (Values.isTruthy(b) ? left : right))
        .vectorize(3, [0])
        .build();

    export const hash = new FunctionBuilder("hash")
        .add2("string", "number", (seed, variant) => {
            return cyrb53(seed, variant);
        })
        .add2("string", "string", (seed, text) => {
            return cyrb53(seed + text);
        })
        .add3("string", "string", "number", (seed, text, variant) => {
            return cyrb53(seed + text, variant);
        })
        .build();

    export const reduce = new FunctionBuilder("reduce")
        .add2("array", "string", (lis, op, context) => {
            if (lis.length == 0) return null;

            if (op != "+" && op != "-" && op != "*" && op != "/" && op != "&" && op != "|")
                throw Error("reduce(array, op) supports '+', '-', '/', '*', '&', and '|'");

            let value = lis[0];
            for (let index = 1; index < lis.length; index++) {
                value = context
                    .evaluate(Fields.binaryOp(Fields.literal(value), op, Fields.literal(lis[index])))
                    .orElseThrow();
            }

            return value;
        })
        .add2("array", "function", (lis, op, context) => {
            if (lis.length == 0) return null;

            let value = lis[0];
            for (let index = 1; index < lis.length; index++) {
                // Skip null values to reduce the pain of summing over fields that may or may not exist.
                if (Values.isNull(lis[index])) continue;

                value = op(context, value, lis[index]);
            }

            return value;
        })
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .vectorize(2, [1])
        .build();

    export const sum = new FunctionBuilder("sum")
        .add1("array", (arr, c) => reduce(c, arr, "+"))
        .add1("*", e => e)
        .build();

    export const average = new FunctionBuilder("average")
        .add1("array", (array, context) => {
            if (array.length == 0) return null;

            const add = sum(context, array);
            if (add == null || add == undefined) return null;

            return context
                .evaluate(Fields.binaryOp(Fields.literal(add), "/", Fields.literal(array.length)))
                .orElseThrow();
        })
        .add1("*", e => e)
        .build();

    export const product = new FunctionBuilder("product")
        .add1("array", (arr, c) => reduce(c, arr, "*"))
        .add1("*", e => e)
        .build();

    export const join: FunctionImpl = new FunctionBuilder("join")
        .add2("array", "string", (arr, sep, ctx) => arr.map(e => Values.toString(e, ctx.settings)).join(sep))
        .add2("array", "null", (arr, _s, context) => join(context, arr, ", "))
        .add2("*", "string", (elem, sep, ctx) => Values.toString(elem, ctx.settings))
        .add1("array", (arr, context) => join(context, arr, ", "))
        .add1("*", (e, ctx) => Values.toString(e, ctx.settings))
        .vectorize(2, [1])
        .build();

    export const any = new FunctionBuilder("any")
        .add1("array", arr => arr.some(v => Values.isTruthy(v)))
        .add2("array", "function", (arr, f, ctx) => arr.some(v => Values.isTruthy(f(ctx, v))))
        .vararg((_ctx, ...args) => args.some(v => Values.isTruthy(v)))
        .build();

    export const all = new FunctionBuilder("all")
        .add1("array", arr => arr.every(v => Values.isTruthy(v)))
        .add2("array", "function", (arr, f, ctx) => arr.every(v => Values.isTruthy(f(ctx, v))))
        .vararg((_ctx, ...args) => args.every(v => Values.isTruthy(v)))
        .build();

    export const none = new FunctionBuilder("all")
        .add1("array", arr => !arr.some(v => Values.isTruthy(v)))
        .add2("array", "function", (arr, f, ctx) => !arr.some(v => Values.isTruthy(f(ctx, v))))
        .vararg((_ctx, ...args) => !args.some(v => Values.isTruthy(v)))
        .build();

    export const filter = new FunctionBuilder("filter")
        .add2("array", "function", (arr, f, ctx) => arr.filter(v => Values.isTruthy(f(ctx, v))))
        .add2("null", "*", () => null)
        .build();

    export const unique = new FunctionBuilder("unique")
        .add1("array", (arr, ctx) => DataArray.wrap(arr, ctx.settings).distinct().array())
        .add1("null", () => null)
        .build();

    export const map = new FunctionBuilder("map")
        .add2("array", "function", (arr, f, ctx) => arr.map(v => f(ctx, v)))
        .add2("null", "*", () => null)
        .build();

    export const nonnull = new FunctionBuilder("nonnull")
        .add1("array", arr => arr.filter(v => Values.typeOf(v) != "null"))
        .vararg((_ctx, ...args) => args.filter(v => Values.typeOf(v) != "null"))
        .build();

    /** Gets an object containing a link's own properties */
    export const meta: FunctionImpl = new FunctionBuilder("meta")
        .add1("link", link => ({
            display: link.display ?? null,
            embed: link.embed,
            path: link.path,
            subpath: link.subpath ?? null,
            type: link.type,
        }))
        .build();

    // Concatenates sub-array elements into a new array
    export const flat = new FunctionBuilder("flat")
        .add1("array", a => {
            return a.flat();
        })
        .add2("array", "number", (a, n) => {
            // @ts-ignore
            return a.flat(n);
        })
        .add1("null", () => null)
        .build();

    // Slices the array into a new array
    export const slice = new FunctionBuilder("slice")
        .add1("array", a => {
            return a.slice();
        })
        .add2("array", "number", (a, start) => {
            return a.slice(start);
        })
        .add3("array", "number", "number", (a, start, end) => {
            return a.slice(start, end);
        })
        .add1("null", () => null)
        .build();

    // Returns the first non-null value from the array as a single element
    export const firstvalue = new FunctionBuilder("firstvalue")
        .add1("array", a => {
            let nonnull = a.filter(v => Values.typeOf(v) != "null");
            let res = nonnull.length != 0 ? nonnull[0] : null;
            return res;
        })
        .add1("null", () => null)
        .build();
}

/** Default function implementations for the expression evaluator. */
// Keep functions in same order as they're documented !!
export const DEFAULT_FUNCTIONS: Record<string, FunctionImpl> = {
    // Constructors
    object: DefaultFunctions.object,
    list: DefaultFunctions.list,
    array: DefaultFunctions.list,
    date: DefaultFunctions.date,
    dur: DefaultFunctions.dur,
    number: DefaultFunctions.number,
    string: DefaultFunctions.string,
    link: DefaultFunctions.link,
    embed: DefaultFunctions.embed,
    elink: DefaultFunctions.elink,
    typeof: DefaultFunctions.typeOf,

    // Numeric Operations
    round: DefaultFunctions.round,
    trunc: DefaultFunctions.trunc,
    floor: DefaultFunctions.floor,
    ceil: DefaultFunctions.ceil,
    min: DefaultFunctions.min,
    max: DefaultFunctions.max,
    sum: DefaultFunctions.sum,
    product: DefaultFunctions.product,
    average: DefaultFunctions.average,
    minby: DefaultFunctions.minby,
    maxby: DefaultFunctions.maxby,

    // Object, Arrays, and String operations
    contains: DefaultFunctions.contains,
    icontains: DefaultFunctions.icontains,
    econtains: DefaultFunctions.econtains,
    containsword: DefaultFunctions.containsword,
    extract: DefaultFunctions.extract,
    sort: DefaultFunctions.sort,
    reverse: DefaultFunctions.reverse,
    length: DefaultFunctions.length,
    nonnull: DefaultFunctions.nonnull,
    firstvalue: DefaultFunctions.firstvalue,
    all: DefaultFunctions.all,
    any: DefaultFunctions.any,
    none: DefaultFunctions.none,
    join: DefaultFunctions.join,
    filter: DefaultFunctions.filter,
    map: DefaultFunctions.map,
    flat: DefaultFunctions.flat,
    slice: DefaultFunctions.slice,
    unique: DefaultFunctions.unique,

    reduce: DefaultFunctions.reduce,

    // String Operations
    regextest: DefaultFunctions.regextest,
    regexmatch: DefaultFunctions.regexmatch,
    regexreplace: DefaultFunctions.regexreplace,
    replace: DefaultFunctions.replace,
    lower: DefaultFunctions.lower,
    upper: DefaultFunctions.upper,
    split: DefaultFunctions.split,
    startswith: DefaultFunctions.startswith,
    endswith: DefaultFunctions.endswith,
    padleft: DefaultFunctions.padleft,
    padright: DefaultFunctions.padright,
    substring: DefaultFunctions.substring,
    truncate: DefaultFunctions.truncate,

    // Utility Operations
    default: DefaultFunctions.fdefault,
    ldefault: DefaultFunctions.ldefault,
    display: DefaultFunctions.display,
    choice: DefaultFunctions.choice,
    striptime: DefaultFunctions.striptime,
    dateformat: DefaultFunctions.dateformat,
    durationformat: DefaultFunctions.durationformat,
    currencyformat: DefaultFunctions.currencyformat,
    localtime: DefaultFunctions.localtime,
    hash: DefaultFunctions.hash,
    meta: DefaultFunctions.meta,
};
