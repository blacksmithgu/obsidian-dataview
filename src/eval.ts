/** Evaluates fields in the expression language. */
import { BinaryOp, LiteralType, LiteralField, LiteralFieldRepr, Field, Fields } from 'src/query';

/////////////////////////////////
// Core Context Implementation //
/////////////////////////////////

/** A function which maps a file name to the metadata contained within that file. */
export type LinkResolverImpl = (file: string) => LiteralFieldRepr<'object'> | LiteralFieldRepr<'null'>;

/** The context in which expressions are evaluated in. */
export class Context {
    /** Direct variable fields in the context. */
    public namespace: LiteralFieldRepr<'object'>;
    /** Registry of binary operation handlers. */
    public readonly binaryOps: BinaryOpHandler;
    /** Registry of function handlers. */
    public readonly functions: Map<string, FunctionImpl>;
    /** Resolves links into the metadata for the linked file. */
    public readonly linkResolver: LinkResolverImpl;

    public constructor(linkResolver: LinkResolverImpl, namespace: LiteralFieldRepr<'object'> = Fields.emptyObject(),
        binaryOps: BinaryOpHandler = BINARY_OPS, functions: Map<string, FunctionImpl> = FUNCTIONS) {
        this.namespace = namespace;
        this.binaryOps = binaryOps;
        this.functions = functions;
        this.linkResolver = linkResolver;
    }

    /** Add a field to the context. */
    public set(name: string, value: LiteralField): Context {
        this.namespace.value.set(name, value);
        return this;
    }

    /** Attempts to resolve a variable name in the context. */
    public get(name: string): LiteralField {
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
                return this.binaryOps.evaluate(field.op, left, right);
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
                        let func = this.functions.get(field.func.name);
                        if (!func) return `Function ${field.func} does not exist.`;
                        return func(args, this);
                    default:
                        return `Cannot call field '${field.func}' as a function`;
                }
            case "index":
                let obj = this.evaluate(field.object);
                if (typeof obj === 'string') return obj;
                let index = this.evaluate(field.index);
                if (typeof index === 'string') return index;

                switch (obj.valueType) {
                    case "object":
                        if (index.valueType != 'string') return "can only index into objects with strings (a.b or a[\"b\"])";
                        return obj.value.get(index.value) ?? Fields.NULL;
                    case "link":
                        if (index.valueType != 'string') return "can only index into links with strings (a.b or a[\"b\"])";
                        let linkValue = this.linkResolver(obj.value);
                        if (linkValue.valueType == 'null') return Fields.NULL;
                        return linkValue.value.get(index.value) ?? Fields.NULL;
                    case "array":
                        if (index.valueType != 'number') return "array indexing requires a numeric index (array[index])";
                        if (index.value >= obj.value.length || index.value < 0) return Fields.NULL;
                        return obj.value[index.value];
                    case "string":
                        if (index.valueType != 'number') return "string indexing requires a numeric index (string[index])";
                        if (index.value >= obj.value.length || index.value < 0) return Fields.NULL;
                        return Fields.string(obj.value[index.value]);
                    case "date":
                        if (index.valueType != 'string') return "date indexing requires a string representing the unit";
                        switch (index.value) {
                            case "year": return Fields.number(obj.value.year);
                            case "month": return Fields.number(obj.value.month);
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

/** Negate a binary operation; i.e., if op(a, b) = true, then negateOp(op)(a, b) = false. */
function negateOp<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOpImpl<T1, T2>): BinaryOpImpl<T1, T2> {
    return (a, b) => {
        let res = op(a, b);
        if (typeof res == 'string') return res;

        return Fields.bool(!Fields.isTruthy(res));
    }
}

/** Class which allows for type-safe implementation of binary ops. */
export class BinaryOpHandler {
    map: Map<string, BinaryOpImpl<LiteralTypeOrAll, LiteralTypeOrAll>>;

    static create() {
        return new BinaryOpHandler();
    }

    constructor() {
        this.map = new Map();
    }

    /** Add a new handler for the specified types to this handler. */
    public add<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOp, first: T1, second: T2,
        func: BinaryOpImpl<T1, T2>): BinaryOpHandler {
        this.map.set(BinaryOpHandler.repr(op, first, second), func);
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

    /**
     * Add a commutative operator for the specified types to this handler; in addition to adding the normal
     * (op, T1, T2) mapping, it additionally adds (op, T2, T1). Only needed if T1 and T2 are different types.
     */
    public addComm<T1 extends LiteralTypeOrAll, T2 extends LiteralTypeOrAll>(op: BinaryOp, first: T1, second: T2,
        func: BinaryOpImpl<T1, T2>): BinaryOpHandler {
        this.map.set(BinaryOpHandler.repr(op, first, second), func);
        this.map.set(BinaryOpHandler.repr(op, second, first), ((a, b) => func(b, a)) as BinaryOpImpl<T2, T1>);

        return this;
    }

    /** Attempt to evaluate the given binary operator on the two literal fields. */
    public evaluate(op: BinaryOp, left: LiteralField, right: LiteralField): LiteralField | string {
        let handler = this.map.get(BinaryOpHandler.repr(op, left.valueType, right.valueType));
        if (handler) return handler(left, right);

        // Right-'*' fallback:
        let handler2 = this.map.get(BinaryOpHandler.repr(op, left.valueType, '*'));
        if (handler2) return handler2(left, right);

        // Left-'*' fallback:
        let handler3 = this.map.get(BinaryOpHandler.repr(op, '*', right.valueType));
        if (handler3) return handler3(left, right);

        // Double '*' fallback.
        let handler4 = this.map.get(BinaryOpHandler.repr(op, '*', '*'));
        if (handler4) return handler4(left, right);

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
    .addComm('+', 'string', '*', (a, b) => Fields.literal('string', a.value + b.value))
    .addComm("*", 'string', 'number', (a, b) => Fields.literal('string', a.value.repeat(Math.abs(b.value))))
    .addComparison('string', {
        equals: (a, b) => Fields.bool(a.value == b.value),
        le: (a, b) => Fields.bool(a.value < b.value)
    })
    // Date Operations.
    .add("-", 'date', 'date', (a, b) => Fields.literal('duration', b.value.until(a.value).toDuration("seconds")))
    .addComparison('date', {
        equals: (a, b) => Fields.bool(a.value.equals(b.value)),
        le: (a, b) => Fields.bool(a.value < b.value)
    })
    // Duration operations.
    .add('+', 'duration', 'duration', (a, b) => Fields.literal('duration', a.value.plus(b.value)))
    .add('-', 'duration', 'duration', (a, b) => Fields.literal('duration', a.value.minus(b.value)))
    .addComparison('duration', {
        equals: (a, b) => Fields.bool(a.value.equals(b.value)),
        le: (a, b) => Fields.bool(a.value < b.value)
    })
    // Date-Duration operations.
    .addComm('+', 'date', 'duration', (a, b) => Fields.literal('date', a.value.plus(b.value)))
    .add('-', 'date', 'duration', (a, b) => Fields.literal('date', a.value.minus(b.value)))
    // Link operations.
    .addComparison('link', {
        equals: (a, b) => Fields.bool(a.value.replace(".md", "") == b.value.replace(".md", "")),
        le: (a, b) => Fields.bool(a.value.replace(".md", "") < b.value.replace(".md", ""))
    })
    // Array operations.
    .add('+', 'array', 'array', (a, b) => Fields.array([].concat(a.value).concat(b.value)))
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

/** A map of function name -> function implementation. */
export const FUNCTIONS = new Map<string, FunctionImpl>()
    .set("length", (args, context) => {
        if (args.length == 0 || args.length > 1) return "length() requires exactly 1 argument";
        let value = args[0];

        // TODO: Add links to this.
        switch (value.valueType) {
            case "array": return Fields.number(value.value.length);
            case "object": return Fields.number(value.value.size);
            case "string": return Fields.number(value.value.length);
            default: return Fields.number(0);
        }
    })
    .set("list", (args, context) => Fields.array(args))
    .set("array", (args, context) => Fields.array(args))
    .set("object", (args, context) => {
        if (args.length % 2 != 0) return "object(key1, value1, ...) requires an even number of arguments";
        let result = new Map<string, LiteralField>();
        for (let index = 0; index < args.length; index += 2) {
            let key = args[index];
            if (key.valueType != "string") return "keys should be of type string for object(key1, value1, ...)";
            result.set(key.value, args[index + 1]);
        }

        return Fields.object(result);
    })
    .set("contains", (args, context) => {
        if (args.length != 2) return "contains(object|array|string, field) requires exactly 2 arguments";
        let object = args[0];
        let value = args[1];

        switch (object.valueType) {
            case "object":
                if (value.valueType != "string") return "contains(object, field) requires a string argument";
                return Fields.bool(object.value.has(value.value));
            case "link":
                if (value.valueType != "string") return "contains(object, field) requires a string argument";
                let linkValue = context.linkResolver(object.value);
                if (linkValue.valueType == 'null') return Fields.bool(false);
                return Fields.bool(linkValue.value.has(value.value));
            case "array":
                for (let entry of object.value) {
                    let matches = context.evaluate(Fields.binaryOp(entry, "=", value));
                    if (typeof matches == 'string') continue;

                    if (Fields.isTruthy(matches)) return Fields.bool(true);
                }

                return Fields.bool(false);
            case "string":
                if (value.valueType != "string") return "contains(string, field) requires a string field";
                return Fields.bool(object.value.includes(value.value));
            default:
                return "contains(object|array|string, field) requires an object, array, or string for it's first argument";
        }
    })
    .set("extract", (args, context) => {
        if (args.length == 0) return "extract(object, key1, ...) requires at least 1 argument";
        let object = args[0];

        switch (object.valueType) {
            case "link":
                object = context.linkResolver(object.value);
                if (object.valueType == 'null') return Fields.NULL;
            case "object":
                let result = new Map<string, LiteralField>();
                for (let index = 1; index < args.length; index++) {
                    let key = args[index];
                    if (key.valueType != "string") return "extract(object, key1, ...) requires string arguments";
                    result.set(key.value, object.value.get(key.value));
                }
                return Fields.object(result);
            default:
                return "extract(object, key1, ...) must be called on an object";
        }
    })
    .set("reverse", (args, context) => {
        if (args.length != 1) return "reverse(array) takes exactly 1 argument";
        if (args[0].valueType != 'array') return "reverse(array) can only be called on lists";

        let array = args[0].value;
        let result = [];
        for (let index = array.length - 1; index >= 0; index--) {
            result.push(array[index]);
        }

        return Fields.array(result);
    })
    .set("sort", (args, context) => {
        if (args.length != 1) return "sort(array) takes exactly 1 argument";
        if (args[0].valueType != 'array') return "sort(array) can only be called on lists";

        let result = [].concat(args[0].value);
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
    .set("regexmatch", (args, context) => {
        if (args.length != 2) return "regexmatch(pattern, field) requires exactly 2 arguments";
        if (args[0].valueType != "string" || args[1].valueType != "string") return "matches(pattern, field) requires string arguments";
        
        let pattern = args[0].value;
        let value = args[1].value;

        if (!pattern.startsWith("^") && !pattern.endsWith("$")) pattern = "^" + pattern + "$";
        
        return Fields.bool(!!value.match(pattern));
    });