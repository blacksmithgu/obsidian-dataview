/** Provides a global dispatch table for evaluating binary operators, including comparison. */
import { LiteralRepr, LiteralType, Literal, Values } from "data-model/value";
import { normalizeDuration } from "util/normalize";
import { Result } from "api/result";
import { BinaryOp } from "expression/field";
import type { Context } from "expression/context";

/** A literal type or a catch-all '*'. */
export type LiteralTypeOrAll = LiteralType | "*";

/** Maps a literal type or the catch-all '*'. */
export type LiteralReprAll<T extends LiteralTypeOrAll> = T extends "*"
    ? Literal
    : T extends LiteralType
    ? LiteralRepr<T>
    : any;

/** An implementation for a binary operator. */
export type BinaryOpImpl<A extends Literal, B extends Literal> = (first: A, second: B, ctx: Context) => Literal;
/** An implementation of a comparator (returning a number) which then automatically defines all of the comparison operators. */
export type CompareImpl<T extends Literal> = (first: T, second: T, ctx: Context) => number;

/** Provides implementations for binary operators on two types using a registry. */
export class BinaryOpHandler {
    private map: Map<string, BinaryOpImpl<any, any>>;

    public static create() {
        return new BinaryOpHandler();
    }

    public constructor() {
        this.map = new Map();
    }

    public register<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(
        left: T,
        op: BinaryOp,
        right: U,
        func: BinaryOpImpl<LiteralReprAll<T>, LiteralReprAll<U>>
    ): BinaryOpHandler {
        this.map.set(BinaryOpHandler.repr(op, left, right), func);
        return this;
    }

    public registerComm<T extends LiteralTypeOrAll, U extends LiteralTypeOrAll>(
        left: T,
        op: BinaryOp,
        right: U,
        func: BinaryOpImpl<LiteralReprAll<T>, LiteralReprAll<U>>
    ): BinaryOpHandler {
        return this.register(left, op, right, func).register(right, op, left, (a, b, ctx) => func(b, a, ctx));
    }

    /** Implement a comparison function. */
    public compare<T extends LiteralTypeOrAll>(type: T, compare: CompareImpl<LiteralReprAll<T>>): BinaryOpHandler {
        return this.register(type, "<", type, (a, b, ctx) => compare(a, b, ctx) < 0)
            .register(type, "<=", type, (a, b, ctx) => compare(a, b, ctx) <= 0)
            .register(type, ">", type, (a, b, ctx) => compare(a, b, ctx) > 0)
            .register(type, ">=", type, (a, b, ctx) => compare(a, b, ctx) >= 0)
            .register(type, "=", type, (a, b, ctx) => compare(a, b, ctx) == 0)
            .register(type, "!=", type, (a, b, ctx) => compare(a, b, ctx) != 0);
    }

    /** Attempt to evaluate the given binary operator on the two literal fields. */
    public evaluate(op: BinaryOp, left: Literal, right: Literal, ctx: Context): Result<Literal, string> {
        let leftType = Values.typeOf(left);
        let rightType = Values.typeOf(right);
        if (!leftType) return Result.failure(`Unrecognized value '${left}'`);
        else if (!rightType) return Result.failure(`Unrecognized value '${right}'`);

        let handler = this.map.get(BinaryOpHandler.repr(op, leftType, rightType));
        if (handler) return Result.success(handler(left, right, ctx));

        // Right-'*' fallback:
        let handler2 = this.map.get(BinaryOpHandler.repr(op, leftType, "*"));
        if (handler2) return Result.success(handler2(left, right, ctx));

        // Left-'*' fallback:
        let handler3 = this.map.get(BinaryOpHandler.repr(op, "*", rightType));
        if (handler3) return Result.success(handler3(left, right, ctx));

        // Double '*' fallback.
        let handler4 = this.map.get(BinaryOpHandler.repr(op, "*", "*"));
        if (handler4) return Result.success(handler4(left, right, ctx));

        return Result.failure(`No implementation found for '${leftType} ${op} ${rightType}'`);
    }

    /** Create a string representation of the given triplet for unique lookup in the map. */
    public static repr(op: BinaryOp, left: LiteralTypeOrAll, right: LiteralTypeOrAll) {
        return `${left},${op},${right}`;
    }
}

/** Configure and create a binary OP handler with the given parameters. */
export function createBinaryOps(linkNormalizer: (x: string) => string): BinaryOpHandler {
    return (
        BinaryOpHandler.create()
            // TODO: Consider not using a universal comparison function.
            .compare("*", (a, b) => Values.compareValue(a, b, linkNormalizer))
            // Global boolean operations.
            .register("*", "&", "*", (a, b) => Values.isTruthy(a) && Values.isTruthy(b))
            .register("*", "|", "*", (a, b) => Values.isTruthy(a) || Values.isTruthy(b))
            // Number implementations.
            .register("number", "+", "number", (a, b) => a + b)
            .register("number", "-", "number", (a, b) => a - b)
            .register("number", "*", "number", (a, b) => a * b)
            .register("number", "/", "number", (a, b) => a / b)
            .register("number", "%", "number", (a, b) => a % b)
            // String implementations.
            .register("string", "+", "*", (a, b, ctx) => a + Values.toString(b, ctx.settings))
            .register("*", "+", "string", (a, b, ctx) => Values.toString(a, ctx.settings) + b)
            .registerComm("string", "*", "number", (a, b) => (b < 0 ? "" : a.repeat(b)))
            // Date Operations.
            .register("date", "-", "date", (a, b) => {
                return normalizeDuration(
                    a.diff(b, ["years", "months", "days", "hours", "minutes", "seconds", "milliseconds"])
                );
            })
            .register("date", "-", "duration", (a, b) => a.minus(b))
            .registerComm("date", "+", "duration", (a, b) => a.plus(b))
            // Duration Operations.
            .register("duration", "+", "duration", (a, b) => normalizeDuration(a.plus(b)))
            .register("duration", "-", "duration", (a, b) => normalizeDuration(a.minus(b)))
            .register("duration", "/", "number", (a, b) => normalizeDuration(a.mapUnits(x => x / b)))
            .registerComm("duration", "*", "number", (a, b) => normalizeDuration(a.mapUnits(x => x * b)))
            // Array operations.
            .register("array", "+", "array", (a, b) => ([] as Literal[]).concat(a).concat(b))
            // Object operations.
            .register("object", "+", "object", (a, b) => Object.assign({}, a, b))
            // Null handling operators.
            .register("null", "+", "null", (_a, _b) => null)
            .register("null", "-", "null", (_a, _b) => null)
            .register("null", "*", "null", (_a, _b) => null)
            .register("null", "/", "null", (_a, _b) => null)
            .register("null", "%", "null", (_a, _b) => null)
            .register("date", "+", "null", (_a, _b) => null)
            .register("null", "+", "date", (_a, _b) => null)
            .register("date", "-", "null", (_a, _b) => null)
            .register("null", "-", "date", (_a, _b) => null)
    );
}
