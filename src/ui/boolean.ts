import { currentLanguage, t } from "i18n";
import { Literal, Values } from "data-model/value";

/** French presentation of a boolean, without changing its underlying value. */
export function booleanLabel(value: boolean): string {
    return /^fr(?:-|_|$)/i.test(currentLanguage()) ? t(value ? "Yes" : "No") : String(value);
}

/** Prepare display-only copies for Markdown exports, including nested values. */
export function displayValue(value: Literal): Literal {
    if (Values.isBoolean(value)) return booleanLabel(value);
    if (Values.isArray(value)) return value.map(displayValue);
    if (Values.isObject(value) && (value.constructor === Object || !value.constructor)) {
        return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, displayValue(child)]));
    }
    return value;
}
