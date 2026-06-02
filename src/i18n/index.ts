import en from "./locales/en";

type LocaleData = typeof en;
type DeepPartial<T> = { [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P] };

const locales: Record<string, DeepPartial<LocaleData>> = { en };

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
    const parts = path.split(".");
    let current: unknown = obj;
    for (const part of parts) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return typeof current === "string" ? current : undefined;
}

function interpolate(template: string, params: string[]): string {
    return template.replace(/\{(\d+)\}/g, (_, i: string) => params[parseInt(i)] ?? "");
}

let currentLocaleData: DeepPartial<LocaleData> = en;

/** Initialize i18n. Call this on plugin load with the detected locale. */
export function setLocale(locale: string) {
    const lang = locale.split("-")[0].toLowerCase();
    currentLocaleData = locales[lang] ?? locales[locale] ?? en;
}

/** Register a new locale. */
export function addLocale(locale: string, data: DeepPartial<LocaleData>) {
    locales[locale] = data;
}

/** Translate a dot-notation key with optional {0}, {1}, ... interpolation. */
export function t(key: string, ...params: string[]): string {
    const value =
        getNestedValue(currentLocaleData as Record<string, unknown>, key) ??
        getNestedValue(en as Record<string, unknown>, key);
    if (value === undefined) {
        console.warn(`[dataview] Missing i18n key: ${key}`);
        return key;
    }
    return params.length > 0 ? interpolate(value, params) : value;
}
