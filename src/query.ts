/** Provides an AST for complex queries. */
import { DateTime, Duration } from 'luxon';
import { getFileName } from './util/normalize';

/** An Obsidian link with all associated metadata. */
export class Link {
    /** The file path this link points to. */
    public path: string;
    /** The display name associated with the link. */
    public display?: string;
    /** The block ID or header this link points to within a file, if relevant. */
    public subpath?: string;
    /** Is this link an embedded link (!)? */
    public embed: boolean;
    /** The type of this link, which determines what 'subpath' refers to, if anything. */
    public type: 'file' | 'header' | 'block';

    public static file(path: string, embed: boolean, display?: string) {
        return new Link({
            path,
            embed,
            display,
            type: 'file'
        });
    }

    public static header(path: string, header: string, embed: boolean, display?: string) {
        return new Link({
            path,
            embed,
            display,
            subpath: header,
            type: 'header'
        });
    }

    public static block(path: string, blockId: string, embed: boolean, display?: string) {
        return new Link({
            path,
            embed,
            display,
            subpath: blockId,
            type: 'block'
        });
    }

    private constructor(fields: Partial<Link>) {
        Object.assign(this, fields);
    }

    public equals(other: Link): boolean {
        return this.path == other.path
            && this.type == other.type
            && this.subpath == other.subpath;
    }

    /** Return a new link which points to the same location but with a new display value. */
    public withDisplay(display?: string) {
        return new Link(Object.assign({}, this, { display }));
    }

    public markdown(): string {
        let result = (this.embed ? "!" : "") + "[[" + this.path;

        if (this.type == 'header') result += '#' + this.subpath;
        else if (this.type == 'block') result += '^' + this.subpath;

        if (this.display && !this.embed) result += '|' + this.display;
        else if (!this.embed) result += '|' + getFileName(this.path).replace(".md", "");

        result += ']]';
        return result;
    }
}

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table' | 'task';

/** The literal types supported by the query engine. */
export type LiteralType = 'boolean' | 'number' | 'string' | 'date' | 'duration' | 'link' | 'array' | 'object' | 'html' | 'null';

/** Maps the string type to it's internal javascript representation. */
export type LiteralTypeRepr<T extends LiteralType> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? Duration :
    T extends 'date' ? DateTime :
    T extends 'null' ? null :
    T extends 'link'? Link :
    T extends 'array' ? Array<LiteralField> :
    T extends 'object' ? Map<string, LiteralField> :
    T extends 'html' ? HTMLElement :
    any;

/** Maps the string type to it's external, API-facing representation. */
export type ExternalTypeRepr<T extends LiteralType> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? Duration :
    T extends 'date' ? DateTime :
    T extends 'null' ? null :
    T extends 'link' ? Link :
    T extends 'array' ? Array<any> :
    T extends 'object' ? Record<string, any> :
    T extends 'html' ? HTMLElement :
    any;

/** The raw values that a literal can take on. */
export type LiteralValue = ExternalTypeRepr<LiteralType>;
/** A wrapped literal value which can be switched on. */
export type WrappedLiteralValue =
    LiteralValueWrapper<'string'>
    | LiteralValueWrapper<'number'>
    | LiteralValueWrapper<'boolean'>
    | LiteralValueWrapper<'date'>
    | LiteralValueWrapper<'duration'>
    | LiteralValueWrapper<'link'>
    | LiteralValueWrapper<'array'>
    | LiteralValueWrapper<'object'>
    | LiteralValueWrapper<'html'>
    | LiteralValueWrapper<'null'>;

export interface LiteralValueWrapper<T extends LiteralType> {
    type: T;
    value: ExternalTypeRepr<T>;
}

/** Valid binary operators. */
export type BinaryOp = '+' | '-' | '*' | '/' | '>' | '>=' | '<=' | '<' | '=' | '!=' | '&' | '|';

export type StringField = LiteralFieldRepr<'string'>;
export type NumberField = LiteralFieldRepr<'number'>;
export type BooleanField = LiteralFieldRepr<'boolean'>;
export type DateField = LiteralFieldRepr<'date'>;
export type DurationField = LiteralFieldRepr<'duration'>;
export type LinkField = LiteralFieldRepr<'link'>;
export type ArrayField = LiteralFieldRepr<'array'>;
export type ObjectField = LiteralFieldRepr<'object'>;
export type HtmlField = LiteralFieldRepr<'html'>;
export type NullField = LiteralFieldRepr<'null'>;

/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField | FunctionField | IndexField | NegatedField;
export type LiteralField =
    StringField
    | NumberField
    | BooleanField
    | DateField
    | DurationField
    | LinkField
    | ArrayField
    | ObjectField
    | HtmlField
    | NullField;

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

    export function date(value: DateTime): LiteralFieldRepr<'date'> {
        return Fields.literal('date', value);
    }

    export function duration(value: Duration): LiteralFieldRepr<'duration'> {
        return Fields.literal('duration', value);
    }

    export function link(target: Link): LiteralFieldRepr<'link'> {
        return Fields.literal('link', target);
    }

    export function fileLink(target: string): LinkField {
        return link(Link.file(target, false));
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

    /** Convert a field to a raw JavaScript-friendly value. */
    export function fieldToValue(val: LiteralField): LiteralValue {
        switch (val.valueType) {
            case "array":
                return val.value.map(f => fieldToValue(f));
            case "object":
                let result: Record<string, any> = {};
                for (let [key, value] of val.value.entries()) result[key] = fieldToValue(value);
                return result;
            default:
                return val.value;
        }
    }

    /** Wrap a literal value so you can switch on it easily. */
    export function wrapValue(val: LiteralValue): WrappedLiteralValue | undefined {
        if (Fields.isNull(val)) return { type: 'null', value: val };
        else if (isNumber(val)) return { type: 'number', value: val };
        else if (isString(val)) return { type: 'string', value: val };
        else if (isBoolean(val)) return { type: 'boolean', value: val };
        else if (isDuration(val)) return { type: 'duration', value: val };
        else if (isDate(val)) return { type: 'date', value: val };
        else if (isHtml(val)) return { type: 'html', value: val };
        else if (isArray(val)) return { type: 'array', value: val };
        else if (isLink(val)) return { type: 'link', value: val };
        else if (isObject(val)) return { type: 'object', value: val };
        else return undefined;
    }

    /** Convert an arbitrary javascript value into a Dataview field. */
    export function asField(val: LiteralValue): LiteralField | undefined {
        if (val === null || val === undefined) return Fields.NULL;
        if (val instanceof Duration) return Fields.duration(val);
        else if (val instanceof DateTime) return Fields.date(val);
        else if (val instanceof HTMLElement) return Fields.html(val);
        else if (val instanceof Map) return Fields.object(val);
        else if (val instanceof Link) return Fields.link(val);
        else if (Array.isArray(val)) {
            let result: LiteralField[] = [];
            for (let v of val) {
                let converted = asField(v);
                if (converted) result.push(converted);
            }
            return Fields.array(result);
        }
        else if (typeof val == "number") return Fields.number(val);
        else if (typeof val == "boolean") return Fields.bool(val);
        else if (typeof val == "object") {
            let result = new Map<string, LiteralField>();
            for (let key of Object.keys(val)) {
                let converted = asField(val[key]);
                if (converted) result.set(key, converted);
            }
            return Fields.object(result);
        }
        else if (typeof val == "string") {
            // TODO: Add parsing functionality here. For now, just return a string.
            return Fields.string(val);
        }
        else return undefined;
    }

    /** Compare two arbitrary JavaScript values. Produces a total ordering over ANY possible dataview value. */
    export function compareValue(val1: LiteralValue, val2: LiteralValue): number {
        // Handle undefined/nulls first.
        if (val1 === undefined) val1 = null;
        if (val2 === undefined) val2 = null;
        if (val1 === null && val2 === null) return 0;
        else if (val1 === null) return -1;
        else if (val2 === null) return 1;

        // A non-null value now which we can wrap & compare on.
        let wrap1 = wrapValue(val1);
        let wrap2 = wrapValue(val2);

        if (wrap1 === undefined && wrap2 === undefined) return 0;
        else if (wrap1 === undefined) return -1;
        else if (wrap2 === undefined) return 1;

        if (wrap1.type != wrap2.type) return wrap1.type.localeCompare(wrap2.type);

        switch (wrap1.type) {
            case "string":
                return wrap1.value.localeCompare(wrap2.value as string);
            case "number":
                if (wrap1.value < (wrap2.value as number)) return -1;
                else if (wrap1.value == (wrap2.value as number)) return 0;
                return 1;
            case "null":
                return 0;
            case "boolean":
                if (wrap1.value == wrap2.value) return 0;
                else return wrap1.value ? 1 : -1;
            case "link":
                return wrap1.value.path.localeCompare((wrap2.value as Link).path);
            case "date":
                return (wrap1.value < (wrap2.value as DateTime)) ? -1 : (wrap1.value.equals(wrap2.value as DateTime) ? 0 : 1);
            case "duration":
                return wrap1.value < (wrap2.value as Duration) ? -1 : (wrap1.value.equals(wrap2.value as Duration) ? 0 : 1);
            case "array":
                let f1 = wrap1.value;
                let f2 = wrap2.value as any[];
                for (let index = 0; index < Math.min(f1.length, f2.length); index++) {
                    let comp = compareValue(f1[index], f2[index]);
                    if (comp != 0) return comp;
                }
                return f1.length - f2.length;
            case "object":
                let o1 = wrap1.value;
                let o2 = wrap2.value as Record<string, any>;
                let k1 = Array.from(Object.keys(o1));
                let k2 = Array.from(Object.keys(o2));
                k1.sort(); k2.sort();

                let keyCompare = compareValue(k1, k2);
                if (keyCompare != 0) return keyCompare;

                for (let key of k1) {
                    let comp = compareValue(o1[key], o2[key]);
                    if (comp != 0) return comp;
                }
                return 0;
            case "html":
                return 0;
        }
    }

    /** Find the corresponding Dataveiw type for an arbitrary value. */
    export function typeOf(val: any): LiteralType | undefined {
        return wrapValue(val)?.type;
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
                return !!field.value.path;
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
            case "link":
                return `${field.valueType}:${field.value.path}`;
        }
    }

    export function isString(val: any): val is string {
        return typeof val == "string";
    }

    export function isNumber(val: any): val is number {
        return typeof val == "number";
    }

    export function isDate(val: any): val is DateTime {
        return val instanceof DateTime;
    }

    export function isDuration(val: any): val is Duration {
        return val instanceof Duration;
    }

    export function isNull(val: any): val is null | undefined {
        return val === null || val === undefined;
    }

    export function isArray(val: any): val is any[] {
        return Array.isArray(val);
    }

    export function isBoolean(val: any): val is boolean {
        return typeof val === "boolean";
    }

    export function isLink(val: any): val is Link {
        return val instanceof Link;
    }

    export function isHtml(val: any): val is HTMLElement {
        return val instanceof HTMLElement;
    }

    export function isObject(val: any): val is Record<string, any> {
        return typeof val == "object";
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

////////////////////
// Query Settings //
////////////////////

export interface QuerySettings {
    renderNullAs: string;
    warnOnEmptyResult: boolean;
    refreshInterval: number;
}

export const DEFAULT_QUERY_SETTINGS: QuerySettings = {
    renderNullAs: "-",
    warnOnEmptyResult: true,
    refreshInterval: 5000
};

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

export type QueryOperation = WhereStep | SortByStep | LimitStep | FlattenStep | GroupStep;

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
    /** Rendering and execution settings for this query. */
    settings: QuerySettings;
}
