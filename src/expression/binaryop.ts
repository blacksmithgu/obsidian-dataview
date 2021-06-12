/** Provides a global dispatch table for evaluating binary operators, including comparison. */
import { LiteralRepr, LiteralType, LiteralValue, Values } from "src/data/value";
import { normalizeDuration } from "src/util/normalize";
import { Result } from "src/api/result";
import { BinaryOp } from "src/expression/field";

/** A literal type or a catch-all '*'. */
export type LiteralTypeOrAll = LiteralType | '*';

/** Maps a literal type or the catch-all '*'. */
export type LiteralReprAll<T extends LiteralTypeOrAll> =
    T extends '*' ? LiteralValue :
    T extends LiteralType ? LiteralRepr<T> :
    any;

/** An implementation for a binary operator. */
export type BinaryOpImpl<A extends LiteralValue, B extends LiteralValue> = (first: A, second: B) => LiteralValue;
/** An implementation of a comparator (returning a number) which then automatically defines all of the comparison operators. */
export type CompareImpl<T extends LiteralValue> = (first: T, second: T) => number;

/** Provides implementations for binary operators on two types using a registry. */
export class BinaryOpHandler {
    private map: Map<string, BinaryOpImpl<any, any>>;

    public static create() {
        return new BinaryOpHandler();
    }

    public constructor() {
        this.map = new Map();
    }

    public register<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(left: T, op: BinaryOp, right: U,
        func: BinaryOpImpl<LiteralReprAll<T>, LiteralReprAll<U>>): BinaryOpHandler {
        this.map.set(BinaryOpHandler.repr(op, left, right), func);
        return this;
    }

    public registerComm<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(left: T, op: BinaryOp, right: U,
        func: BinaryOpImpl<LiteralReprAll<T>, LiteralReprAll<U>>): BinaryOpHandler {
        return this
            .register(left, op, right, func)
            .register(right, op, left, (a, b) => func(b, a));
    }

    /** Implement a comparison function. */
    public compare<T extends LiteralTypeOrAll>(type: T, compare: CompareImpl<LiteralReprAll<T>>): BinaryOpHandler {
        return this
            .register(type, '<', type, (a, b) => compare(a, b) < 0)
            .register(type, '<=', type, (a, b) => compare(a, b) <= 0)
            .register(type, '>', type, (a, b) => compare(a, b) > 0)
            .register(type, '>=', type, (a, b) => compare(a, b) >= 0)
            .register(type, '=', type, (a, b) => compare(a, b) == 0)
            .register(type, '!=', type, (a, b) => compare(a, b) != 0);
    }

    /** Attempt to evaluate the given binary operator on the two literal fields. */
    public evaluate(op: BinaryOp, left: LiteralValue, right: LiteralValue): Result<LiteralValue, string> {
        let leftType = Values.typeOf(left);
        let rightType = Values.typeOf(right);
        if (!leftType) return Result.failure(`Unrecognized value '${left}'`);
        else if (!rightType) return Result.failure(`Unrecognized value '${right}'`);

        let handler = this.map.get(BinaryOpHandler.repr(op, leftType, rightType));
        if (handler) return Result.success(handler(left, right));

        // Right-'*' fallback:
        let handler2 = this.map.get(BinaryOpHandler.repr(op, leftType, '*'));
        if (handler2) return Result.success(handler2(left, right));

        // Left-'*' fallback:
        let handler3 = this.map.get(BinaryOpHandler.repr(op, '*', rightType));
        if (handler3) return Result.success(handler3(left, right));

        // Double '*' fallback.
        let handler4 = this.map.get(BinaryOpHandler.repr(op, '*', '*'));
        if (handler4) return Result.success(handler4(left, right));

        return Result.failure(`Operator '${op}' is not supported for '${leftType}' and '${rightType}`);
    }

    /** Create a string representation of the given triplet for unique lookup in the map. */
    public static repr(op: BinaryOp, left: LiteralTypeOrAll, right: LiteralTypeOrAll) {
        return `${left},${op},${right}`;
    }
}

/** The default binary operator implementation. */
export const DEFAULT_BINARY_OPS: BinaryOpHandler = BinaryOpHandler.create()
    // TODO: Consider not using a universal comparison function.
    .compare('*', Values.compareValue)
    // Global boolean operations.
    .register('*', '&', '*', (a, b) => Values.isTruthy(a) && Values.isTruthy(b))
    .register('*', '|', '*', (a, b) => Values.isTruthy(a) || Values.isTruthy(b))
    // Number implementations.
    .register('number', '+', 'number', (a, b) => a + b)
    .register('number', '-', 'number', (a, b) => a - b)
    .register('number', '*', 'number', (a, b) => a * b)
    .register('number', '/', 'number', (a, b) => a / b)
    // String implementations.
    .register('string', '+', '*', (a, b) => a + Values.toString(b))
    .register('*', '+', 'string', (a, b) => Values.toString(a) + b)
    .registerComm('string', '*', 'number', (a, b) => b < 0 ? "" : a.repeat(b))
    // Date Operations.
    .register('date', '-', 'date', (a, b) => {
        return normalizeDuration(a.diff(b, ['years', 'months', 'days', 'hours', 'minutes', 'seconds', 'milliseconds']))
    })
    .register('date', '-', 'duration', (a, b) => a.minus(b))
    .registerComm('date', '+', 'duration', (a, b) => a.plus(b))
    // Duration Operations.
    .register('duration', '+', 'duration', (a, b) => normalizeDuration(a.plus(b)))
    .register('duration', '-', 'duration', (a, b) => normalizeDuration(a.minus(b)))
    // Array operations.
    .register('array', '+', 'array', (a, b) => ([] as LiteralValue[]).concat(a).concat(b))
    // Object operations.
    .register('object', '+', 'object', (a, b) => Object.assign({}, a, b))
    ;
