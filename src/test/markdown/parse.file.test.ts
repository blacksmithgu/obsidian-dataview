import { extractTags } from "data-import/markdown-file";
import { FrontMatterCache } from "obsidian";

describe("Frontmatter Tags", () => {
    test("Empty", () => expect(extractTags({} as FrontMatterCache)).toEqual([]));
    test("No Tags", () => expect(extractTags({ a: 1, b: 2 } as any as FrontMatterCache)).toEqual([]));
    test("One Tag", () => expect(extractTags({ tag: "hello" } as any as FrontMatterCache)).toEqual(["#hello"]));
    test("Two Tag", () =>
        expect(extractTags({ tag: ["hello", "goodbye"] } as any as FrontMatterCache)).toEqual(["#hello", "#goodbye"]));
    test("Two Tag String", () =>
        expect(extractTags({ tag: "hello goodbye" } as any as FrontMatterCache)).toEqual(["#hello", "#goodbye"]));
    test("Two Tag String Comma", () =>
        expect(extractTags({ tag: "hello, goodbye" } as any as FrontMatterCache)).toEqual(["#hello", "#goodbye"]));
});
