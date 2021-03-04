/** Provides an AST for complex queries. */
import 'parsimmon';
import { DateTime, Duration } from 'luxon';
import { EXPRESSION } from './parse';
import * as Parsimmon from 'parsimmon';

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table' | 'task';

/** The literal types supported by the query engine. */
export type LiteralType = 'boolean' | 'number' | 'string' | 'date' | 'duration' | 'link' | 'array' | 'object' | 'null';
/** Maps the string type to it's actual javascript representation. */
export type LiteralTypeRepr<T extends LiteralType> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? Duration :
    T extends 'date' ? DateTime :
    T extends 'null' ? null :
    T extends 'link'? string :
    T extends 'array' ? Array<LiteralField> :
    T extends 'object' ? Map<string, LiteralField> :
    any;

/** Valid binary operators. */
export type BinaryOp = '+' | '-' | '*' | '/' | '>' | '>=' | '<=' | '<' | '=' | '!=' | '&' | '|';

/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField | FunctionField | NegatedField;
export type LiteralField =
    LiteralFieldRepr<'string'>
    | LiteralFieldRepr<'number'>
    | LiteralFieldRepr<'boolean'>
    | LiteralFieldRepr<'date'>
    | LiteralFieldRepr<'duration'>
    | LiteralFieldRepr<'link'>
    | LiteralFieldRepr<'array'>
    | LiteralFieldRepr<'object'>
    | LiteralFieldRepr<'null'>;

/** Literal representation of some field type. */
export interface LiteralFieldRepr<T extends LiteralType> {
    type: 'literal';
    valueType: T;
    value: LiteralTypeRepr<T>;
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
    func: string;
    /** The arguments being passed to the function. */
    arguments: Field[];
}

/** A field which negates the value of the original field. */
export interface NegatedField {
    type: 'negated';
    /** The child field to negated. */
    child: Field;
}

/** Fields used in the query portion. */
export interface NamedField {
    /** The effective name of this field. */
    name: string;
    /** The value of this field. */
    field: Field;
}

/** A query sort by field, for determining sort order. */
export interface QuerySortBy {
    /** The field to sort on. */
    field: Field;
    /** The direction to sort in. */
    direction: 'ascending' | 'descending';
}

/** The source of files for a query. */
export type Source = TagSource | FolderSource | EmptySource | NegatedSource | BinaryOpSource;

/** A tag as a source of data. */
export interface TagSource {
    type: 'tag';
    /** The tag to source from. */
    tag: string;
}

/** A folder prefix as a source of data. */
export interface FolderSource {
    type: 'folder';
    /** The folder prefix to source from. */
    folder: string;
}

/** A source which is everything EXCEPT the files returned by the given source. */
export interface NegatedSource {
    type: 'negate';
    /** The source to negate. */
    child: Source;
}

/** A source which yields nothing. */
export interface EmptySource {
    type: 'empty';
}

/** A source made by combining subsources with a logical operators. */
export interface BinaryOpSource {
    type: 'binaryop';
    op: BinaryOp;
    left: Source;
    right: Source;
}

/** Utility functions for quickly creating fields. */
export namespace Fields {
    export function variable(name: string): VariableField {
        return { type: 'variable', name };
    }

    export function literal<T extends LiteralType>(vtype: T, val: LiteralTypeRepr<T>): LiteralFieldRepr<T> {
        return { type: 'literal', valueType: vtype, value: val };
    }

    export function bool(value: boolean): LiteralFieldRepr<'boolean'> {
        return Fields.literal('boolean', value);
    }

    export function string(value: string): LiteralFieldRepr<'string'> {
        return Fields.literal('string', value);
    }
    
    export function number(value: number): LiteralFieldRepr<'number'> {
        return Fields.literal('number', value);
    }

    export function duration(value: Duration): LiteralFieldRepr<'duration'> {
        return Fields.literal('duration', value);
    }

    export function link(target: string): LiteralFieldRepr<'link'> {
        return Fields.literal('link', target);
    }

    export function array(target: LiteralField[]): LiteralFieldRepr<'array'> {
        return Fields.literal('array', target);
    }

    export function object(value: Map<string, LiteralField>): LiteralFieldRepr<'object'> {
        return Fields.literal('object', value);
    }

    export function emptyObject(): LiteralFieldRepr<'object'> {
        return object(new Map());
    }

    export function binaryOp(left: Field, op: BinaryOp, right: Field): Field {
        return { type: 'binaryop', left, op, right } as BinaryOpField;
    }

    export function func(func: string, args: Field[]): FunctionField {
        return { type: 'function', func, arguments: args };
    }

    export function negate(child: Field): NegatedField {
        return { type: 'negated', child };
    }

    export function named(name: string, field: Field): NamedField {
        return { name, field } as NamedField;
    }

    export function sortBy(field: Field, dir: 'ascending' | 'descending'): QuerySortBy {
        return { field, direction: dir };
    }

    export function isTruthy(field: LiteralField): boolean {
        switch (field.valueType) {
            case "number":
                return field.value != 0;
            case "string":
                return field.value.length > 0;
            case "boolean":
                return field.value;
            case "null":
                return false;
            case "date":
                return field.value.toMillis() != 0;
            case "duration":
                return field.value.as("seconds") != 0;
            default:
                return false;
        }
    }

    export const NULL = Fields.literal('null', null);
}

export namespace Sources {
    export function tag(tag: string): TagSource {
        return { type: 'tag', tag };
    }

    export function folder(prefix: string): FolderSource {
        return { type: 'folder', folder: prefix };
    }

    export function binaryOp(left: Source, op: BinaryOp, right: Source): Source {
        return { type: 'binaryop', left, op, right };
    }

    export function negate(child: Source): NegatedSource {
        return { type: 'negate', child };
    }

    export function empty(): EmptySource {
        return { type: 'empty' };
    }
}

/** A query over the Obsidian database. */
export interface Query {
    /** The view type to render this query in. */
    type: QueryType;
    /** The fields (computed or otherwise) to select. */
    fields: NamedField[];
    /** The source that file candidates will come from. */
    source: Source;
    /** A boolean field which determines if a given entry should be included. */
    where: Field;
    /** */
    sortBy: QuerySortBy[];
}