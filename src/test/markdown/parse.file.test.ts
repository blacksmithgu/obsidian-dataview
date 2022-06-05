import { extractTags } from "data-import/markdown-file";
import * as common from "data-import/common";
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

describe("Task Tags", () => {
    test("Empty", () => expect(common.extractTags("hello")).toEqual(new Set([])));
    test("One Tag", () => expect(common.extractTags("and text #hello")).toEqual(new Set(["#hello"])));
    test("Two Tags", () =>
        expect(common.extractTags("#and/thing text #hello")).toEqual(new Set(["#and/thing", "#hello"])));
    test("Comma Delimited", () =>
        expect(common.extractTags("#one,#two, #three")).toEqual(new Set(["#one", "#two", "#three"])));
    test("Semicolon Delimited", () =>
        expect(common.extractTags("#one;;;#two; #three")).toEqual(new Set(["#one", "#two", "#three"])));
    test("Parenthesis", () =>
        expect(common.extractTags("[#one]]#two;;#four()() #three")).toEqual(
            new Set(["#one", "#two", "#four", "#three"])
        ));
});
