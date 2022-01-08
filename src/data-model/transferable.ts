import { Link } from "data-model/link";
import { Values } from "data-model/value";
import { DateTime, Duration } from "luxon";

export namespace Transferable {
    /** Infer the transfer type of an input object (generally a class). */
    function inferType(value: any): string | undefined {
        if (Values.isLink(value)) return "link";
        else return undefined;
    }

    /** Convert a literal value to a serializer-friendly transferable value. Does not work for all types. */
    export function transferable(value: any): any {
        // Handle non-dataview values first.
        if (value instanceof Map) {
            let copied = new Map();
            for (let [key, val] of value.entries()) copied.set(transferable(key), transferable(val));
            return copied;
        } else if (value instanceof Set) {
            let copied = new Set();
            for (let val of value) copied.add(transferable(val));
            return copied;
        } else if (Values.isDate(value)) {
            return {
                "___transfer-type": "date",
                value: transferable(value.toObject()),
                options: { zone: value.zoneName },
            };
        } else if (Values.isDuration(value)) {
            return { "___transfer-type": "duration", value: transferable(value.toObject()) };
        } else if (
            Values.isNull(value) ||
            Values.isNumber(value) ||
            Values.isString(value) ||
            Values.isBoolean(value)
        ) {
            return value;
        } else if (Values.isArray(value)) {
            return value.map(v => transferable(v));
        } else {
            let result: Record<string, any> = {};
            for (let [key, val] of Object.entries(value)) result[key] = transferable(val);

            let inferredType = inferType(value);
            if (inferredType) result["___transfer-type"] = inferredType;
            return result;
        }
    }

    /** Convert a transferable value back to a literal value we can work with. */
    export function value(transferable: any): any {
        if (transferable === null) {
            return null;
        } else if (transferable === undefined) {
            return undefined;
        } else if (transferable instanceof Map) {
            let real = new Map();
            for (let [key, val] of transferable.entries()) real.set(value(key), value(val));
            return real;
        } else if (transferable instanceof Set) {
            let real = new Set();
            for (let val of transferable) real.add(value(val));
            return real;
        } else if (Array.isArray(transferable)) {
            return transferable.map(v => value(v));
        } else if (typeof transferable === "object") {
            if ("___transfer-type" in transferable) {
                switch (transferable["___transfer-type"]) {
                    case "date":
                        let rawDate = DateTime.fromObject(value(transferable.value));
                        let dateOpts = value(transferable.options);
                        if (dateOpts.zone) rawDate.setZone(dateOpts.zone);
                        return rawDate;
                    case "duration":
                        return Duration.fromObject(value(transferable.value));
                    case "link":
                        return new Link(value(transferable.value));
                    default:
                        throw Error(`Unrecognized transfer type '${transferable["___transfer-type"]}'`);
                }
            }

            let result: Record<string, any> = {};
            for (let [key, val] of Object.entries(transferable)) result[key] = value(val);
            return result;
        }

        return transferable;
    }
}
