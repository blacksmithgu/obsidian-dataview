import { canonicalizeVarName, normalizeHeaderForLink } from "util/normalize";

describe("Header Normalization", () => {
    test("Link", () => expect(normalizeHeaderForLink("Header  [[Outer Wilds]]  ")).toEqual("Header Outer Wilds"));
    test("Dash", () => expect(normalizeHeaderForLink("Header - More")).toEqual("Header - More"));
    test("Underscore", () => expect(normalizeHeaderForLink("Header _ More _")).toEqual("Header _ More _"));
    test("Link with Display", () =>
        expect(normalizeHeaderForLink("Header  [[Outer Wilds|Thing]]  ")).toEqual("Header Outer Wilds Thing"));
    test("Markup", () => expect(normalizeHeaderForLink("**Header** *Value")).toEqual("Header Value"));
    test("Emoji", () =>
        expect(normalizeHeaderForLink("Header   📷 [[Outer Wilds]]  ")).toEqual("Header 📷 Outer Wilds"));
});

describe("Variable Canonicalization", () => {
    test("Idempotent", () => expect(canonicalizeVarName("test")).toEqual("test"));
    test("Idempotent 2", () => expect(canonicalizeVarName("property")).toEqual("property"));
    test("Space", () => expect(canonicalizeVarName("test thing")).toEqual("test-thing"));
    test("Multiple Space", () => expect(canonicalizeVarName("This     is test")).toEqual("this-is-test"));
    test("Number", () => expect(canonicalizeVarName("test thing 3")).toEqual("test-thing-3"));
    test("Punctuation", () => expect(canonicalizeVarName("This is a Test.")).toEqual("this-is-a-test"));
    test("Dash", () => expect(canonicalizeVarName("Yes-sir")).toEqual("yes-sir"));
    test("Emoji", () => expect(canonicalizeVarName("📷")).toEqual("📷"));
    test("Статус", () => expect(canonicalizeVarName("Статус")).toEqual("статус"));
});
