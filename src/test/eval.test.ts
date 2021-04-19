/** Various tests for evaluating fields in context. */

import { EXPRESSION } from "src/parse";
import { Context, LinkHandler } from "src/eval";
import { LiteralField, Fields, LiteralFieldRepr } from "src/query";

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

test("Evaluate date comparisons", () => {
    expect(parseEval("date(2021-01-14) = date(2021-01-14)")).toEqual(Fields.bool(true));
    expect(parseEval("contains(list(date(2020-01-01)), date(2020-01-01))")).toEqual(Fields.bool(true));
})

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

    let context = new Context({ resolve: path => Fields.object(rawObject), normalize: path => path, exists: path => false })
        .set("link", Fields.link("test"));
    expect(context.get("link").valueType).toEqual("link");
    expect(context.evaluate(Fields.indexVariable("link.inner"))).toEqual(Fields.object(rawRawObject));
    expect(context.evaluate(Fields.indexVariable("link.inner.final"))).toEqual(Fields.number(6));
});

// <-- Functions -->
// <-- Function vectorization -->

test("Evaluate lower(list)", () => {
    expect(parseEval("lower(list(\"A\", \"B\"))")).toEqual(Fields.array([Fields.string("a"), Fields.string("b")]));
})

test("Evaluate replace(list, string, string)", () => {
    expect(parseEval("replace(list(\"yes\", \"re\"), \"e\", \"a\")")).toEqual(Fields.array([
        Fields.string("yas"), Fields.string("ra")
    ]));
})

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

// <-- sum() -->
test("Evaluate sum(list)", () => {
    expect(parseEval("sum(list(2, 3, 1))")).toEqual(Fields.number(6));
    expect(parseEval("sum(list(\"a\", \"b\", \"c\"))")).toEqual(Fields.string("abc"));
    expect(parseEval("sum(list())")).toEqual(Fields.NULL);
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

// <-- replace() -- >

test("Evaluate replace()", () => {
    expect(parseEval("replace(\"hello\", \"h\", \"me\")")).toEqual(Fields.string("meello"));
    expect(parseEval("replace(\"meep\", \"meep\", \"pleh\")")).toEqual(Fields.string("pleh"));
});

// <-- lower/upper() -->

test("Evaluate lower()/upper()", () => {
    expect(parseEval("lower(\"Hello\")")).toEqual(Fields.string("hello"));
    expect(parseEval("lower(\"hello\")")).toEqual(Fields.string("hello"));
    expect(parseEval("upper(\"Hello\")")).toEqual(Fields.string("HELLO"));
    expect(parseEval("upper(\"hello\")")).toEqual(Fields.string("HELLO"));
})

// <-- default() -->

test("Evaluate default()", () => {
    expect(parseEval("default(null, 1)")).toEqual(Fields.number(1));
    expect(parseEval("default(2, 1)")).toEqual(Fields.number(2));
    expect(parseEval("default(list(1, null, null), 2)")).toEqual(Fields.array([Fields.number(1), Fields.number(2), Fields.number(2)]));
});

test("Evaluate ldefault()", () => {
    expect(parseEval("ldefault(null, 1)")).toEqual(Fields.number(1));
    expect(parseEval("ldefault(2, 1)")).toEqual(Fields.number(2));
});

// <-- choice() -->

test("Evaluate choose()", () => {
    expect(parseEval("choice(true, 1, 2)")).toEqual(Fields.number(1));
    expect(parseEval("choice(false, 1, 2)")).toEqual(Fields.number(2));
})

// <-- any/all() -->

test("Evaluate any()", () => {
    expect(parseEval("any(true, false)")).toEqual(Fields.bool(true));
    expect(parseEval("any(list(true, false))")).toEqual(Fields.bool(true));
})

test("Evaluate all()", () => {
    expect(parseEval("all(true, false)")).toEqual(Fields.bool(false));
    expect(parseEval("all(true, list(false))")).toEqual(Fields.bool(true));
    expect(parseEval("all(list(true, false))")).toEqual(Fields.bool(false));
    expect(parseEval("all(list(true, list(false)))")).toEqual(Fields.bool(true));
})

test("Evaluate vectorized all()", () => {
    expect(parseEval("all(regexmatch(\"a+\", list(\"a\", \"aaaa\")))")).toEqual(Fields.bool(true));
    expect(parseEval("all(regexmatch(\"a+\", list(\"a\", \"aaab\")))")).toEqual(Fields.bool(false));
    expect(parseEval("any(regexmatch(\"a+\", list(\"a\", \"aaab\")))")).toEqual(Fields.bool(true));
});

// <-- extract() -->

test("Evaluate 1 field extract()", () => {
    let res = parseEval("extract(object(\"mtime\", 1), \"mtime\")");
    expect(res.valueType == "object");
    let map = (res as LiteralFieldRepr<'object'>).value;
    expect(map.size).toEqual(1);
    expect(map.get("mtime")).toEqual(Fields.number(1));
});

test("Evaluate 2 field extract()", () => {
    let res = parseEval("extract(object(\"mtime\", 1, \"yes\", \"hello\"), \"yes\", \"mtime\")");
    expect(res.valueType == "object");
    let map = (res as LiteralFieldRepr<'object'>).value;
    expect(map.size).toEqual(2);
    expect(map.get("mtime")).toEqual(Fields.number(1));
    expect(map.get("yes")).toEqual(Fields.string("hello"));
});

// <-- number() -->

test("Evaluate number()", () => {
    expect(parseEval("number(\"hmm\")")).toEqual(Fields.NULL);
    expect(parseEval("number(34)")).toEqual(Fields.number(34));
    expect(parseEval("number(\"34\")")).toEqual(Fields.number(34));
    expect(parseEval("number(\"17 years\")")).toEqual(Fields.number(17));
    expect(parseEval("number(\"-19\")")).toEqual(Fields.number(-19));
});

// <-- regexreplace() -->

test("Evaluate regexreplace", () => {
    expect(parseEval('regexreplace("yes", ".+", "no")')).toEqual(Fields.string("no"));
    expect(parseEval('regexreplace("yes", "y", "no")')).toEqual(Fields.string("noes"));
    expect(parseEval('regexreplace("yes", "yes", "no")')).toEqual(Fields.string("no"));
});

/** Parse a field expression and evaluate it in the simple context. */
function parseEval(text: string): LiteralField {
    let field = EXPRESSION.field.tryParse(text);
    return simpleContext().evaluate(field) as LiteralField;
}

function simpleLinkHandler(): LinkHandler {
    return {
        resolve: path => Fields.NULL,
        normalize: path => path,
        exists: path => false
    }
}

/** Create a trivial context good for evaluations that do not depend on links. */
function simpleContext(): Context {
    return new Context(simpleLinkHandler());
}