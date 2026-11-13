/** @jest-environment-options {"customExportConditions":["node","node-addons"]} */
import { h, render } from "preact";
import { act } from "preact/test-utils";
import { DEFAULT_SETTINGS } from "settings";
import { Values } from "data-model/value";
import { booleanLabel, displayValue } from "ui/boolean";
import { renderValue } from "ui/render";
import { DataviewContext, RawLit } from "ui/markdown";
import { markdownList, markdownTable } from "ui/export/markdown";

jest.mock("obsidian", () => ({
    ...jest.requireActual("../../../__mocks__/obsidian"),
    MarkdownRenderChild: class {},
}));

describe("French boolean display", () => {
    beforeEach(() => window.localStorage.setItem("language", "fr"));
    afterEach(() => window.localStorage.removeItem("language"));
    test("preserves English boolean output", () => {
        window.localStorage.setItem("language", "en");
        expect(booleanLabel(true)).toBe("true");
        expect(booleanLabel(false)).toBe("false");
    });
    test.each([
        [true, "Oui"],
        [false, "Non"],
    ] as const)("renders %s in both UI paths", async (value, label) => {
        expect(booleanLabel(value)).toBe(label);
        const element = document.createElement("div");
        element.appendText = text => element.append(document.createTextNode(text));
        await renderValue({} as any, value, element, "", {} as any, DEFAULT_SETTINGS);
        expect(element.textContent).toBe(label);
        element.textContent = "";
        const context = { settings: DEFAULT_SETTINGS } as any;
        act(() =>
            render(
                h(DataviewContext.Provider, { value: context, children: h(RawLit, { value, sourcePath: "" }) }),
                element
            )
        );
        expect(element.textContent).toBe(label);
        render(null, element);
    });

    test("exports nested booleans and preserves source data and strings", () => {
        const data = { checked: true, items: [false, "true", "false"] };
        expect(displayValue(data)).toEqual({ checked: "Oui", items: ["Non", "true", "false"] });
        expect(data).toEqual({ checked: true, items: [false, "true", "false"] });
        for (const allowHtml of [true, false]) {
            const table = markdownTable(["Valeurs"], [[data]], { ...DEFAULT_SETTINGS, allowHtml });
            expect(table).toContain("Oui");
            expect(table).toContain("Non");
        }
        expect(markdownList([true, false])).toBe("- Oui\n- Non\n");
        // Query evaluation and string conversion retain the original semantics.
        expect(Values.toString(true)).toBe("true");
        expect(Values.isTruthy(false)).toBe(false);
    });
});
