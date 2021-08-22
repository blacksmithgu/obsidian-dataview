/** Test-environment-friendly function which fetches the current system locale. */
export function currentLocale(): string {
    if (typeof window === "undefined") return "en-US";
    return window.navigator.language;
}
