/** Various tests for evaluating fields in context. */

import { EXPRESSION } from "src/parse";
import { Context } from "src/eval";
import { LiteralField, Fields } from "src/query";

// <-- Simple Operations -->

test("Evaluate simple numeric operations", () => {
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.number(2), '+', Fields.number(4))))
        .toEqual(Fields.number(6));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.number(2), '-', Fields.number(4))))
        .toEqual(Fields.number(-2));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.number(2), '*', Fields.number(4))))
        .toEqual(Fields.number(8));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.number(8), '/', Fields.number(4))))
        .toEqual(Fields.number(2));
});

test("Evaluate numeric comparisons", () => {
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.number(8), '<', Fields.number(4))))
        .toEqual(Fields.bool(false));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.number(-2), '=', Fields.number(-2))))
        .toEqual(Fields.bool(true));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.number(-2), '>=', Fields.number(-8))))
        .toEqual(Fields.bool(true));
});

test("Evaluate complex numeric operations", () => {
    expect(parseEval("12 + 8 - 4 / 2")).toEqual(Fields.number(18));
    expect(parseEval("16 / 8 / 2")).toEqual(Fields.number(1));
    expect(parseEval("39 / 3 <= 14")).toEqual(Fields.bool(true));
});

test("Evaluate simple string operations", () => {
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.string("a"), '+', Fields.string("b"))))
        .toEqual(Fields.string("ab"));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.string("a"), '+', Fields.number(12))))
        .toEqual(Fields.string("a12"));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.string("a"), '*', Fields.number(6))))
        .toEqual(Fields.string("aaaaaa"));
});

test("Evaluate string comparisons", () => {
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.string("abc"), '<', Fields.string("abd"))))
        .toEqual(Fields.bool(true));
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.string("xyz"), '=', Fields.string("xyz"))))
        .toEqual(Fields.bool(true));
});

// <-- Field resolution -->

test("Evaluate simple field resolution", () => {
    let context = simpleContext().set("a", Fields.number(18)).set("b", Fields.string("hello"));
    expect(context.get("a")).toEqual(Fields.number(18));
    expect(context.get("b")).toEqual(Fields.string("hello"));
    expect(context.get("c")).toEqual(Fields.NULL);
});

test("Evaluate simple object resolution", () => {
    let rawRawObject = new Map<string, LiteralField>()
        .set("final", Fields.number(6));

    let rawObject = new Map<string, LiteralField>()
        .set("inner", Fields.object(rawRawObject));

    let context = simpleContext().set("obj", Fields.object(rawObject));

    expect(context.get("obj").valueType).toEqual("object");
    expect(context.evaluate(Fields.indexVariable("obj.inner"))).toEqual(Fields.object(rawRawObject));
    expect(context.evaluate(Fields.indexVariable("obj.inner.final"))).toEqual(Fields.number(6));
});

test("Evaluate simple link resolution", () => {
    let rawRawObject = new Map<string, LiteralField>()
        .set("final", Fields.number(6));

    let rawObject = new Map<string, LiteralField>()
        .set("inner", Fields.object(rawRawObject));

    let context = new Context(_ => Fields.object(rawObject)).set("link", Fields.link("test"));
    expect(context.get("link").valueType).toEqual("link");
    expect(context.evaluate(Fields.indexVariable("link.inner"))).toEqual(Fields.object(rawRawObject));
    expect(context.evaluate(Fields.indexVariable("link.inner.final"))).toEqual(Fields.number(6));
});

// <-- Functions -->
// <-- Length -->

test("Evaluate length(array)", () => {
    let array = Fields.array([Fields.number(1), Fields.number(2)]);

    expect(simpleContext().evaluate(Fields.func(Fields.variable("length"), [array]))).toEqual(Fields.number(2));
});

test("Evaluate length(object)", () => {
    let obj = Fields.object(new Map().set("a", Fields.number(1)));
    expect(simpleContext().evaluate(Fields.func(Fields.variable("length"), [obj]))).toEqual(Fields.number(1));
});

test("Evaluate length(string)", () => {
    expect(simpleContext().evaluate(Fields.func(Fields.variable("length"), [Fields.string("hello")]))).toEqual(Fields.number(5));
});

// <-- list() -->

test("Evaluate list()", () => {
    expect(parseEval("list(1, 2, 3)")).toEqual(Fields.array([Fields.number(1), Fields.number(2), Fields.number(3)]));
});

// <-- object() -->

test("Evaluate object()", () => {
    expect(parseEval("object()")).toEqual(Fields.object(new Map<string, LiteralField>()));
    expect(parseEval("object(\"hello\", 1)")).toEqual(Fields.object(new Map<string, LiteralField>().set("hello", Fields.number(1))));
});

// <-- contains() -->

test("Evaluate contains(object)", () => {
    expect(parseEval("contains(object(\"hello\", 1), \"hello\")")).toEqual(Fields.bool(true));
    expect(parseEval("contains(object(\"hello\", 1), \"no\")")).toEqual(Fields.bool(false));
});

test("Evaluate contains(array)", () => {
    expect(parseEval("contains(list(\"hello\", 1), \"hello\")")).toEqual(Fields.bool(true));
    expect(parseEval("contains(list(\"hello\", 1), 6)")).toEqual(Fields.bool(false));
});

test("Evaluate contains(string)", () => {
    expect(parseEval("contains(\"hello\", \"hello\")")).toEqual(Fields.bool(true));
    expect(parseEval("contains(\"meep\", \"me\")")).toEqual(Fields.bool(true));
    expect(parseEval("contains(\"hello\", \"xd\")")).toEqual(Fields.bool(false));
});

// <-- reverse() -->

test("Evaluate reverse(list)", () => {
    expect(parseEval("reverse(list(1, 2, 3))")).toEqual(parseEval("list(3, 2, 1)"));
    expect(parseEval('reverse(list("a", "b", "c"))')).toEqual(parseEval('list("c", "b", "a")'));
});

// <-- sort() -->

test("Evaluate sort(list)", () => {
    expect(parseEval("sort(list(2, 3, 1))")).toEqual(parseEval("list(1, 2, 3)"));
    expect(parseEval('sort(list("a", "c", "b"))')).toEqual(parseEval('list("a", "b", "c")'));
});

// <-- regexmatch() -->

test("Evaluate regexmatch()", () => {
    expect(parseEval('regexmatch(".+", "stuff")')).toEqual(Fields.bool(true));
    expect(parseEval('regexmatch(".+", "")')).toEqual(Fields.bool(false));
    expect(parseEval('regexmatch(".*", "")')).toEqual(Fields.bool(true));
    expect(parseEval('regexmatch("\\w+", "m3me")')).toEqual(Fields.bool(true));
    expect(parseEval('regexmatch("\\s+", "  ")')).toEqual(Fields.bool(true));
    expect(parseEval('regexmatch("what", "what")')).toEqual(Fields.bool(true));
});

/** Parse a field expression and evaluate it in the simple context. */
function parseEval(text: string): LiteralField {
    let field = EXPRESSION.field.tryParse(text);
    return simpleContext().evaluate(field) as LiteralField;
}

/** Create a trivial context good for evaluations that do not depend on links. */
function simpleContext(): Context {
    return new Context(() => Fields.NULL);
}