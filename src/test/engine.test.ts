import { getFileName } from "src/engine";

test("Get file name", () => {
    expect(getFileName("Test.md")).toEqual("Test");
    expect(getFileName("what/Omega000.md")).toEqual("Omega000");
});