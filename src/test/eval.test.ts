/** Various tests for evaluating fields in context. */

import { EXPRESSION } from "src/expression/parse";
import { Context, LinkHandler } from "src/expression/context";
import { DateTime, Duration } from "luxon";
import { Fields } from "src/expression/field";
import { Link, LiteralValue } from "src/data/value";
import { DefaultFunctions } from "src/expression/functions";

// <-- Numeric Operations -->

test("Evaluate simple numeric operations", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(2), '+', Fields.literal(4))))
        .toEqual(6);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(2), '-', Fields.literal(4))))
        .toEqual(-2);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(2), '*', Fields.literal(4))))
        .toEqual(8);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(8), '/', Fields.literal(4))))
        .toEqual(2);
});

test("Evaluate numeric comparisons", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(8), '<', Fields.literal(4))))
        .toEqual(false);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(-2), '=', Fields.literal(-2))))
        .toEqual(true);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal(-2), '>=', Fields.literal(-8))))
        .toEqual(true);
});

test("Evaluate complex numeric operations", () => {
    expect(parseEval("12 + 8 - 4 / 2")).toEqual(18);
    expect(parseEval("16 / 8 / 2")).toEqual(1);
    expect(parseEval("39 / 3 <= 14")).toEqual(true);
});

// <-- String Operations -->

test("Evaluate simple string operations", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("a"), '+', Fields.literal("b"))))
        .toEqual("ab");
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("a"), '+', Fields.literal(12))))
        .toEqual("a12");
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("a"), '*', Fields.literal(6))))
        .toEqual("aaaaaa");
});

test("Evaluate string comparisons", () => {
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("abc"), '<', Fields.literal("abd"))))
        .toEqual(true);
    expect(simpleContext().tryEvaluate(Fields.binaryOp(Fields.literal("xyz"), '=', Fields.literal("xyz"))))
        .toEqual(true);
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
    let object = { "inner": { final: 6 } };
    let context = simpleContext().set("obj", object);

    expect(context.tryEvaluate(Fields.indexVariable("obj.inner"))).toEqual(object.inner);
    expect(context.tryEvaluate(Fields.indexVariable("obj.inner.final"))).toEqual(object.inner.final);
});

test("Evaluate simple link resolution", () => {
    let object = { "inner": { final: 6 }};
    let context = new Context({ resolve: path => object, normalize: path => path, exists: path => false })
        .set("link", Link.file("test", false));
    expect(context.tryEvaluate(Fields.indexVariable("link.inner"))).toEqual(object.inner);
    expect(context.tryEvaluate(Fields.indexVariable("link.inner.final"))).toEqual(object.inner.final);
});

// <-- Functions -->
// <-- Function vectorization -->

test("Evaluate lower(list)", () => {
    expect(parseEval("lower(list(\"A\", \"B\"))")).toEqual(["a", "b"]);
})

test("Evaluate replace(list, string, string)", () => {
    expect(parseEval("replace(list(\"yes\", \"re\"), \"e\", \"a\")")).toEqual(["yas", "ra"]);
})

// <-- Length -->

test("Evaluate length(array)", () => {
    expect(DefaultFunctions.length(simpleContext(), [1, 2])).toEqual(2);
    expect(DefaultFunctions.length(simpleContext(), [])).toEqual(0);
});

test("Evaluate length(string)", () => {
    expect(DefaultFunctions.length(simpleContext(), "hello")).toEqual(5);
    expect(DefaultFunctions.length(simpleContext(), "no")).toEqual(2);
    expect(DefaultFunctions.length(simpleContext(), "")).toEqual(0);
});

// <-- list() -->

test("Evaluate list()", () => {
    expect(DefaultFunctions.list(simpleContext(), 1, 2, 3)).toEqual([1, 2, 3]);
    expect(DefaultFunctions.list(simpleContext())).toEqual([]);
});

// <-- object() -->

test("Evaluate object()", () => {
    expect(parseEval("object()")).toEqual({});
    expect(parseEval("object(\"hello\", 1)")).toEqual({ "hello": 1 });
});

// <-- contains() -->

test("Evaluate contains(object)", () => {
    expect(parseEval("contains(object(\"hello\", 1), \"hello\")")).toEqual(true);
    expect(parseEval("contains(object(\"hello\", 1), \"no\")")).toEqual(false);
});

test("Evaluate contains(array)", () => {
    expect(parseEval("contains(list(\"hello\", 1), \"hello\")")).toEqual(true);
    expect(parseEval("contains(list(\"hello\", 1), 6)")).toEqual(false);
});

test("Evaluate fuzzy contains(array)", () => {
    expect(parseEval(`contains(list("hello"), "he")`)).toEqual(true);
    expect(parseEval(`contains(list("hello"), "no")`)).toEqual(false);
});

test("Evaluate contains(string)", () => {
    expect(parseEval("contains(\"hello\", \"hello\")")).toEqual(true);
    expect(parseEval("contains(\"meep\", \"me\")")).toEqual(true);
    expect(parseEval("contains(\"hello\", \"xd\")")).toEqual(false);
});

test("Evaluate non-fuzzy econtains(array)", () => {
    expect(parseEval(`econtains(list("hello"), "he")`)).toEqual(false);
    expect(parseEval(`econtains(list("hello"), "hello")`)).toEqual(true);
    expect(parseEval(`econtains(list("hello", 19), 1)`)).toEqual(false);
    expect(parseEval(`econtains(list("hello", 19), 19)`)).toEqual(true);
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

// <-- sum() -->
test("Evaluate sum(list)", () => {
    expect(parseEval("sum(list(2, 3, 1))")).toEqual(6);
    expect(parseEval("sum(list(\"a\", \"b\", \"c\"))")).toEqual("abc");
    expect(parseEval("sum(list())")).toEqual(null);
});

// <-- regexmatch() -->

test("Evaluate regexmatch()", () => {
    expect(parseEval('regexmatch(".+", "stuff")')).toEqual(true);
    expect(parseEval('regexmatch(".+", "")')).toEqual(false);
    expect(parseEval('regexmatch(".*", "")')).toEqual(true);
    expect(parseEval('regexmatch("\\w+", "m3me")')).toEqual(true);
    expect(parseEval('regexmatch("\\s+", "  ")')).toEqual(true);
    expect(parseEval('regexmatch("what", "what")')).toEqual(true);
});

// <-- replace() -- >

test("Evaluate replace()", () => {
    expect(parseEval("replace(\"hello\", \"h\", \"me\")")).toEqual("meello");
    expect(parseEval("replace(\"meep\", \"meep\", \"pleh\")")).toEqual("pleh");
});

// <-- lower/upper() -->

test("Evaluate lower()/upper()", () => {
    expect(parseEval("lower(\"Hello\")")).toEqual("hello");
    expect(parseEval("lower(\"hello\")")).toEqual("hello");
    expect(parseEval("upper(\"Hello\")")).toEqual("HELLO");
    expect(parseEval("upper(\"hello\")")).toEqual("HELLO");
})

// <-- default() -->

test("Evaluate default()", () => {
    expect(parseEval("default(null, 1)")).toEqual(1);
    expect(parseEval("default(2, 1)")).toEqual(2);
    expect(parseEval("default(list(1, null, null), 2)")).toEqual([1, 2, 2]);
});

test("Evaluate ldefault()", () => {
    expect(parseEval("ldefault(null, 1)")).toEqual(1);
    expect(parseEval("ldefault(2, 1)")).toEqual(2);
});

// <-- choice() -->

test("Evaluate choose()", () => {
    expect(parseEval("choice(true, 1, 2)")).toEqual(1);
    expect(parseEval("choice(false, 1, 2)")).toEqual(2);
})

// <-- any/all() -->

test("Evaluate any()", () => {
    expect(parseEval("any(true, false)")).toEqual(true);
    expect(parseEval("any(list(true, false))")).toEqual(true);
})

test("Evaluate all()", () => {
    expect(parseEval("all(true, false)")).toEqual(false);
    expect(parseEval("all(true, list(false))")).toEqual(true);
    expect(parseEval("all(list(true, false))")).toEqual(false);
    expect(parseEval("all(list(true, list(false)))")).toEqual(true);
})

test("Evaluate vectorized all()", () => {
    expect(parseEval("all(regexmatch(\"a+\", list(\"a\", \"aaaa\")))")).toEqual(true);
    expect(parseEval("all(regexmatch(\"a+\", list(\"a\", \"aaab\")))")).toEqual(false);
    expect(parseEval("any(regexmatch(\"a+\", list(\"a\", \"aaab\")))")).toEqual(true);
});

// <-- extract() -->

test("Evaluate 1 field extract()", () => {
    let res = parseEval("extract(object(\"mtime\", 1), \"mtime\")");
    expect(res).toEqual({ "mtime": 1 });
});

test("Evaluate 2 field extract()", () => {
    let res = parseEval("extract(object(\"mtime\", 1, \"yes\", \"hello\"), \"yes\", \"mtime\")");
    expect(res).toEqual({
        "yes": "hello",
        "mtime": 1
    });
});

// <-- number() -->

test("Evaluate number()", () => {
    expect(parseEval("number(\"hmm\")")).toEqual(null);
    expect(parseEval("number(34)")).toEqual(34);
    expect(parseEval("number(\"34\")")).toEqual(34);
    expect(parseEval("number(\"17 years\")")).toEqual(17);
    expect(parseEval("number(\"-19\")")).toEqual(-19);
});

// <-- date() -->

test("Evaluate date()", () => {
    expect(parseEval("date([[2020-04-18]])")).toEqual(DateTime.fromObject({ year: 2020, month: 4, day: 18 }));
    expect(parseEval("date([[Place|2021-04]])")).toEqual(DateTime.fromObject({ year: 2021, month: 4, day: 1 }));
});

// <-- regexreplace() -->

test("Evaluate regexreplace", () => {
    expect(parseEval('regexreplace("yes", ".+", "no")')).toEqual("no");
    expect(parseEval('regexreplace("yes", "y", "no")')).toEqual("noes");
    expect(parseEval('regexreplace("yes", "yes", "no")')).toEqual("no");
});

/** Parse a field expression and evaluate it in the simple context. */
function parseEval(text: string): LiteralValue {
    let field = EXPRESSION.field.tryParse(text);
    return simpleContext().tryEvaluate(field);
}

/** Create a trivial link handler which never resolves links. */
function simpleLinkHandler(): LinkHandler {
    return {
        resolve: path => null,
        normalize: path => path,
        exists: path => true
    }
}

/** Create a trivial context good for evaluations that do not depend on links. */
function simpleContext(): Context {
    return new Context(simpleLinkHandler());
}
