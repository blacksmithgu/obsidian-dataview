/** Evaluates fields in the expression language. */
import { DateTime } from 'luxon';
import { BinaryOp, LiteralType, LiteralField, LiteralFieldRepr, Field, Fields, StringField, DateField, Link, LinkField, NumberField } from 'src/query';
import { normalizeDuration } from "src/util/normalize";
import { EXPRESSION } from 'src/parse';

/////////////////////////////////
// Core Context Implementation //
/////////////////////////////////

/** Handles link resolution and normalization inside of a context. */
export interface LinkHandler {
    /** Resolve a link to the metadata it contains. */
    resolve(path: string): LiteralFieldRepr<'object'> | LiteralFieldRepr<'null'>;
    /**
     * Normalize a link to it's fully-qualified path for comparison purposes.
     * If the path does not exist, returns it unchanged.
     */
    normalize(path: string): string;
    /** Return true if the given path actually exists, false otherwise. */
    exists(path: string): boolean;
}

/** The context in which expressions are evaluated in. */
export class Context {
    /** Direct variable fields in the context. */
    public namespace: LiteralFieldRepr<'object'>;
    /** Registry of binary operation handlers. */
    public readonly binaryOps: BinaryOpHandler;
    /** Registry of function handlers. */
    public readonly functions: FunctionHandler;
    /** Resolves links into the metadata for the linked file. */
    public readonly linkHandler: LinkHandler;
    /** The parent context which this context will lookup variables from if they are not present here. */
    public readonly parent?: Context;

    public constructor(linkHandler: LinkHandler, parent: Context | undefined = undefined, namespace: LiteralFieldRepr<'object'> = Fields.emptyObject(),
        binaryOps: BinaryOpHandler = BINARY_OPS, functions: FunctionHandler = FUNCTIONS) {
        this.namespace = namespace;
        this.parent = parent;
        this.binaryOps = binaryOps;
        this.functions = functions;
        this.linkHandler = linkHandler;
    }

    /** Add a field to the context. */
    public set(name: string, value: LiteralField): Context {
        this.namespace.value.set(name, value);
        return this;
    }

    /** Attempts to resolve a variable name in the context. */
    public get(name: string): LiteralField {
        if (!this.namespace.value.has(name) && this.parent != undefined) return this.parent.get(name);
        return this.namespace.value.get(name) ?? Fields.NULL;
    }

    /** Evaluate a field in this context, returning the final resolved value. */
    public evaluate(field: Field): LiteralField | string {
        switch (field.type) {
            case "literal": return field;
            case "variable": return this.get(field.name);
            case "binaryop":
                let left = this.evaluate(field.left);
                if (typeof left === 'string') return left;
                let right = this.evaluate(field.right);
                if (typeof right === 'string') return right;
                return this.binaryOps.evaluate(field.op, left, right, this);
            case "negated":
                let child = this.evaluate(field.child);
                if (typeof child === 'string') return child;
                return Fields.bool(!Fields.isTruthy(child));
            case "function":
                let args: LiteralField[] = [];
                for (let arg of field.arguments) {
                    let resolved = this.evaluate(arg);
                    if (typeof resolved === 'string') return resolved;
                    args.push(resolved);
                }

                // TODO: Add later support for lambdas as an additional thing you can call.
                switch (field.func.type) {
                    case "variable":
                        return this.functions.evaluate(field.func.name, args, this);
                    default:
                        return `Cannot call field type '${field.func}' as a function`;
                }
            case "index":
                // Special-case "row" to refer to the namespace itself, to bypass keyword restrictions.
                let obj = field.object.type == "variable" && field.object.name == "row" ? this.namespace : this.evaluate(field.object);
                if (typeof obj === 'string') return obj;
                let index = this.evaluate(field.index);
                if (typeof index === 'string') return index;

                switch (obj.valueType) {
                    case "object":
                        if (index.valueType != 'string') return "can only index into objects with strings (a.b or a[\"b\"])";
                        return obj.value.get(index.value) ?? Fields.NULL;
                    case "link":
                        if (index.valueType != 'string') return "can only index into links with strings (a.b or a[\"b\"])";
                        let linkValue = this.linkHandler.resolve(obj.value.path);
                        if (linkValue.valueType == 'null') return Fields.NULL;
                        return linkValue.value.get(index.value) ?? Fields.NULL;
                    case "array":
                        if (index.valueType == 'number') {
                            if (index.value >= obj.value.length || index.value < 0) return Fields.NULL;
                            return obj.value[index.value];
                        } else if (index.valueType == 'string') {
                            let result = [];
                            for (let value of obj.value) {
                                let next = this.evaluate(Fields.index(value, index));
                                if (typeof next == "string") continue;
                                result.push(next);
                            }
                            return Fields.array(result);
                        } else {
                            return "Array indexing requires either a number (to get a specific element), or a string (to map all elements inside the array)";
                        }
                    case "string":
                        if (index.valueType != 'number') return "string indexing requires a numeric index (string[index])";
                        if (index.value >= obj.value.length || index.value < 0) return Fields.NULL;
                        return Fields.string(obj.value[index.value]);
                    case "date":
                        if (index.valueType != 'string') return "date indexing requires a string representing the unit";
                        switch (index.value) {
                            case "year": return Fields.number(obj.value.year);
                            case "month": return Fields.number(obj.value.month);
                            case "weekyear": return Fields.number(obj.value.weekNumber);
                            case "week": return Fields.number(Math.floor(obj.value.day / 7) + 1);
                            case "weekday": return Fields.number(obj.value.weekday);
                            case "day": return Fields.number(obj.value.day);
                            case "hour": return Fields.number(obj.value.hour);
                            case "minute": return Fields.number(obj.value.minute);
                            case "second": return Fields.number(obj.value.second);
                            case "millisecond": return Fields.number(obj.value.millisecond);
                            default: return Fields.NULL;
                        }
                    case "duration":
                        if (index.valueType != 'string') return "duration indexing requires a string representing the unit";
                        switch (index.value) {
                            case "year": case "years": return Fields.number(obj.value.years);
                            case "month": case "months": return Fields.number(obj.value.months);
                            case "weeks": return Fields.number(obj.value.weeks);
                            case "day": case "days": return Fields.number(obj.value.days);
                            case "hour": case "hours": return Fields.number(obj.value.hours);
                            case "minute": case "minutes": return Fields.number(obj.value.minutes);
                            case "second": case "seconds": return Fields.number(obj.value.seconds);
                            case "millisecond": case "milliseconds": return Fields.number(obj.value.milliseconds);
                            default: return Fields.NULL;
                        }
                    default:
                        return Fields.NULL;
                }
        }
    }

    /** Deep copy a context. */
    public copy(): Context {
        return new Context(this.linkHandler,
            this.parent,
            Fields.deepCopy(this.namespace) as LiteralFieldRepr<'object'>,
            this.binaryOps,
            this.functions);
    }
}

////////////////////////////////
// Binary Operator Evaluation //
////////////////////////////////

/** A literal type or a catch-all '*'. */
type LiteralTypeOrAll = LiteralType | '*';
/** Maps a literal type or the catch-all '*'. */
type LiteralFieldReprAll<T extends LiteralTypeOrAll> =
    T extends '*' ? LiteralField :
    T extends LiteralType ? LiteralFieldRepr<T> :
    any;

/** A handler function which handles combining two fields with an operator. */
export type BinaryOpImpl<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll> =
    (a: LiteralFieldReprAll<T1>, b: LiteralFieldReprAll<T2>) => LiteralField | string;

export type BinaryOpImplContext<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll> =
    (a: LiteralFieldReprAll<T1>, b: LiteralFieldReprAll<T2>, context: Context) => LiteralField | string;

/** Negate a binary operation; i.e., if op(a, b) = true, then negateOp(op)(a, b) = false. */
function negateOp<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOpImpl<T1, T2>): BinaryOpImpl<T1, T2> {
    return (a, b) => {
        let res = op(a, b);
        if (typeof res == 'string') return res;

        return Fields.bool(!Fields.isTruthy(res));
    }
}

function negateOpContext<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOpImplContext<T1, T2>): BinaryOpImplContext<T1, T2> {
    return (a, b, c) => {
        let res = op(a, b, c);
        if (typeof res == 'string') return res;

        return Fields.bool(!Fields.isTruthy(res));
    }
}

/** Class which allows for type-safe implementation of binary ops. */
export class BinaryOpHandler {
    map: Map<string, BinaryOpImplContext<'*', '*'>>;

    static create() {
        return new BinaryOpHandler();
    }

    constructor() {
        this.map = new Map();
    }

    /** Add a new handler for the specified types to this handler. */
    public add<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOp, first: T1, second: T2,
        func: BinaryOpImpl<T1, T2>): BinaryOpHandler {
        return this.addContext<T1, T2>(op, first, second, (a, b, _c) => func(a, b));
    }

    public addContext<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOp, first: T1, second: T2,
        func: BinaryOpImplContext<T1, T2>): BinaryOpHandler {
        if (this.map.has(BinaryOpHandler.repr(op, first, second)))
            throw Error(`Encountered duplicate handler for ${first} ${op} ${second}; remove one of them`);

        // How's this for some gnarly type-check hackery.
        this.map.set(BinaryOpHandler.repr(op, first, second), func as BinaryOpImplContext<'*', '*'>);
        return this;
    }

    public addComparison<T extends LiteralTypeOrAll>(type: T, ops: {
        equals: BinaryOpImpl<T, T>,
        le: BinaryOpImpl<T, T>
    }): BinaryOpHandler {
        this.add('=', type, type, ops.equals);
        this.add('!=', type, type, negateOp(ops.equals));

        this.add('<', type, type, ops.le);
        this.add('<=', type, type, negateOp((a, b) => ops.le(b, a)));
        this.add('>', type, type, (a, b) => ops.le(b, a));
        this.add('>=', type, type, negateOp(ops.le));

        return this;
    }

    public addComparisonContext<T extends LiteralTypeOrAll>(type: T, ops: {
        equals: BinaryOpImplContext<T, T>,
        le: BinaryOpImplContext<T, T>
    }): BinaryOpHandler {
        this.addContext('=', type, type, ops.equals);
        this.addContext('!=', type, type, negateOpContext(ops.equals));

        this.addContext('<', type, type, ops.le);
        this.addContext('<=', type, type, negateOpContext((a, b, c) => ops.le(b, a, c)));
        this.addContext('>', type, type, (a, b, c) => ops.le(b, a, c));
        this.addContext('>=', type, type, negateOpContext(ops.le));

        return this;
    }

    /**
     * Add a commutative operator for the specified types to this handler; in addition to adding the normal
     * (op, T1, T2) mapping, it additionally adds (op, T2, T1). Only needed if T1 and T2 are different types.
     */
    public addComm<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOp, first: T1, second: T2,
        func: BinaryOpImpl<T1, T2>): BinaryOpHandler {
        this.add(op, first, second, func);
        this.add(op, second, first, (a, b) => func(b, a));

        return this;
    }

    /** Attempt to evaluate the given binary operator on the two literal fields. */
    public evaluate(op: BinaryOp, left: LiteralField, right: LiteralField, context: Context): LiteralField | string {
        let handler = this.map.get(BinaryOpHandler.repr(op, left.valueType, right.valueType));
        if (handler) return handler(left, right, context);

        // Right-'*' fallback:
        let handler2 = this.map.get(BinaryOpHandler.repr(op, left.valueType, '*'));
        if (handler2) return handler2(left, right, context);

        // Left-'*' fallback:
        let handler3 = this.map.get(BinaryOpHandler.repr(op, '*', right.valueType));
        if (handler3) return handler3(left, right, context);

        // Double '*' fallback.
        let handler4 = this.map.get(BinaryOpHandler.repr(op, '*', '*'));
        if (handler4) return handler4(left, right, context);

        return `Operator '${op}' is not supported for '${left.valueType}' and '${right.valueType}`;
    }

    private static repr(op: BinaryOp, left: LiteralTypeOrAll, right: LiteralTypeOrAll) {
        return `${op},${left},${right}`
    }
}

/** The default binary operator implementations. */
export const BINARY_OPS = BinaryOpHandler.create()
    // Numeric operations.
    .add('+', 'number', 'number', (a, b) => Fields.number(a.value + b.value))
    .add('-', 'number', 'number', (a, b) => Fields.number(a.value - b.value))
    .add('*', 'number', 'number', (a, b) => Fields.number(a.value * b.value))
    .add('/', 'number', 'number', (a, b) => Fields.number(a.value / b.value))
    .addComparison('number', {
        equals: (a, b) => Fields.bool(a.value == b.value),
        le: (a, b) => Fields.bool(a.value < b.value)
    })
    // String operations.
    .add('+', 'string', '*', (a, b) => Fields.literal('string', a.value + Fields.toString(b)))
    .add('+', '*', 'string', (a, b) => Fields.literal('string', Fields.toString(a) + b.value))
    .addComm("*", 'string', 'number', (a, b) => Fields.literal('string', a.value.repeat(Math.abs(b.value))))
    .addComparison('string', {
        equals: (a, b) => Fields.bool(a.value.localeCompare(b.value) == 0),
        le: (a, b) => Fields.bool(a.value.localeCompare(b.value) < 0)
    })
    // Date Operations.
    .add("-", 'date', 'date', (a, b) => {
        return Fields.literal('duration', normalizeDuration(a.value.diff(b.value, ['years', 'months', 'days', 'hours', 'minutes', 'seconds', 'milliseconds'])))
    })
    .addComparison('date', {
        equals: (a, b) => Fields.bool(a.value.equals(b.value)),
        le: (a, b) => Fields.bool(a.value < b.value)
    })
    // Duration operations.
    .add('+', 'duration', 'duration', (a, b) => Fields.literal('duration', normalizeDuration(a.value.plus(b.value))))
    .add('-', 'duration', 'duration', (a, b) => Fields.literal('duration', normalizeDuration(a.value.minus(b.value))))
    .addComparison('duration', {
        equals: (a, b) => Fields.bool(a.value.equals(b.value)),
        le: (a, b) => Fields.bool(a.value < b.value)
    })
    // Date-Duration operations.
    .addComm('+', 'date', 'duration', (a, b) => Fields.literal('date', a.value.plus(b.value)))
    .add('-', 'date', 'duration', (a, b) => Fields.literal('date', a.value.minus(b.value)))
    // Array operations.
    .add('+', 'array', 'array', (a, b) => Fields.array(([] as LiteralField[]).concat(a.value).concat(b.value)))
    // Object operations.
    .add('+', 'object', 'object', (a, b) => {
        let result = new Map<string, LiteralField>();
        for (let [key, value] of a.value) {
            result.set(key, value);
        }
        for (let [key, value] of b.value) {
            result.set(key, value);
        }
        return Fields.object(result);
    })
    // Link operations.
    .addComparisonContext('link', {
        equals: (a, b, c) => Fields.bool(c.linkHandler.normalize(a.value.path) == c.linkHandler.normalize(b.value.path)),
        le: (a, b, c) => Fields.bool(c.linkHandler.normalize(a.value.path) < c.linkHandler.normalize(b.value.path))
    })
    // Boolean operations.
    .add('&', '*', '*', (a, b) => Fields.literal('boolean', Fields.isTruthy(a) && Fields.isTruthy(b)))
    .add('|', '*', '*', (a, b) => Fields.literal('boolean', Fields.isTruthy(a) || Fields.isTruthy(b)))
    .addComparison('*', {
        equals: (a, b) => Fields.bool(false),
        le: (a, b) => Fields.bool(a.valueType < b.valueType)
    })
    // Null comparisons.
    .addComparison('null', {
        equals: (a, b) => Fields.bool(true),
        le: (a, b) => Fields.bool(false)
    })
    // Fall-back comparisons-to-null (assumes null is less than anything else).
    .add('<', 'null', '*', (a, b) => Fields.literal('boolean', true))
    .add('<', '*', 'null', (a, b) => Fields.literal('boolean', false))
    .add('>', 'null', '*', (a, b) => Fields.literal('boolean', false))
    .add('>', '*', 'null', (a, b) => Fields.literal('boolean', true))
    .add('>=', 'null', '*', (a, b) => Fields.literal('boolean', false))
    .add('>=', '*', 'null', (a, b) => Fields.literal('boolean', true))
    .add('<=', 'null', '*', (a, b) => Fields.literal('boolean', true))
    .add('<=', '*', 'null', (a, b) => Fields.literal('boolean', false))
    ;

/////////////////////////////
// Function Implementation //
/////////////////////////////

/** A function implementation which maps arguments to some output result. */
export type FunctionImpl = (args: LiteralField[], context: Context) => LiteralField | string;

export interface Function {
    /** The name of the function. Functions can have the same name as long as their  */
    name: string;
    /** The function */
    impl: FunctionImpl;
    /** The argument types this function accepts. */
    args?: LiteralTypeOrAll[];
}

export class FunctionHandler {
    /** Maps function names -> list of function implementations. */
    private map: Map<string, Function[]>;
    /** Maps function names -> variable positions which should be vectorized. */
    private vectorized: Map<string, number[]>;

    public constructor() {
        this.map = new Map();
        this.vectorized = new Map();
    }

    public addFunction(func: Function): FunctionHandler {
        if (!this.map.has(func.name)) this.map.set(func.name, []);
        this.map.get(func.name)?.push(func);
        return this;
    }

    public add1<T extends LiteralTypeOrAll>(name: string, arg: LiteralTypeOrAll,
        impl: (arg: LiteralFieldReprAll<T>, context: Context) => LiteralField | string): FunctionHandler {
        return this.addFunction({
            name,
            args: [arg],
            impl: (args, context) => impl(args[0] as LiteralFieldReprAll<T>, context)
        });
    }

    public add2<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(name: string, arg1: T, arg2: U,
        impl: (arg1: LiteralFieldReprAll<T>, arg2: LiteralFieldReprAll<U>, context: Context) => LiteralField | string): FunctionHandler {
        return this.addFunction({
            name,
            args: [arg1, arg2],
            impl: (args, context) => impl(args[0] as LiteralFieldReprAll<T>, args[1] as LiteralFieldReprAll<U>, context)
        });
    }

    public add3<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll, V extends LiteralTypeOrAll>(name: string,
        arg1: T, arg2: U, arg3: V,
        impl: (arg1: LiteralFieldReprAll<T>, arg2: LiteralFieldReprAll<U>, arg3: LiteralFieldReprAll<V>, context: Context) => LiteralField | string): FunctionHandler {
        return this.addFunction({
            name,
            args: [arg1, arg2, arg3],
            impl: (args, context) => impl(args[0] as LiteralFieldReprAll<T>, args[1] as LiteralFieldReprAll<U>, args[2] as LiteralFieldReprAll<V>, context)
        });
    }

    public addVararg(name: string, impl: FunctionImpl): FunctionHandler {
        return this.addFunction({ name, impl });
    }

    public vectorize(name: string, positions: number[]): FunctionHandler {
        this.vectorized.set(name, positions);
        return this;
    }

    public evaluate(name: string, args: LiteralField[], context: Context): LiteralField | string {
        if (!this.map.has(name)) return `Unrecognized function '${name}'`;
        let vectorize: number[] = this.vectorized.get(name) ?? [];

        // Check for lists in vectorize positions.
        for (let pos of vectorize) {
            if (pos >= args.length) continue;
            let value = args[pos];
            if (value.valueType != "array") continue;

            let array: LiteralField[] = [];
            let copy = ([] as LiteralField[]).concat(args);
            for (let val of value.value) {
                copy[pos] = val;
                let result = this.evaluate(name, copy, context);
                if (typeof result == "string") return result;
                array.push(result);
            }

            return Fields.array(array);
        }

        // Vectorizing is done, we can just typecheck now.
        outer: for (let func of this.map.get(name) ?? []) {
            if (!func.args) return func.impl(args, context);

            if (args.length != func.args.length) continue;
            for (let index = 0; index < args.length; index++) {
                if (func.args[index] == '*') continue;
                if (func.args[index] != args[index].valueType) continue outer;
            }

            return func.impl(args, context);
        }

        return `Failed to find implementation of '${name}' for arguments: ${args.map(e => e.valueType).join(", ")}`;
    }
}

// Shorthand for convienence.
export type LFR<T extends LiteralTypeOrAll> = LiteralFieldReprAll<T>;

export const FUNCTIONS = new FunctionHandler()
    .add1("length", "array", (field: LFR<'array'>, _context) => Fields.number(field.value.length))
    .add1("length", "object", (field: LFR<'object'>, _context) => Fields.number(field.value.size))
    .add1("length", "string", (field: LFR<'string'>, _context) => Fields.number(field.value.length))
    .add1("length", "*", (field: LFR<'*'>, _context) => Fields.number(0))
    .addVararg("list", (args, _context) => Fields.array(args))
    .addVararg("array", (args, _context) => Fields.array(args))
    .addVararg("object", (args, _context) => {
        if (args.length % 2 != 0) return "object(key1, value1, ...) requires an even number of arguments";
        let result = new Map<string, LiteralField>();
        for (let index = 0; index < args.length; index += 2) {
            let key = args[index];
            if (key.valueType != "string") return "keys should be of type string for object(key1, value1, ...)";
            result.set(key.value, args[index + 1]);
        }

        return Fields.object(result);
    })
    .add1("link", "string", (field: LFR<'string'>, context) => Fields.link(Link.file(context.linkHandler.normalize(field.value), false)))
    .add1("link", "link", (field: LFR<'link'>, _context) => field)
    .add1("link", "null", (_field, _context) => Fields.NULL)
    .add2("link", "string", "string", (field: LFR<'string'>, display: LFR<'string'>, context) => {
        return Fields.link(Link.file(context.linkHandler.normalize(field.value), false, display.value));
    })
    .add2("link", "link", "string", (field: LFR<'link'>, display: LFR<'string'>, _context) => {
        return Fields.link(field.value.withDisplay(display.value));
    })
    .vectorize("link", [0])
    .add1("elink", "string", (field: LFR<'string'>, context) => {
        let elem = document.createElement('a');
        elem.textContent = field.value;
        elem.rel = "noopener";
        elem.target = "_blank";
        elem.classList.add("external-link");
        elem.href = field.value;
        return Fields.html(elem);
    })
    .add2("elink", "string", "string", (url: LFR<'string'>, name: LFR<'string'>, context) => {
        let elem = document.createElement('a');
        elem.textContent = name.value;
        elem.rel = "noopener";
        elem.target = "_blank";
        elem.classList.add("external-link");
        elem.href = url.value;
        return Fields.html(elem);
    })
    .vectorize("elink", [0])
    .add1("date", "string", (obj: StringField, context) => {
        let parsedDate = EXPRESSION.date.parse(obj.value);
        if (parsedDate.status) return Fields.literal('date', parsedDate.value);
        else return Fields.NULL;
    })
    .add1("date", "date", (obj: DateField, context) => obj)
    .add1("date", "link", (obj: LinkField, context) => {
        // Try to parse from the display...
        if (obj.value.display) {
            let parsedDate = EXPRESSION.date.parse(obj.value.display);
            if (parsedDate.status) return Fields.date(parsedDate.value);
        }

        // Then try to parse from the path...
        let parsedDate = EXPRESSION.date.parse(obj.value.path);
        if (parsedDate.status) return Fields.date(parsedDate.value);

        // Then pull it from the file.
        let resolved = context.linkHandler.resolve(obj.value.path);
        if (resolved.valueType != "null") {
            let maybeDay = context.evaluate(Fields.index(resolved, Fields.indexVariable("file.day")));
            if (typeof maybeDay != "string") return maybeDay;
        }

        return Fields.NULL;
    })
    .vectorize("date", [0])
    .add1("number", "string", (obj: StringField, context) => {
        let numMatch = /(-?[0-9]+(\.[0-9]+)?)/.exec(obj.value.trim());
        if (numMatch) {
            let parsed = parseFloat(numMatch[1]);
            if (!isNaN(parsed)) return Fields.number(parsed);
        }

        return Fields.NULL;
    })
    .add1("number", "number", (obj: LFR<"number">, context) => obj)
    .vectorize("number", [0])
    .add1("round", "number", (obj: NumberField, context) => {
        return Fields.number(Math.round(obj.value));
    })
    .add2("round", "number", "number", (obj: NumberField, decimals: NumberField, context) => {
        if (decimals.value <= 0) return Fields.number(Math.round(obj.value));
        return Fields.number(parseFloat(obj.value.toFixed(decimals.value)));
    })
    .add1("striptime", "date", (obj: DateField, context) => Fields.literal('date', DateTime.fromObject({ year: obj.value.year, month: obj.value.month, day: obj.value.day })))
    .vectorize("striptime", [0])
    .add2("contains", "object", "string", (obj: LFR<"object">, key: LFR<"string">, context) => Fields.bool(obj.value.has(key.value)))
    .add2("contains", "link", "string", (link: LFR<"link">, key: LFR<'string'>, context) => {
        let linkValue = context.linkHandler.resolve(link.value.path);
        if (linkValue.valueType == 'null') return Fields.bool(false);
        return Fields.bool(linkValue.value.has(key.value));
    })
    .add2("contains", "array", "*", (array: LFR<"array">, value: LFR<"*">, context) => {
        for (let entry of array.value) {
            let matches = context.evaluate(Fields.binaryOp(entry, "=", value));
            if (typeof matches == 'string') continue;
            if (Fields.isTruthy(matches)) return Fields.bool(true);
        }
        return Fields.bool(false);
    })
    .add2("contains", "string", "string", (haystack: LFR<"string">, needle: LFR<"string">, context) => {
        return Fields.bool(haystack.value.includes(needle.value));
    })
    .add2("contains", "*", "*", (a: LFR<"*">, b: LFR<"*">, context) => Fields.bool(false))
    .addVararg("extract", (args, context) => {
        if (args.length == 0) return "extract(object, key1, ...) requires at least 1 argument";
        let object = args[0];

        switch (object.valueType) {
            case "link":
                object = context.linkHandler.resolve(object.value.path);
                if (object.valueType == 'null') return Fields.NULL;
            case "object":
                let result = new Map<string, LiteralField>();
                for (let index = 1; index < args.length; index++) {
                    let key = args[index];
                    if (key.valueType != "string") return "extract(object, key1, ...) requires string arguments";
                    result.set(key.value, object.value.get(key.value) ?? Fields.NULL);
                }
                return Fields.object(result);
            default:
                return "extract(object, key1, ...) must be called on an object";
        }
    })
    .vectorize("extract", [0])
    .add1("reverse", "array", (list: LFR<"array">, context) => {
        let array = list.value;
        let result = [];
        for (let index = array.length - 1; index >= 0; index--) {
            result.push(array[index]);
        }

        return Fields.array(result);
    })
    .add1("reverse", "null", (a: LFR<"null">, context) => Fields.NULL)
    .add1("sort", "array", (list: LFR<"array">, context) => {
        let result = ([] as LiteralField[]).concat(list.value);
        result.sort((a, b) => {
            let le = context.evaluate(Fields.binaryOp(a, "<", b));
            if (typeof le == "string") return 0;
            if (Fields.isTruthy(le)) return -1;

            let eq = context.evaluate(Fields.binaryOp(a, "=", b));
            if (typeof eq == "string") return 0;
            if (Fields.isTruthy(eq)) return 0;

            return 1;
        });

        return Fields.array(result);
    })
    .add1("sort", "null", (a: LFR<"null">, context) => Fields.NULL)
    .add2("regexmatch", "string", "string", (patternf: LFR<"string">, fieldf: LFR<"string">, context) => {
        let pattern = patternf.value, field = fieldf.value;
        if (!pattern.startsWith("^") && !pattern.endsWith("$")) pattern = "^" + pattern + "$";
        return Fields.bool(!!field.match(pattern));
    })
    .add2("regexmatch", "null", "*", (a: LFR<"null">, b: LFR<"*">, context) => Fields.bool(false))
    .add2("regexmatch", "*", "null", (a: LFR<"*">, b: LFR<"null">, context) => Fields.bool(false))
    .vectorize("regexmatch", [0, 1])
    .add3("regexreplace", "string", "string", "string", (field: LFR<"string">, pat: LFR<"string">, rep: LFR<"string">, context) => {
        try {
            let reg = new RegExp(pat.value, "g");
            return Fields.string(field.value.replace(reg, rep.value));
        } catch (ex) {
            return `Invalid regexp '${pat}' in regexreplace`;
        }
    })
    .vectorize("regexreplace", [1, 2])
    .add1("lower", "string", (str: LFR<"string">, context) => Fields.string(str.value.toLocaleLowerCase())).vectorize("lower", [0])
    .add1("lower", "null", (str: LFR<"null">, context) => Fields.NULL)
    .add1("upper", "string", (str: LFR<"string">, context) => Fields.string(str.value.toLocaleUpperCase())).vectorize("upper", [0])
    .add1("upper", "null", (str: LFR<"null">, context) => Fields.NULL)
    .add3("replace", "string", "string", "string", (str: LFR<'string'>, pat: LFR<'string'>, repr: LFR<'string'>) => {
        return Fields.string(str.value.replace(pat.value, repr.value));
    })
    .add3("replace", "null", "*", "*", (a: LFR<"null">, b: LFR<"*">, c: LFR<"*">, context) => Fields.NULL)
    .add3("replace", "*", "null", "*", (a: LFR<"*">, b: LFR<"null">, c: LFR<"*">, context) => Fields.NULL)
    .add3("replace", "*", "*", "null", (a: LFR<"*">, b: LFR<"*">, c: LFR<"null">, context) => Fields.NULL)
    .vectorize("replace", [0, 1, 2])
    // default being vectorized is nice, but maybe you want to use it on a list to default it... in that case use ldefault().
    .add2("default", "*", "*", (f: LFR<'*'>, d: LFR<'*'>, context) => f.valueType == 'null' ? d : f).vectorize("default", [0])
    .add2("ldefault", "*", "*", (f: LFR<'*'>, d: LFR<'*'>, context) => f.valueType == 'null' ? d : f)
    .add3("choice", "*", "*", "*", (b: LFR<"*">, left: LFR<"*">, right: LFR<"*">, context) => {
        if (Fields.isTruthy(b)) return left;
        else return right;
    }).vectorize("choice", [0])
    // reduction operators.
    .add2("reduce", "array", "string", (list: LFR<'array'>, opf: LFR<'string'>, context) => {
        if (list.value.length == 0) return Fields.NULL;

        let op = opf.value;
        if (op != '+' && op != '-' && op != '*' && op != '/' && op != '&' && op != '|')
            return "reduce(array, op) supports '+', '-', '/', '*', '&', and '|'";

        let value = list.value[0];
        for (let index = 1; index < list.value.length; index++) {
            // Skip null values to reduce the pain of summing over fields that may or may not exist.
            if (list.value[index].valueType == "null") continue;

            let next = context.evaluate(Fields.binaryOp(value, op, list.value[index]));
            if (typeof next == "string") return next;
            value = next;
        }

        return value;
    })
    .add2("reduce", "null", "*", (a: LFR<"null">, b: LFR<'*'>, context) => Fields.NULL)
    .add2("reduce", "*", "null", (a: LFR<"*">, b: LFR<'null'>, context) => Fields.NULL)
    .vectorize("reduce", [1])
    .add1("sum", "array", (list: LFR<'array'>, context) => {
        return context.evaluate(Fields.func(Fields.variable("reduce"), [list, Fields.string("+")]));
    })
    .add1("sum", "null", (a: LFR<"null">, context) => Fields.NULL)
    .add1("product", "array", (list: LFR<'array'>, context) => {
        return context.evaluate(Fields.func(Fields.variable("reduce"), [list, Fields.string("*")]));
    })
    .add1("product", "null", (a: LFR<"null">, context) => Fields.NULL)
    .add2("join", "array", "string", (a: LFR<"array">, b: LFR<"string">, context) => {
        return Fields.string(a.value.map(v => Fields.toString(v)).join(b.value));
    })
    .add1("join", "array", (a: LFR<"array">, context) => {
        return Fields.string(a.value.map(v => Fields.toString(v)).join(", "));
    })
    .add1("join", "*", (a: LFR<"*">, context) => Fields.string(Fields.toString(a)))
    .add1("any", "array", (list: LFR<"array">, context) => Fields.bool(list.value.some(v => Fields.isTruthy(v))))
    .addVararg("any", (args, context) => Fields.bool(args.some(v => Fields.isTruthy(v))))
    .add1("all", "array", (list: LFR<"array">, context) => Fields.bool(list.value.every(v => Fields.isTruthy(v))))
    .addVararg("all", (args, context) => Fields.bool(args.every(v => Fields.isTruthy(v))))
    .add1("none", "array", (list: LFR<"array">, context) => Fields.bool(!list.value.some(v => Fields.isTruthy(v))))
    .addVararg("none", (args, context) => Fields.bool(!args.some(v => Fields.isTruthy(v))));
