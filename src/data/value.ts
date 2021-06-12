import { DateTime, Duration } from "luxon";
import { getFileName } from "src/util/normalize";

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

/** The literal types supported by the query engine. */
export type LiteralType = 'boolean' | 'number' | 'string' | 'date' | 'duration' | 'link' | 'array' | 'object' | 'html' | 'function' | 'null';
/** The raw values that a literal can take on. */
export type LiteralValue = boolean | number | string | DateTime | Duration | Link | Array<LiteralValue> | { [key: string]: LiteralValue } | HTMLElement | Function | null;

/** Maps the string type to it's external, API-facing representation. */
export type LiteralRepr<T extends LiteralType> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? Duration :
    T extends 'date' ? DateTime :
    T extends 'null' ? null :
    T extends 'link' ? Link :
    T extends 'array' ? Array<LiteralValue> :
    T extends 'object' ? Record<string, LiteralValue> :
    T extends 'html' ? HTMLElement :
    T extends 'function' ? Function :
    any;

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
    | LiteralValueWrapper<'function'>
    | LiteralValueWrapper<'null'>;

export interface LiteralValueWrapper<T extends LiteralType> {
    type: T;
    value: LiteralRepr<T>;
}

export namespace Values {
    /** Convert an arbitary value into a reasonable, Markdown-friendly string if possible. */
    export function toString(field: LiteralValue, recursive: boolean = false): string {
        let wrapped = wrapValue(field);
        if (!wrapped) return "null";

        switch (wrapped.type) {
            case "string": return wrapped.value;
            case "number":
            case "boolean":
            case "html":
            case "null":
                return "" + wrapped.value;
            case "link":
                return wrapped.value.markdown();
            case "function":
                return "<function>";
            case "array":
                let result = "";
                if (recursive) result += "[";
                result += wrapped.value.map(f => toString(f, true)).join(", ")
                if (recursive) result += "]";
                return result;
            case "object":
                return "{ " + Object.entries(wrapped.value).map(e => e[0] + ": " + toString(e[1], true)).join(", ") + " }";
            case "date":
                return wrapped.value.toLocaleString(DateTime.DATETIME_SHORT);
            case "duration":
                return wrapped.value.toISOTime();
        }
    }

    /** Wrap a literal value so you can switch on it easily. */
    export function wrapValue(val: LiteralValue): WrappedLiteralValue | undefined {
        if (isNull(val)) return { type: 'null', value: val };
        else if (isNumber(val)) return { type: 'number', value: val };
        else if (isString(val)) return { type: 'string', value: val };
        else if (isBoolean(val)) return { type: 'boolean', value: val };
        else if (isDuration(val)) return { type: 'duration', value: val };
        else if (isDate(val)) return { type: 'date', value: val };
        else if (isHtml(val)) return { type: 'html', value: val };
        else if (isArray(val)) return { type: 'array', value: val };
        else if (isLink(val)) return { type: 'link', value: val };
        else if (isFunction(val)) return { type: 'function', value: val };
        else if (isObject(val)) return { type: 'object', value: val };
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
            case "function":
                return 0;
        }
    }

    /** Find the corresponding Dataveiw type for an arbitrary value. */
    export function typeOf(val: any): LiteralType | undefined {
        return wrapValue(val)?.type;
    }

    /** Determine if the given value is "truthy" (i.e., is non-null and has data in it). */
    export function isTruthy(field: LiteralValue): boolean {
        let wrapped = wrapValue(field);
        if (!wrapped) return false;

        switch (wrapped.type) {
            case "number":
                return wrapped.value != 0;
            case "string":
                return wrapped.value.length > 0;
            case "boolean":
                return wrapped.value;
            case "link":
                return !!wrapped.value.path;
            case "date":
                return wrapped.value.toMillis() != 0;
            case "duration":
                return wrapped.value.as("seconds") != 0;
            case "object":
                return Object.keys(wrapped.value).length > 0;
            case "array":
                return wrapped.value.length > 0;
            case "null":
                return false;
            case "html":
                return true;
            case "function":
                return true;
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
        return typeof val == "object" && !isHtml(val) && !isArray(val) && !isDuration(val) && !isDate(val)
            && !isLink(val);
    }

    export function isFunction(val: any): val is Function {
        return typeof val == "function";
    }
}
