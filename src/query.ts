/** Provides an AST for complex queries. */
import { DateTime, Duration } from 'luxon';

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table' | 'task';

/** The literal types supported by the query engine. */
export type LiteralType = 'boolean' | 'number' | 'string' | 'date' | 'duration' | 'link' | 'array' | 'object' | 'html' | 'null';
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
    T extends 'html' ? HTMLElement :
    any;

/** Valid binary operators. */
export type BinaryOp = '+' | '-' | '*' | '/' | '>' | '>=' | '<=' | '<' | '=' | '!=' | '&' | '|';

/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField | FunctionField | IndexField | NegatedField;
export type LiteralField =
    LiteralFieldRepr<'string'>
    | LiteralFieldRepr<'number'>
    | LiteralFieldRepr<'boolean'>
    | LiteralFieldRepr<'date'>
    | LiteralFieldRepr<'duration'>
    | LiteralFieldRepr<'link'>
    | LiteralFieldRepr<'array'>
    | LiteralFieldRepr<'object'>
    | LiteralFieldRepr<'html'>
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
export type Source = TagSource | FolderSource | LinkSource | EmptySource | NegatedSource | BinaryOpSource;

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

/** Either incoming or outgoing links to a given file. */
export interface LinkSource {
    type: 'link';
    /** The file to look for links to/from.  */
    file: string;
    /**
     * The direction to look - if incoming, then all files linking to the target file. If outgoing, then all files
     * which the file links to.
     */
    direction: 'incoming' | 'outgoing';
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

    export function html(elem: HTMLElement): LiteralFieldRepr<'html'> {
        return Fields.literal('html', elem);
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
            result = Fields.index(result, Fields.string(parts[index]));
        }

        return result;
    }

    export function func(func: Field, args: Field[]): FunctionField {
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
            case "link":
                return field.value.length > 0;
            case "date":
                return field.value.toMillis() != 0;
            case "duration":
                return field.value.as("seconds") != 0;
            case "object":
                return field.value.size > 0;
            case "array":
                return field.value.length > 0;
            case "null":
                return false;
            case "html":
                return true;
        }
    }

    /** Deep copy a field. */
    export function deepCopy(field: Field): Field {
        switch (field.type) {
            case "literal":
                if (field.valueType == 'array') {
                    return Fields.array(field.value.map(deepCopy) as LiteralField[]);
                } else if (field.valueType == 'object') {
                    let newMap = new Map<string, LiteralField>();
                    for (let [key, value] of field.value.entries()) {
                        newMap.set(key, deepCopy(value) as LiteralField);
                    }
                    return Fields.object(newMap);
                } else {
                    return field;
                }
            case "variable": return field;
            case "binaryop": return Fields.binaryOp(deepCopy(field.left), field.op, deepCopy(field.right));
            case "negated": return Fields.negate(deepCopy(field.child));
            case "index": return Fields.index(deepCopy(field.object), deepCopy(field.index));
            case "function": return Fields.func(field.func, field.arguments.map(deepCopy));
        }
    }

    /** Renders an object as a string. */
    export function toLiteralKey(field: LiteralField): string {
        switch (field.valueType) {
            case "string":
            case "number":
            case "null":
            case "link":
            case "date":
            case "boolean":
                return `${field.valueType}:${field.value}`;
            case "duration":
                return `${field.valueType}:${field.value.toISO()}`
            case "array":
                return `array:[${field.value.map(toLiteralKey).join(", ")}]`;
            case "object":
                return `object:[${Object.entries(field.value).map(val => `${val[0]}:${toLiteralKey(val[1])}`).join(", ")}]`
            case "html":
                return "" + field.value;
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

    export function link(file: string, incoming: boolean): LinkSource {
        return { type: 'link', file, direction: incoming ? 'incoming' : 'outgoing' };
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

//////////////////////
// Query Definition //
//////////////////////

/** A query which should render a list of elements. */
export interface ListQuery {
    type: 'list';
    /** What should be rendered in the list. */
    format?: Field;
}

/** A query which renders a table of elements. */
export interface TableQuery {
    type: 'table';
    /** The fields (computed or otherwise) to select. */
    fields: NamedField[];
}

/** A query which renders a collection of tasks. */
export interface TaskQuery {
    type: 'task';
}

export type QueryHeader = ListQuery | TableQuery | TaskQuery;

export interface WhereStep {
    type: 'where';
    clause: Field;
}

export interface SortByStep {
    type: 'sort';
    fields: QuerySortBy[];
}

export interface LimitStep {
    type: 'limit';
    amount: Field;
}

export interface FlattenStep {
    type: 'flatten';
    field: NamedField;
}

export interface GroupStep {
    type: 'group';
    field: NamedField;
}

export interface HavingStep {
    type: 'having';
    clause: Field;
}

export type QueryOperation = WhereStep | SortByStep | LimitStep | FlattenStep | GroupStep | HavingStep;

/**
 * A query over the Obsidian database. Queries have a specific and deterministic execution order:
 */
export interface Query {
    /** The view type to render this query in. */
    header: QueryHeader;
    /** The source that file candidates will come from. */
    source: Source;
    /** The operations to apply to the data to produce the final result that will be rendered. */
    operations: QueryOperation[];
}

export namespace Queries {

}
