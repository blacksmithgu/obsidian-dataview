/** Various tests for evaluating fields in context. */

import { EXPRESSION } from "../parse";
import { Context } from "../eval";
import { LiteralField, Fields } from "../query";

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
});

test("Evaluate simple string operations", () => {
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.string("a"), '+', Fields.string("b"))))
        .toEqual(Fields.string("ab"));
});

test("Evaluate string comparisons", () => {
    expect(simpleContext().evaluate(Fields.binaryOp(Fields.string("abc"), '<', Fields.string("abd"))))
        .toEqual(Fields.bool(true));
});

// <-- Field resolution -->

// <-- Functions -->


/** Parse a field expression and evaluate it in the simple context. */
function parseEval(text: string): LiteralField {
    let field = EXPRESSION.field.tryParse(text);
    return simpleContext().evaluate(field) as LiteralField;
}

/** Create a trivial context good for evaluations that do not depend on links. */
function simpleContext(): Context {
    return new Context(() => Fields.NULL);
}