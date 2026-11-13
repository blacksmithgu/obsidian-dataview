/** Language selection and display-only translations; stored identifiers stay unchanged. */
import { french } from "./fr";

/** Read Obsidian's interface preference without coupling pure modules to its runtime. */
export function currentLanguage(): string {
    // Obsidian stores its language preference here; an absent value means English.
    // Access can fail in restricted browser contexts and is absent in Node tests.
    try {
        return typeof window !== "undefined" ? window.localStorage.getItem("language") || "en" : "en";
    } catch {
        return "en";
    }
}

/** English is the fallback for every missing key and unsupported language. */
export function translate(language: string, key: string, ...values: unknown[]): string {
    const text =
        /^fr(?:-|_|$)/i.test(language) && Object.prototype.hasOwnProperty.call(french, key) ? french[key] : key;
    return text.replace(/\{(\d+)\}/g, (placeholder, index: string) =>
        Number(index) < values.length ? String(values[Number(index)]) : placeholder
    );
}

/** Supports plain labels and tagged templates without reinterpreting interpolated values. */
export function t(key: string | TemplateStringsArray, ...values: unknown[]): string {
    if (typeof key === "string") return translate(currentLanguage(), key, ...values);
    const message = key.reduce((text, part, index) => text + (index ? "{" + (index - 1) + "}" : "") + part, "");
    return translate(currentLanguage(), message, ...values);
}
