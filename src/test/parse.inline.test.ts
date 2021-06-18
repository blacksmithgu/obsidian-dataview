import { EXPRESSION } from "src/expression/parse";
import { Link } from "src/data/value";

// <-- Inline field wierd edge cases -->

test("Parse commas inside inline field", () => {
    expect(EXPRESSION.inlineField.tryParse("[[yes, no, and maybe]]")).toEqual(Link.file("yes, no, and maybe"));
})

// <-- Inline Field Lists -->

test("Parse basic inline fields", () => {
    expect(EXPRESSION.inlineField.tryParse("14")).toEqual(14);
    expect(EXPRESSION.inlineField.tryParse("\"yes,\"")).toEqual("yes,");
    expect(EXPRESSION.inlineField.tryParse("[[test]]")).toEqual(Link.file("test"));
});

test("Parse inline field lists", () => {
    expect(EXPRESSION.inlineField.tryParse("[[test]],")).toEqual([Link.file("test")]);
    expect(EXPRESSION.inlineField.tryParse("[[test]], [[test2]]")).toEqual([Link.file("test"), Link.file("test2")]);
    expect(EXPRESSION.inlineField.tryParse("1, 2, 3, \"hello\"")).toEqual([1, 2, 3, "hello"]);
});

test("Parse inline booleans", () => {
    expect(EXPRESSION.inlineField.tryParse("true")).toEqual(true);
    expect(EXPRESSION.inlineField.tryParse("False")).toEqual(false);
})
