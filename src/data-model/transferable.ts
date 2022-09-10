import { Link, Values } from "data-model/value";
import { DateTime, Duration, SystemZone } from "luxon";

/** Simplifies passing dataview values across the JS web worker barrier. */
export namespace Transferable {
    /** Convert a literal value to a serializer-friendly transferable value. */
    export function transferable(value: any): any {
        // Handle simple universal types first.
        if (value instanceof Map) {
            let copied = new Map();
            for (let [key, val] of value.entries()) copied.set(transferable(key), transferable(val));
            return copied;
        } else if (value instanceof Set) {
            let copied = new Set();
            for (let val of value) copied.add(transferable(val));
            return copied;
        }

        let wrapped = Values.wrapValue(value);
        if (wrapped === undefined) throw Error("Unrecognized transferable value: " + value);

        switch (wrapped.type) {
            case "null":
            case "number":
            case "string":
            case "boolean":
                return wrapped.value;
            case "date":
                return {
                    "___transfer-type": "date",
                    value: transferable(wrapped.value.toObject()),
                    options: {
                        zone: wrapped.value.zone.equals(SystemZone.instance) ? undefined : wrapped.value.zoneName,
                    },
                };
            case "duration":
                return { "___transfer-type": "duration", value: transferable(wrapped.value.toObject()) };
            case "array":
                return wrapped.value.map(v => transferable(v));
            case "link":
                return { "___transfer-type": "link", value: transferable(wrapped.value.toObject()) };
            case "object":
                let result: Record<string, any> = {};
                for (let [key, value] of Object.entries(wrapped.value)) result[key] = transferable(value);
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
                        let dateOpts = value(transferable.options);
                        let dateData = value(transferable.value) as any;

                        return DateTime.fromObject(dateData, { zone: dateOpts.zone });
                    case "duration":
                        return Duration.fromObject(value(transferable.value));
                    case "link":
                        return Link.fromObject(value(transferable.value));
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
