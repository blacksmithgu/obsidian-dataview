import { DateTime, Duration } from "luxon";
import { DEFAULT_QUERY_SETTINGS, QuerySettings } from "src/settings";
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

    public static file(path: string, embed: boolean = false, display?: string) {
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

    public static fromObject(object: Record<string, any>) {
        return new Link(object);
    }

    private constructor(fields: Partial<Link>) {
        Object.assign(this, fields);
    }

    public equals(other: Link): boolean {
        return this.path == other.path
            && this.type == other.type
            && this.subpath == other.subpath;
    }

    public toString(): string {
        return this.markdown();
    }

    /** Convert this link to a raw object which */
    public toObject(): Record<string, any> {
        return { path: this.path, type: this.type, subpath: this.subpath, display: this.display, embed: this.embed };
    }

    /** Return a new link which points to the same location but with a new display value. */
    public withDisplay(display?: string) {
        return new Link(Object.assign({}, this, { display }));
    }

    /** Convert this link to markdown so it can be rendered. */
    public markdown(): string {
        let result = (this.embed ? "!" : "") + "[[" + this.path;

        if (this.type == 'header') result += '#' + this.subpath;
        else if (this.type == 'block') result += '^' + this.subpath;

        if (this.display && !this.embed) result += '|' + this.display;
        else if (!this.embed) result += '|' + getFileName(this.path).replace(".md", "");

        result += ']]';
        return result;
    }

    /** The stripped name of the file this link points into. */
    public fileName(): string {
        return getFileName(this.path).replace(".md", "");
    }
}

/** Shorthand for a mapping from keys to values. */
export type DataObject = { [key: string]: LiteralValue };
/** The literal types supported by the query engine. */
export type LiteralType = 'boolean' | 'number' | 'string' | 'date' | 'duration' | 'link' | 'array' | 'object' | 'html' | 'function' | 'null';
/** The raw values that a literal can take on. */
export type LiteralValue = boolean | number | string | DateTime | Duration | Link | Array<LiteralValue> | DataObject | HTMLElement | Function | null;

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
    export function toString(field: any, setting: QuerySettings = DEFAULT_QUERY_SETTINGS, recursive: boolean = false): string {
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
                result += wrapped.value.map(f => toString(f, setting, true)).join(", ")
                if (recursive) result += "]";
                return result;
            case "object":
                return "{ " + Object.entries(wrapped.value).map(e => e[0] + ": " + toString(e[1], setting, true)).join(", ") + " }";
            case "date":
                if (wrapped.value.second == 0 && wrapped.value.hour == 0 && wrapped.value.minute == 0) {
                    return wrapped.value.toFormat(setting.defaultDateFormat);
                }

                return wrapped.value.toFormat(setting.defaultDateTimeFormat);
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
    export function compareValue(val1: LiteralValue, val2: LiteralValue, linkNormalizer?: (link: string) => string): number {
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
                let normalize = linkNormalizer ?? ((x: string) => x);
                return normalize(wrap1.value.path).localeCompare(normalize((wrap2.value as Link).path));
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

    /** Deep copy a field. */
    export function deepCopy<T extends LiteralValue>(field: T): T {
        if (field === null || field === undefined) return field;

        if (Values.isArray(field)) {
            return ([] as LiteralValue[]).concat(field.map(v => deepCopy(v))) as T;
        } else if (Values.isObject(field)) {
            let result: Record<string, LiteralValue> = {};
            for (let [key, value] of Object.entries(field)) result[key] = deepCopy(value);
            return result as T;
        } else {
            return field;
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
        if (typeof HTMLElement !== 'undefined') {
            return val instanceof HTMLElement;
        } else {
            return false;
        }
    }

    export function isObject(val: any): val is Record<string, any> {
        return typeof val == "object" && !isHtml(val) && !isArray(val) && !isDuration(val) && !isDate(val)
            && !isLink(val);
    }

    export function isFunction(val: any): val is Function {
        return typeof val == "function";
    }
}

/** An encoded type which can be transfered across threads. */
export type TransferableValue = null | undefined | number | string | boolean | Array<any> | Record<string, any>
    | { "___transfer-type": "date" | "duration" | "link", value: Record<string, any> };

export namespace TransferableValues {
    /** Convert a literal value to a serializer-friendly transferable value. Does not work for all types. */
    export function transferable(value: LiteralValue): TransferableValue {
        let wrapped = Values.wrapValue(value);
        if (wrapped === undefined) return undefined;

        switch (wrapped.type) {
            case "null":
            case "number":
            case "string":
            case "boolean":
                return wrapped.value;
            case "date":
                return { "___transfer-type": "date", "value": wrapped.value.toObject({ includeConfig: true }) };
            case "duration":
                return { "___transfer-type": "duration", "value": wrapped.value.toObject({ includeConfig: true }) };
            case "array":
                return wrapped.value.map(v => transferable(v));
            case "object":
                let result: Record<string, any> = {};
                for (let [key, value] of Object.entries(wrapped.value)) result[key] = transferable(value);
                return result;
            case "link":
                return { "___transfer-type": "link", "value": wrapped.value.toObject() };
            default:
                return undefined;
        }
    }

    /** Convert a transferable value back to a literal value we can work with. */
    export function value(transferable: TransferableValue): LiteralValue {
        if (transferable === null || transferable === undefined) {
            return null;
        } else if (typeof transferable === "object" && "___transfer-type" in transferable) {
            switch (transferable["___transfer-type"]) {
                case "date": return DateTime.fromObject(transferable.value);
                case "duration": return Duration.fromObject(transferable.value);
                case "link": return Link.fromObject(transferable.value);
            }
        } else if (Array.isArray(transferable)) {
            return transferable.map(v => value(v));
        }

        return transferable as LiteralValue;
    }
}
