/** Various tests for evaluating fields in context. */

import { EXPRESSION } from "expression/parse";
import { Context, LinkHandler } from "expression/context";
import { Duration } from "luxon";
import { Fields } from "expression/field";
import { Literal, Link } from "data-model/value";
import { DEFAULT_QUERY_SETTINGS } from "settings";

// <-- Numeric Operations -->

test("Evaluate simple numeric operations", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(2), "+", Fields.literal(4)))).toEqual(6);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(2), "-", Fields.literal(4)))).toEqual(-2);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(2), "*", Fields.literal(4)))).toEqual(8);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(8), "/", Fields.literal(4)))).toEqual(2);
});

test("Evaluate numeric comparisons", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(8), "<", Fields.literal(4)))).toEqual(false);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(-2), "=", Fields.literal(-2)))).toEqual(true);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(-2), ">=", Fields.literal(-8)))).toEqual(true);
});

test("Evaluate complex numeric operations", () => {
    expect(parseEval("12 + 8 - 4 / 2")).toEqual(18);
    expect(parseEval("16 / 8 / 2")).toEqual(1);
    expect(parseEval("39 / 3 <= 14")).toEqual(true);
});

// <-- String Operations -->

test("Evaluate simple string operations", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("a"), "+", Fields.literal("b")))).toEqual("ab");
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("a"), "+", Fields.literal(12)))).toEqual("a12");
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("a"), "*", Fields.literal(6)))).toEqual("aaaaaa");
});

test("Evaluate string comparisons", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("abc"), "<", Fields.literal("abd")))).toEqual(
        true
    );
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("xyz"), "=", Fields.literal("xyz")))).toEqual(
        true
    );
});

// <-- Date Operations -->

test("Evaluate date comparisons", () => {
    expect(parseEval("date(2021-01-14) = date(2021-01-14)")).toEqual(true);
    expect(parseEval("contains(list(date(2020-01-01)), date(2020-01-01))")).toEqual(true);
});

test("Evaluate date subtraction", () => {
    let duration = parseEval("date(2021-05-04) - date(1997-05-17)") as Duration;
    expect(duration.years).toEqual(23);
});

// <-- Field resolution -->

test("Evaluate simple field resolution", () => {
    let context = simpleContext().set("a", 18).set("b", "hello");
    expect(context.get("a")).toEqual(18);
    expect(context.get("b")).toEqual("hello");
    expect(context.get("c")).toEqual(null);
});

test("Evaluate simple object resolution", () => {
    let object = { inner: { final: 6 } };
    let context = simpleContext().set("obj", object);

    expect(context.tryEvaluate(Fields.indexVariable("obj.inner"))).toEqual(object.inner);
    expect(context.tryEvaluate(Fields.indexVariable("obj.inner.final"))).toEqual(object.inner.final);
});

test("Evaluate simple link resolution", () => {
    let object = { inner: { final: 6 } };
    let context = new Context(
        { resolve: path => object, normalize: path => path, exists: path => false },
        DEFAULT_QUERY_SETTINGS
    ).set("link", Link.file("test", false));
    expect(context.tryEvaluate(Fields.indexVariable("link.inner"))).toEqual(object.inner);
    expect(context.tryEvaluate(Fields.indexVariable("link.inner.final"))).toEqual(object.inner.final);
});

describe("Immediately Invoked Lambdas", () => {
    test("Addition", () => expect(parseEval("((a, b) => a + b)(1, 2)")).toEqual(3));
    test("Negation", () => expect(parseEval("((v) => 0-v)(6)")).toEqual(-6));
    test("Curried", () => expect(parseEval("((a) => (b) => a + b)(1)(2)")).toEqual(3));
    test("In Argument", () => expect(parseEval("((a) => 1 + a)(((a) => 2)(3))")).toEqual(3));
});

describe("Immediately Indexed Objects", () => {
    test("Empty", () => expect(parseEval('{ a: 1, b: 2 }["c"]')).toEqual(null));
    test("Single", () => expect(parseEval('{ a: 1, b: 2 }["a"]')).toEqual(1));
    test("Nested", () => expect(parseEval('{ a: 1, b: { c: 4 } }["b"]["c"]')).toEqual(4));
});

/** Parse a field expression and evaluate it in the simple context. */
function parseEval(text: string): Literal {
    let field = EXPRESSION.field.tryParse(text);
    return simpleContext().tryEvaluate(field);
}

/** Create a trivial link handler which never resolves links. */
function simpleLinkHandler(): LinkHandler {
    return {
        resolve: path => null,
        normalize: path => path,
        exists: path => true,
    };
}

/** Create a trivial context good for evaluations that do not depend on links. */
function simpleContext(): Context {
    return new Context(simpleLinkHandler(), DEFAULT_QUERY_SETTINGS);
}
