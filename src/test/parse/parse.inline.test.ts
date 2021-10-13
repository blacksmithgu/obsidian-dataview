import { EXPRESSION } from "expression/parse";
import { Link } from "data/value";
import { extractInlineFields } from "data/parse/inline-field";

// <-- Inline field wierd edge cases -->

test("Parse commas inside inline field", () => {
    expect(EXPRESSION.inlineField.tryParse("[[yes, no, and maybe]]")).toEqual(Link.file("yes, no, and maybe"));
});

// <-- Inline Field Lists -->

test("Parse basic inline fields", () => {
    expect(EXPRESSION.inlineField.tryParse("14")).toEqual(14);
    expect(EXPRESSION.inlineField.tryParse('"yes,"')).toEqual("yes,");
    expect(EXPRESSION.inlineField.tryParse("[[test]]")).toEqual(Link.file("test"));
});

test("Parse inline field lists", () => {
    expect(EXPRESSION.inlineField.tryParse("[[test]],")).toEqual([Link.file("test")]);
    expect(EXPRESSION.inlineField.tryParse("[[test]], [[test2]]")).toEqual([Link.file("test"), Link.file("test2")]);
    expect(EXPRESSION.inlineField.tryParse('1, 2, 3, "hello"')).toEqual([1, 2, 3, "hello"]);
});

test("Parse inline booleans", () => {
    expect(EXPRESSION.inlineField.tryParse("true")).toEqual(true);
    expect(EXPRESSION.inlineField.tryParse("False")).toEqual(false);
});

// "Inline Inline" Fields

describe("Simple Inline Inline", () => {
    test("Empty", () => expect(extractInlineFields("")).toEqual([]));
    test("Empty Brackets", () => expect(extractInlineFields("[]")).toEqual([]));
    test("Empty Parenthesis", () => expect(extractInlineFields("()")).toEqual([]));

    test("Incorrect Brackets", () => expect(extractInlineFields("[key:value]")).toEqual([]));
    test("Incorrect Parenthesis", () => expect(extractInlineFields("(key:value)")).toEqual([]));

    test("Trivial Brackets", () =>
        expect(extractInlineFields("[key::value]")).toEqual([
            {
                key: "key",
                value: "value",
                start: 0,
                startValue: 6,
                end: 12,
                wrapping: "[",
            },
        ]));

    test("Trivial Parenthesis", () =>
        expect(extractInlineFields("(key::value)")).toEqual([
            {
                key: "key",
                value: "value",
                start: 0,
                startValue: 6,
                end: 12,
                wrapping: "(",
            },
        ]));

    test("Two Inline Fields", () => {
        let fields = extractInlineFields("[key:: value] and so thus, [key2:: value2]");
        expect(fields[0]).toEqual({
            key: "key",
            value: "value",
            start: 0,
            startValue: 6,
            end: 13,
            wrapping: "[",
        });

        expect(fields[1]).toEqual({
            key: "key2",
            value: "value2",
            start: 27,
            startValue: 34,
            end: 42,
            wrapping: "[",
        });
    });
});

describe("Inline Inline Edge Cases", () => {
    test("Nested Brackets", () => {
        let result = extractInlineFields("[[[[hello:: 16]]");
        expect(result[0].key).toEqual("hello");
        expect(result[0].value).toEqual("16");
    });

    test("Brackets In Value", () => {
        let result = extractInlineFields("This is some text. [key:: [value]]");
        expect(result[0].key).toEqual("key");
        expect(result[0].value).toEqual("[value]");
    });

    test("Escaped Brackets", () => {
        let result = extractInlineFields("Hello? [key! :: \\[value]");
        expect(result[0].key).toEqual("key!");
        expect(result[0].value).toEqual("\\[value");
    });
});

describe("Inline Inline With HTML", () => {
    test("Link", () => {
        let result = extractInlineFields(`[link:: <a href="Page">Value</a>]`);
        expect(result[0].key).toEqual("link");
        expect(result[0].value).toEqual(`<a href="Page">Value</a>`);
    });
});
