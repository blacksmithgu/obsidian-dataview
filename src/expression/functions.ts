/** Default function implementations for the expression evaluator. */

import { DateTime } from "luxon";
import { Link, LiteralType, LiteralValue, Values } from "src/data/value";
import { LiteralReprAll, LiteralTypeOrAll } from "./binaryop";
import type { Context } from "./context";
import { Fields } from "./field";
import { EXPRESSION } from "./parse";

/**
 * A function implementation which takes in a function context and a variable number of arguments. Throws an error if an
 * invalid number/type of arguments are passed.
 */
export type FunctionImpl = (context: Context, ...rest: LiteralValue[]) => LiteralValue;
/** A "bound" function implementation which has already had a function context passed to it. */
export type BoundFunctionImpl = (...args: LiteralValue[]) => LiteralValue;

/** A function variant used in the function builder which holds the argument types. */
interface FunctionVariant {
    args: LiteralTypeOrAll[];
    varargs: boolean;
    /** The implementing function for this specific variant. */
    impl: FunctionImpl;
}

/**
 * Allows for the creation of functions that check the number and type of their arguments, and dispatch
 * to different implemenations based on the types of the inputs.
 */
export class FunctionBuilder {
    variants: FunctionVariant[];

    public constructor(public name: string) {
        this.variants = [];
    }

    /** Add a general function variant which accepts any number of arguments of any type. */
    public vararg(impl: FunctionImpl): FunctionBuilder {
        this.variants.push({ args: [], varargs: true, impl });
        return this;
    }

    /** Add a function variant which takes in a single argument. */
    public add1<T extends LiteralTypeOrAll>(argType: T, impl: (a: LiteralReprAll<T>, context: Context) => LiteralValue): FunctionBuilder {
        this.variants.push({ args: [argType], varargs: false, impl: (c, ...rest) => impl(rest[0] as LiteralReprAll<T>, c) })
        return this;
    }

    /** Add a function variant which takes in two typed arguments. */
    public add2<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(arg1: T, arg2: U,
        impl: (a: LiteralReprAll<T>, b: LiteralReprAll<U>, context: Context) => LiteralValue): FunctionBuilder {
        this.variants.push({
            args: [arg1, arg2],
            varargs: false,
            impl: (c, ...rest) => impl(rest[0] as LiteralReprAll<T>, rest[1] as LiteralReprAll<U>, c)
        });
        return this;
    }

    /** Add a function variant which takes in three typed arguments. */
    public add3<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll, V extends LiteralTypeOrAll>(arg1: T, arg2: U, arg3: V,
        impl: (a: LiteralReprAll<T>, b: LiteralReprAll<U>, c: LiteralReprAll<V>, context: Context) => LiteralValue): FunctionBuilder {
        this.variants.push({
            args: [arg1, arg2, arg3],
            varargs: false,
            impl: (c, ...rest) => impl(rest[0] as LiteralReprAll<T>, rest[1] as LiteralReprAll<U>, rest[2] as LiteralReprAll<V>, c)
        });
        return this;
    }

    /** Return a function which checks the number and type of arguments, passing them on to the first matching variant. */
    public build(): FunctionImpl {
        let self = (context: Context, ...args: LiteralValue[]) => {
            let types: LiteralType[] = [];
            for (let arg of args) {
                let argType = Values.typeOf(arg);
                if (!argType) throw Error(`Unrecognized argument type for argument '${arg}'`);
                types.push(argType);
            }

            outer: for (let variant of this.variants) {
                if (variant.varargs) return variant.impl(context, self, ...args);
                if (variant.args.length != types.length) continue;

                for (let index = 0; index < variant.args.length; index++) {
                    if (variant.args[index] != types[index]) continue outer;
                }

                return variant.impl(context, self, ...args);
            }

            throw Error(`No implementation of '${this.name}' found for arguments: ${types.join(", ")}`);
        };

        return self;
    }
}

/**
 * Collection of all defined functions; defined here so that they can be called from within dataview,
 * and test code.
 */
export namespace Functions {
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
        let result: Record<string, LiteralValue> = {};
        for (let index = 0; index < args.length; index += 2) {
            let key = args[index];
            if (!Values.isString(key)) throw Error("keys should be of type string for object(key1, value1, ...)");
            result[key] = args[index + 1];
        }

        return result;
    }

    /** Internal link constructor function. */
    export const link: FunctionImpl = new FunctionBuilder("link")
        .add1("string", (a, c) => Link.file(c.linkHandler.normalize(a), false))
        .add1("link", a => a)
        .add1("null", _a => null)
        .add2("string", "string", (t, d, c) => Link.file(c.linkHandler.normalize(t), false, d))
        .add2("link", "string", (t, d) => t.withDisplay(d))
        .add2("null", "*", () => null)
        .add2("*", "null", (t, _n, c) => link(c, t))
        .build();

    /** External link constructor function. */
    export const elink: FunctionImpl = new FunctionBuilder("elink")
        .add2("string", "string", (a, d) => {
            let elem = document.createElement('a');
            elem.textContent = d;
            elem.rel = "noopener";
            elem.target = "_blank";
            elem.classList.add("external-link");
            elem.href = a;
            return elem;
        })
        .add1("string", (a, c) => elink(c, a, a))
        .add2("string", "null", (s, _n, c) => elink(c, s, s))
        .add2("null", "*", () => null)
        .add1("null", () => null)
        .build();

    /** Date constructor function. */
    export const date = new FunctionBuilder("date")
        .add1("string", str => {
            let parsedDate = EXPRESSION.date.parse(str);
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
        .add1("null", () => null)
        .build();

    /** Number constructor function. */
    export const number = new FunctionBuilder("number")
        .add1("number", a => a)
        .add1("string", str => {
            let value = EXPRESSION.number.parse(str);
            return value.status ? value.value : null;
        })
        .add1("null", () => null)
        .build();

    export const round = new FunctionBuilder("round")
        .add1("number", n => Math.round(n))
        .add2("number", "number", (n, p) => {
            if (p <= 0) return Math.round(n);
            return parseFloat(n.toFixed(p));
        })
        .add1("null", () => null)
        .add2("number", "null", n => Math.round(n))
        .add2("null", "*", () => null)
        .build();

    export const striptime = new FunctionBuilder("striptime")
        .add1("date", d => DateTime.fromObject({ year: d.year, month: d.month, day: d.day }))
        .add1("null", _n => null)
        .build();

    export const contains: FunctionImpl = new FunctionBuilder("contains")
        .add2("array", "*", (l, elem, context) => l.some(e => contains(context, e, elem)))
        .add2("string", "string", (haystack, needle) => haystack.includes(needle))
        .add2("*", "*", (elem1, elem2, context) =>
            context.evaluate(Fields.binaryOp(Fields.literal(elem1), '=', Fields.literal(elem2))).orElseThrow())
        .build();

    /** Extract 0 or more keys from a given object via indexing. */
    export const extract = (context: Context, ...args: LiteralValue[]) => {
        if (args.length == 0) return "extract(object, key1, ...) requires at least 1 argument";

        let result: Record<string, LiteralValue> = {};
        let object = args[0];
        for (let index = 1; index < args.length; index++) {
            let key = args[index];
            if (!Values.isString(key)) throw Error("extract(object, key1, ...) must be called with string keys");

            result[key] = context.evaluate(Fields.index(Fields.literal(object), Fields.literal(key))).orElseThrow();
        }

        return result;
    };

    export const reverse = new FunctionBuilder("reverse")
        .add1("array", l => {
            let result = [];
            for (let index = l.length - 1; index >= 0; index--) result.push(l[index]);
            return result;
        })
        .add1("null", _ => null)
        .build();

    export const sort = new FunctionBuilder("sort")
        .add1("array", (list, context) => {
            let result = ([] as LiteralValue[]).concat(list);
            result.sort((a, b) => {
                let le = context.evaluate(Fields.binaryOp(Fields.literal(a), "<", Fields.literal(b))).orElseThrow();
                if (Values.isTruthy(le)) return -1;

                let eq = context.evaluate(Fields.binaryOp(Fields.literal(a), "=", Fields.literal(b))).orElseThrow();
                if (Values.isTruthy(eq)) return 0;

                return 1;
            });

            return result;
        })
        .add1("null", _n => null)
        .build();

    export const regexmatch = new FunctionBuilder("regexmatch")
        .add2("string", "string", (pattern: string, field: string) => {
            if (!pattern.startsWith("^") && !pattern.endsWith("$")) pattern = "^" + pattern + "$";
            return !!field.match(pattern);
        })
        .add2("null", "*", (_n, _a) => false)
        .add2("*", "null", (_a, _n) => false)
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
        .build();

    export const lower = new FunctionBuilder("lower")
        .add1("string", s => s.toLocaleLowerCase())
        .add1("null", () => null)
        .build();

    export const upper = new FunctionBuilder("upper")
        .add1("string", s => s.toLocaleUpperCase())
        .add1("null", () => null)
        .build();

    export const replace = new FunctionBuilder("replace")
        .add3("string", "string", "string", (str, pat, repr) => str.replace(pat, repr))
        .add3("null", "*", "*", () => null)
        .add3("*", "null", "*", () => null)
        .add3("*", "*", "null", () => null)
        .build();

    export const fdefault = new FunctionBuilder("default")
        .add2("*", "*", (v, bk) => Values.isNull(v) ? bk : v)
        .build();

    export const ldefault = new FunctionBuilder("ldefault")
        .add2("*", "*", (v, bk) => Values.isNull(v) ? bk : v)
        .build();

    export const choice = new FunctionBuilder("choice")
        .add3("*", "*", "*", (b, left, right) => Values.isTruthy(b) ? left : right)
        .build();

    export const reduce = new FunctionBuilder("reduce")
        .add2("array", "string", (lis, op, context) => {
            if (lis.length == 0) return null;

            if (op != '+' && op != '-' && op != '*' && op != '/' && op != '&' && op != '|')
                throw Error("reduce(array, op) supports '+', '-', '/', '*', '&', and '|'");

            let value = lis[0];
            for (let index = 1; index < lis.length; index++) {
                // Skip null values to reduce the pain of summing over fields that may or may not exist.
                if (Values.isNull(lis[index])) continue;

                value = context.evaluate(Fields.binaryOp(Fields.literal(value), op, Fields.literal(lis[index]))).orElseThrow();
            }

            return value;
        })
        .add2("null", "*", () => null)
        .add2("*", "null", () => null)
        .build();

    export const sum = new FunctionBuilder("sum")
        .add1("array", (arr, c) => reduce(c, arr, "+"))
        .add1("*", e => e)
        .build();

    export const product = new FunctionBuilder("product")
        .add1("array", (arr, c) => reduce(c, arr, "*"))
        .add1("*", e => e)
        .build();

    export const join: FunctionImpl = new FunctionBuilder("join")
        .add2("array", "string", (arr, sep) => arr.map(e => Values.toString(e)).join(sep))
        .add2("array", "null", (arr, _s, context) => join(context, arr, ", "))
        .add2("*", "string", (elem, sep) => Values.toString(elem))
        .add1("array", (arr, context) => join(context, arr, ", "))
        .add1("*", e => Values.toString(e))
        .build();

    export const any = new FunctionBuilder("any")
        .add1("array", arr => arr.some(v => Values.isTruthy(v)))
        .add1("*", e => Values.isTruthy(e))
        .build();

    export const all = new FunctionBuilder("all")
        .add1("array", arr => arr.every(v => Values.isTruthy(v)))
        .add1("*", e => Values.isTruthy(e))
        .build();

    export const none = new FunctionBuilder("all")
        .add1("array", arr => !arr.some(v => Values.isTruthy(v)))
        .add1("*", e => !Values.isTruthy(e))
        .build();
}

/** Default function implementations for the expression evaluator. */
export const DEFAULT_FUNCTIONS: Record<string, FunctionImpl> = {
    // Constructors.
    "list": Functions.list,
    "array": Functions.list,
    "link": Functions.link,
    "elink": Functions.elink,
    "date": Functions.date,
    "number": Functions.number,

    // Math Operations.
    "round": Functions.round,

    // String operations.
    "regexreplace": Functions.regexreplace,
    "regexmatch": Functions.regexmatch,
    "replace": Functions.replace,
    "lower": Functions.lower,
    "upper": Functions.upper,

    // Date Operations.
    "striptime": Functions.striptime,

    // List operations.
    "length": Functions.length,
    "contains": Functions.contains,
    "reverse": Functions.reverse,
    "sort": Functions.sort,

    // Aggregation operations like reduce.
    "reduce": Functions.reduce,
    "join": Functions.join,
    "sum": Functions.sum,
    "product": Functions.product,
    "all": Functions.all,
    "any": Functions.any,
    "none": Functions.none,

    // Object/Utility operations.
    "extract": Functions.extract,
    "default": Functions.fdefault,
    "ldefault": Functions.ldefault,
    "choice": Functions.choice
};
