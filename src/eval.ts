/** Evaluates fields in the expression language. */
import { BinaryOp, LiteralType, LiteralField, LiteralFieldRepr, Field, Fields } from './query';

/////////////////////////////////
// Core Context Implementation //
/////////////////////////////////

/** A function which maps a file name to the metadata contained within that file. */
export type LinkResolverImpl = (file: string) => LiteralFieldRepr<'object'> | LiteralFieldRepr<'null'>;

/** The context in which expressions are evaluated in. */
export class Context {
    /** Direct variable fields in the context. */
    private namespace: LiteralFieldRepr<'object'>;
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

    /** Attempts to resolve a field name relative to the given field. */
    public get(name: string, root: LiteralField = this.namespace): LiteralField {
        let parts = name.split(".");

        let current: LiteralField = root;
        for (let index = 0; index < parts.length; index++) {
            let next: LiteralField | undefined = undefined;

            switch (current.valueType) {
                case "object":
                    next = current.value.get(parts[index]);
                    break;
                case "link":
                    let data = this.linkResolver(current.value);
                    if (data.valueType == 'null') return Fields.NULL;
                    next = data.value.get(parts[index]);
                    break;
                default:
                    // Trying to subindex into a non-container type.
                    return Fields.NULL;
            }

            if (next == undefined) return Fields.NULL;
            current = next;
        }

        return current;
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

                let func = this.functions.get(field.func);
                if (!func) return `Function ${field.func} does not exist.`;

                return func(args, this);
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
        equals: (a, b) => Fields.bool(a.value == b.value),
        le: (a, b) => Fields.bool(a.value < b.value)
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
        le: (a, b) => Fields.bool(false)
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

        switch (value.valueType) {
            case "array": return Fields.number(value.value.length);
            case "object": return Fields.number(value.value.size);
            case "string": return Fields.number(value.value.length);
            default: return Fields.number(0);
        }
    })
    .set("list", (args, context) => Fields.array(args))
    .set("array", (args, context) => Fields.array(args))
    .set("get", (args, context) => {
        if (args.length != 2) return "get() requires exactly 2 arguments";
        let object = args[0];
        let index = args[1];

        switch (object.valueType) {
            case "object":
                if (index.valueType != 'string') return "get(object, index) requires a string index";
                return context.get(index.value, object);
            case "link":
                if (index.valueType != 'string') return "get(link, index) requires a string index";
                return context.get(index.value, object);
            case "array":
                if (index.valueType != 'number') return "get(array, index) requires a numeric index";
                if (index.value >= object.value.length || index.value < 0) return Fields.NULL;
                return object.value[index.value];
            case "string":
                if (index.valueType != 'number') return "get(string, index) requires a numeric index";
                if (index.value >= object.value.length || index.value < 0) return Fields.NULL;
                return Fields.string(object.value[index.value]);
        }

        return "get() can only be used on an object, link, array, or string";
    });