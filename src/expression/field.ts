/** Defines the AST for a field which can be evaluated. */
import { LiteralValue } from "src/data/value";

/** Comparison operators which yield true/false. */
export type CompareOp = '>' | '>=' | '<=' | '<' | '=' | '!=';
/** Arithmetic operators which yield numbers and other values. */
export type ArithmeticOp = '+' | '-' | '*' | '/' | '&' | '|';
/** All valid binary operators. */
export type BinaryOp = CompareOp | ArithmeticOp;
/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField | FunctionField | IndexField | NegatedField;

/** Literal representation of some field type. */
export interface LiteralField {
    type: 'literal';
    value: LiteralValue;
}

/** A variable field for a variable with a given name. */
export interface VariableField {
    type: 'variable';
    name: string;
}

/** A binary operator field which combines two subnodes somehow. */
export interface BinaryOpField {
    type: 'binaryop';
    left: Field;
    right: Field;
    op: BinaryOp;
}

/** A function field which calls a function on 0 or more arguments. */
export interface FunctionField {
    type: 'function';
    /** The name of the function being called. */
    func: Field;
    /** The arguments being passed to the function. */
    arguments: Field[];
}

/** A field which indexes a variable into another variable. */
export interface IndexField {
    type: 'index';
    /** The field to index into. */
    object: Field;
    /** The index. */
    index: Field;
}

/** A field which negates the value of the original field. */
export interface NegatedField {
    type: 'negated';
    /** The child field to negated. */
    child: Field;
}

/** Utility methods for creating & comparing fields. */
export namespace Fields {
    export const NULL = Fields.literal(null);

    export function variable(name: string): VariableField {
        return { type: 'variable', name };
    }

    export function literal(value: LiteralValue): LiteralField {
        return { type: 'literal', value };
    }

    export function binaryOp(left: Field, op: BinaryOp, right: Field): Field {
        return { type: 'binaryop', left, op, right } as BinaryOpField;
    }

    export function index(obj: Field, index: Field): IndexField {
        return { type: 'index', object: obj, index };
    }

    /** Converts a string in dot-notation-format into a variable which indexes. */
    export function indexVariable(name: string): Field {
        let parts = name.split(".");
        let result: Field = Fields.variable(parts[0]);
        for (let index = 1; index < parts.length; index++) {
            result = Fields.index(result, Fields.literal(parts[index]));
        }

        return result;
    }

    export function func(func: Field, args: Field[]): FunctionField {
        return { type: 'function', func, arguments: args };
    }

    export function negate(child: Field): NegatedField {
        return { type: 'negated', child };
    }

    export function isCompareOp(op: BinaryOp): op is CompareOp {
        return op == "<=" || op == "<" || op == ">" || op == ">=" || op == "!=" || op == "=";
    }
}
