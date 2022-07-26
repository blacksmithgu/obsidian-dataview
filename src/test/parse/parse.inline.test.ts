import { EXPRESSION } from "expression/parse";
import { Link } from "data-model/value";
import { extractInlineFields, setInlineField } from "data-import/inline-field";

// <-- Inline field wierd edge cases -->

test("Parse commas inside inline field", () => {
    expect(EXPRESSION.inlineField.tryParse("[[yes, no, and maybe]]")).toEqual(Link.file("yes, no, and maybe"));
});

// <-- Inline Field Lists -->

describe("Inline Field Values", () => {
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

    test("Large Leading Whitespace", () => {
        let result = extractInlineFields("      - [ ] Huh! [p:: 1]");
        expect(result[0].key).toEqual("p");
        expect(result[0].value).toEqual("1");
    });
});

describe("Inline Inline With HTML", () => {
    test("Link", () => {
        let result = extractInlineFields(`[link:: <a href="Page">Value</a>]`);
        expect(result[0].key).toEqual("link");
        expect(result[0].value).toEqual(`<a href="Page">Value</a>`);
    });
});

describe("Inline task emoji shorthands", () => {
    test("Created emoji shorthand", () => {
        let result = extractInlineFields(" - [ ] testTask \u{2795}2022-07-25", true);
        expect(result[0].key).toEqual("created");
        expect(result[0].value).toEqual("2022-07-25");
    });

    test("Start date emoji shorthand", () => {
        let result = extractInlineFields(" - [ ] testTask 🛫2022-07-21", true);
        expect(result[0].key).toEqual("start");
        expect(result[0].value).toEqual("2022-07-21");
    });

    test("Scheduled date emoji shorthand", () => {
        let result = extractInlineFields(" - [ ] testTask ⏳2022-07-24", true);
        expect(result[0].key).toEqual("scheduled");
        expect(result[0].value).toEqual("2022-07-24");
    });
});

describe("Set Inline", () => {
    test("Add Annotation", () => {
        let input = "- [ ] an uncompleted task";
        let result = setInlineField(input, "completion");
        expect(result).toEqual(input);

        result = setInlineField(input, "completion", "2021-02-21");
        expect(result).toEqual(input + " [completion:: 2021-02-21]");
    });

    test("Replace Annotation", () => {
        let input = "- [x] a completed task [completion:: 2021-02-21] foo bar";
        let result = setInlineField(input, "completion");
        expect(result).toEqual("- [x] a completed task foo bar");

        result = setInlineField(input, "completion", "2021-02-22");
        expect(result).toEqual("- [x] a completed task [completion:: 2021-02-22] foo bar");
    });
});
