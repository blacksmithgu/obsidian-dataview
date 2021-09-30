import { Link, Task, Values } from "data/value";
import { DateTime, Duration } from "luxon";

/** An encoded type which can be transfered across threads. */
export type TransferableValue =
    | null
    | undefined
    | number
    | string
    | boolean
    | Array<TransferableValue>
    | Record<string, any>
    | Map<string, TransferableValue>
    | Set<TransferableValue>
    | {
          "___transfer-type": "date" | "duration" | "link" | "task";
          value: Record<string, TransferableValue>;
          options?: Record<string, TransferableValue>;
      };

export namespace Transferable {
    /** Convert a literal value to a serializer-friendly transferable value. Does not work for all types. */
    export function transferable(value: any): TransferableValue {
        // Handle non-dataview values first.
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
                    options: { zone: wrapped.value.zoneName },
                };
            case "duration":
                return { "___transfer-type": "duration", value: transferable(wrapped.value.toObject()) };
            case "array":
                return wrapped.value.map(v => transferable(v));
            case "object":
                let result: Record<string, any> = {};
                for (let [key, value] of Object.entries(wrapped.value)) result[key] = transferable(value);
                return result;
            case "link":
                return { "___transfer-type": "link", value: transferable(wrapped.value.toObject()) };
            case "task":
                return { "___transfer-type": "task", value: transferable(wrapped.value.toObject(false)) };
            default:
                throw Error("Unrecognized transferable literal value: " + value);
        }
    }

    /** Convert a transferable value back to a literal value we can work with. */
    export function value(transferable: TransferableValue): any {
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
                        return Link.fromObject(value(transferable.value));
                    case "task":
                        return Task.fromObject(value(transferable.value));
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
