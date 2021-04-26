import { EXPRESSION } from "src/parse";
import { Fields } from "src/query";

// <-- Inline field wierd edge cases -->

test("Parse commas inside inline field", () => {
    expect(EXPRESSION.inlineField.tryParse("[[yes, no, and maybe]]")).toEqual(Fields.fileLink("yes, no, and maybe"));
})

// <-- Inline Field Lists -->

test("Parse basic inline fields", () => {
    expect(EXPRESSION.inlineField.tryParse("14")).toEqual(Fields.number(14));
    expect(EXPRESSION.inlineField.tryParse("\"yes,\"")).toEqual(Fields.string("yes,"));
    expect(EXPRESSION.inlineField.tryParse("[[test]]")).toEqual(Fields.fileLink("test"));
});

test("Parse inline field lists", () => {
    expect(EXPRESSION.inlineField.tryParse("[[test]],")).toEqual(Fields.array([Fields.fileLink("test")]));
    expect(EXPRESSION.inlineField.tryParse("[[test]], [[test2]]")).toEqual(Fields.array([Fields.fileLink("test"), Fields.fileLink("test2")]));
    expect(EXPRESSION.inlineField.tryParse("1, 2, 3, \"hello\"")).toEqual(Fields.array([
        Fields.number(1), Fields.number(2), Fields.number(3), Fields.string("hello")
    ]));
});