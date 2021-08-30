import { getFileTitle, getParentFolder, canonicalizeVarName } from "util/normalize";

describe("getFileTitle()", () => {
    test("empty", () => expect(getFileTitle("")).toEqual(""));

    test("root getFileTitle()", () => {
        expect(getFileTitle("yes.md")).toEqual("yes");
        expect(getFileTitle("yes")).toEqual("yes");
    });

    test("folder getFielTitle()", () => {
        expect(getFileTitle("ok/yes.md")).toEqual("yes");
        expect(getFileTitle("/yes")).toEqual("yes");
    });
});

test("empty getParentFolder()", () => {
    expect(getParentFolder("")).toEqual("");
});

test("root getParentFolder()", () => {
    expect(getParentFolder("yes")).toEqual("");
    expect(getParentFolder("maybe")).toEqual("");
});

test("folder getParentFolder()", () => {
    expect(getParentFolder("ok/yes")).toEqual("ok");
    expect(getParentFolder("no/maybe")).toEqual("no");
    expect(getParentFolder("/maybe")).toEqual("");
});

test("nested folder getParentFolder()", () => {
    expect(getParentFolder("a/b/c.md")).toEqual("a/b");
    expect(getParentFolder("hello/yes/no/maybe.md")).toEqual("hello/yes/no");
    expect(getParentFolder("hello/yes/no/")).toEqual("hello/yes/no");
});

test("simple canonicalizeVarName()", () => {
    expect(canonicalizeVarName("test")).toEqual("test");
    expect(canonicalizeVarName("test thing")).toEqual("test-thing");
    expect(canonicalizeVarName("test thing 3")).toEqual("test-thing-3");
    expect(canonicalizeVarName("This is a Test.")).toEqual("this-is-a-test");
    expect(canonicalizeVarName("property")).toEqual("property");
    expect(canonicalizeVarName("This     is test")).toEqual("this-is-test");
});
