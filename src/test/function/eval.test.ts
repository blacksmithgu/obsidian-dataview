/** Various tests for evaluating fields in context. */

import { EXPRESSION, resolveDateShorthands } from "expression/parse";
import { Context, LinkHandler } from "expression/context";
import { DateTime, Duration, Settings } from "luxon";
import { Fields } from "expression/field";
import { Literal, Link } from "data-model/value";
import { DEFAULT_QUERY_SETTINGS } from "settings";
import { executeCore, executeCoreExtract } from "query/engine";
import { parseQuery } from "query/parse";
import { TableQuery } from "query/query";

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

describe("Date shorthands", () => {
    afterEach(() => {
        Settings.now = () => Date.now();
    });

    test("Evaluate to the current date", () => {
        expect(parseEval("date(today)")).toEqual(DateTime.local().startOf("day"));
        expect(parseEval("date(tomorrow)")).toEqual(DateTime.local().startOf("day").plus({ days: 1 }));
        expect(parseEval("date(sow)")).toEqual(DateTime.local().startOf("week"));
        expect(parseEval("date(end-of-month)")).toEqual(DateTime.local().endOf("month"));
    });

    test("Arithmetic and comparisons", () => {
        expect(parseEval("date(today) - dur(1 day)")).toEqual(DateTime.local().startOf("day").minus({ days: 1 }));
        expect(parseEval("date(yesterday) < date(today)")).toEqual(true);
        expect(parseEval("date(today) <= date(now)")).toEqual(true);
        expect(parseEval("date(2000-01-01) < date(today)")).toEqual(true);
        expect(parseEval("date(today).year")).toEqual(DateTime.local().year);
    });

    test("Resolved when evaluated, not when parsed", () => {
        // Computed outside the `Settings.now` closures, since constructing a DateTime itself consults `Settings.now`.
        let march10 = DateTime.local(2024, 3, 10, 12).toMillis();
        let march14 = DateTime.local(2024, 3, 14, 12).toMillis();

        Settings.now = () => march10;
        let field = EXPRESSION.field.tryParse("date(today)");
        expect((simpleContext().tryEvaluate(field) as DateTime).toISODate()).toEqual("2024-03-10");

        // Move the clock forward four days and evaluate the same parsed field again.
        Settings.now = () => march14;
        expect((simpleContext().tryEvaluate(field) as DateTime).toISODate()).toEqual("2024-03-14");
    });

    test("resolveDateShorthands replaces shorthands with literals and leaves everything else alone", () => {
        let today = DateTime.local().startOf("day");
        expect(resolveDateShorthands(EXPRESSION.field.tryParse("date(today)"))).toEqual(Fields.literal(today));
        expect(resolveDateShorthands(EXPRESSION.field.tryParse('date("today")'))).toEqual(Fields.literal(today));

        // Nested inside operators, function arguments, indexing, negation, lists, objects and lambdas.
        expect(resolveDateShorthands(EXPRESSION.field.tryParse("start <= date(today)"))).toEqual(
            Fields.binaryOp(Fields.variable("start"), "<=", Fields.literal(today))
        );
        expect(resolveDateShorthands(EXPRESSION.field.tryParse('dateformat(date(today), "yyyy")'))).toEqual(
            Fields.func(Fields.variable("dateformat"), [Fields.literal(today), Fields.literal("yyyy")])
        );
        expect(resolveDateShorthands(EXPRESSION.field.tryParse("!(date(today).year)"))).toEqual(
            Fields.negate(Fields.index(Fields.literal(today), Fields.literal("year")))
        );
        expect(resolveDateShorthands(EXPRESSION.field.tryParse("[date(today)]"))).toEqual(
            Fields.list([Fields.literal(today)])
        );
        expect(resolveDateShorthands(EXPRESSION.field.tryParse("{ d: date(today) }"))).toEqual(
            Fields.object({ d: Fields.literal(today) })
        );
        expect(resolveDateShorthands(EXPRESSION.field.tryParse("(r) => r.start <= date(today)"))).toEqual(
            Fields.lambda(
                ["r"],
                Fields.binaryOp(
                    Fields.index(Fields.variable("r"), Fields.literal("start")),
                    "<=",
                    Fields.literal(today)
                )
            )
        );

        // Not shorthands: explicit dates, non-literal arguments, inherited object properties, other functions.
        for (let text of ["date(2021-01-14)", "date(x)", 'date("constructor")', 'date(today, "yyyy")', "dur(1 day)"]) {
            let field = EXPRESSION.field.tryParse(text);
            expect(resolveDateShorthands(field)).toEqual(field);
        }
    });

    test("Query execution resolves shorthands once per execution, at execution time", () => {
        let march10 = DateTime.local(2024, 3, 10, 12).toMillis();
        let march14 = DateTime.local(2024, 3, 14, 12).toMillis();
        let rows = [
            { id: "a", data: { start: DateTime.local(2024, 3, 8) } },
            { id: "b", data: { start: DateTime.local(2024, 3, 12) } },
        ];
        let query = parseQuery("TASK WHERE start <= date(today)").orElseThrow();
        let ids = () =>
            executeCore(rows, simpleContext(), query.operations)
                .orElseThrow()
                .data.map(r => r.id);

        Settings.now = () => march10;
        expect(ids()).toEqual(["a"]);

        // Same parsed query, clock moved forward: the shorthand is re-resolved on the next execution.
        Settings.now = () => march14;
        expect(ids()).toEqual(["a", "b"]);

        // Within one execution every row sees the same instant, even for `now` under a ticking clock.
        let ticking = march10;
        Settings.now = () => ticking++;
        let nowQuery = parseQuery("TABLE date(now) AS n").orElseThrow();
        let fields = { n: (nowQuery.header as TableQuery).fields[0].field };
        let extracted = executeCoreExtract(rows, simpleContext(), nowQuery.operations, fields).orElseThrow();
        expect(extracted.data.length).toEqual(2);
        expect(extracted.data[0].data.n).toEqual(extracted.data[1].data.n);
    });
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
