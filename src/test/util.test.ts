import { getFileName, getParentFolder } from "src/util/normalize"

test("Test empty getFileName()", () => {
    expect(getFileName("")).toEqual("");
});

test("Test root getFileName()", () => {
    expect(getFileName("yes.md")).toEqual("yes");
    expect(getFileName("yes")).toEqual("yes");
});

test("Test folder getFileName()", () => {
    expect(getFileName("ok/yes.md")).toEqual("yes");
    expect(getFileName("/yes")).toEqual("yes");
});

test("Test empty getParentFolder", () => {
    expect(getParentFolder("")).toEqual("");
});

test("Test root getParentFolder", () => {
    expect(getParentFolder("yes")).toEqual("");
    expect(getParentFolder("maybe")).toEqual("");
});

test("Test folder getParentFolder()", () => {
    expect(getParentFolder("ok/yes")).toEqual("ok");
    expect(getParentFolder("no/maybe")).toEqual("no");
    expect(getParentFolder("/maybe")).toEqual("");
})