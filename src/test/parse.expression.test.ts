import { BinaryOpField, Fields, LiteralField } from "src/expression/field";
import { EXPRESSION } from "src/expression/parse";
import { DateTime, Duration } from 'luxon';
import { Success } from "parsimmon";
import { Sources } from "src/data/source";
import { Link, Values } from "src/data/value";

// <-- Integer Literals -->

test("Parse Integer Literal", () => {
    expect(EXPRESSION.number.parse("0no").status).toBe(false);
    expect(EXPRESSION.number.tryParse("123")).toBe(123);
});

test("Parse Float Literal", () => {
    expect(EXPRESSION.number.tryParse("123.45")).toBeCloseTo(123.45);
    expect(EXPRESSION.number.tryParse("1000.0")).toBeCloseTo(1000);
    expect(EXPRESSION.number.parse("123.0.0").status).toBe(false);
});

// <-- String Literals -->

test("Parse String Literal", () => {
    expect(EXPRESSION.string.parse(`this won't work, no quotes`).status).toBe(false);
    expect(EXPRESSION.string.tryParse(`"hello"`)).toBe("hello");

    expect(EXPRESSION.string.tryParse(`"\\""`)).toBe('"');
    expect(EXPRESSION.string.parse(`"\\\\""`).status).toBe(false);

    // Test case which failed on old regex
    expect(EXPRESSION.string.tryParse(`"\\\\\\""`)).toBe(`\\"`);

    // Testcase for escape in regex strings.
    expect(EXPRESSION.string.tryParse('"\\w+"')).toBe('\\w+');
});

test("Parse Empty String Literal", () => {
    expect(EXPRESSION.string.tryParse("\"\"")).toBe("");
});

test("Parse String Escape", () => {
    expect(EXPRESSION.string.tryParse("\"\\\"\"")).toBe("\"");
});

test("Parse String Escape Escape", () => {
    expect(EXPRESSION.string.tryParse("\"\\\\\"")).toBe("\\");
})

test("Parse Multiple Strings", () => {
    let result = EXPRESSION.field.tryParse("\"\" or \"yes\"") as BinaryOpField;
    expect(result.type).toBe("binaryop");

    let left = result.left as LiteralField;
    expect(left.type).toBe("literal");
    expect(left.value).toBe("");

    let right = result.right as LiteralField;
    expect(right.type).toBe("literal");
    expect(right.value).toBe("yes");
});

test("Parse string with emoji", () => {
    expect(EXPRESSION.string.tryParse("\"📷\"")).toEqual("📷");
});

// <-- Booleans -->

test("Parse boolean literal", () => {
    expect(EXPRESSION.bool.tryParse("true")).toBe(true);
    expect(EXPRESSION.bool.tryParse("false")).toBe(false);
    expect(EXPRESSION.bool.parse("fal").status).toBe(false);
});

// <-- Tags -->

test("Parse tag literal", () => {
    expect(EXPRESSION.tag.tryParse("#hello-from-marketing/yes")).toEqual("#hello-from-marketing/yes");
    expect(EXPRESSION.tag.tryParse("#daily/2021/20/08")).toEqual("#daily/2021/20/08");
});

test("Parse unicode tag", () => {
    expect(EXPRESSION.tag.tryParse("#début")).toEqual("#début");
});

test("Parse tag with emoji", () => {
    expect(EXPRESSION.tag.tryParse("#📷")).toEqual("#📷");
});

// <-- Identifiers -->

test("Parse Identifier", () => {
    expect(EXPRESSION.identifier.tryParse("lma0")).toEqual("lma0");
    expect(EXPRESSION.identifier.parse("0no").status).toBe(false);
});

// <-- Dates -->

test("Parse Year-Month date", () => {
    let date = EXPRESSION.date.tryParse("2020-04");
    expect(date.year).toBe(2020);
    expect(date.month).toBe(4);
});

test("Parse Year-Month-Day date", () => {
    let date = EXPRESSION.date.tryParse("1984-08-15");
    expect(date.year).toBe(1984);
    expect(date.month).toBe(8);
    expect(date.day).toBe(15);
});

test("Parse Year-Month-DayTHour:Minute:Second", () => {
    let date = EXPRESSION.date.tryParse("1984-08-15T12:42:59");
    expect(date.year).toBe(1984);
    expect(date.month).toBe(8);
    expect(date.day).toBe(15);
    expect(date.hour).toBe(12);
    expect(date.minute).toBe(42);
    expect(date.second).toBe(59);
});

test("Parse Today", () => {
    let date = EXPRESSION.dateField.tryParse("date(today)") as LiteralField;
    expect(Values.isDate(date.value)).toEqual(true);
    expect(date.value).toEqual(DateTime.local().startOf("day"));
})

// <-- Durations -->

test("Parse day duration", () => {
    let day = EXPRESSION.duration.tryParse("6 days");
    let day2 = EXPRESSION.duration.tryParse("6day");

    expect(day).toEqual(day2);
    expect(day).toEqual(Duration.fromObject({ days: 6 }));
});

test("Parse minute duration", () => {
    let min = EXPRESSION.duration.tryParse("4min");
    let min2 = EXPRESSION.duration.tryParse("4 minutes");
    let min3 = EXPRESSION.duration.tryParse("4 minute");

    expect(min).toEqual(min2);
    expect(min).toEqual(min3);
    expect(min).toEqual(Duration.fromObject({ minutes: 4 }));
});

// <-- Links -->

test("Parse Link", () => {
    expect(EXPRESSION.field.tryParse("[[test/Main]]")).toEqual(Fields.literal(Link.file("test/Main", false)));
    expect(EXPRESSION.field.tryParse("[[test/Main.md]]")).toEqual(Fields.literal(Link.file("test/Main.md", false)));
    expect(EXPRESSION.field.tryParse("[[simple0]]")).toEqual(Fields.literal(Link.file("simple0", false)));
    expect(EXPRESSION.field.tryParse("[[2020-08-15]]")).toEqual(Fields.literal(Link.file("2020-08-15", false)));
    expect(EXPRESSION.field.tryParse("[[%Man & Machine + Mind%]]")).toEqual(Fields.literal(Link.file("%Man & Machine + Mind%", false)));
});

test("Parse link with display", () => {
    expect(EXPRESSION.field.tryParse("[[test/Main|Yes]]")).toEqual(Fields.literal(Link.file("test/Main", false, "Yes")));
    expect(EXPRESSION.field.tryParse("[[%Man + Machine%|0h no]]")).toEqual(Fields.literal(Link.file("%Man + Machine%", false, "0h no")));
});

test("Parse link with header/block", () => {
    expect(EXPRESSION.field.tryParse("[[test/Main#Yes]]")).toEqual(Fields.literal(Link.header("test/Main", "Yes", false)));
    expect(EXPRESSION.field.tryParse("[[2020^14df]]")).toEqual(Fields.literal(Link.block("2020", "14df", false)));
});

test("Parse link with header and display", () => {
    expect(EXPRESSION.field.tryParse("[[test/Main#what|Yes]]")).toEqual(Fields.literal(Link.header("test/Main", "what", false, "Yes")));
    expect(EXPRESSION.field.tryParse("[[%Man + Machine%^no|0h no]]")).toEqual(Fields.literal(Link.block("%Man + Machine%", "no", false, "0h no")));
});

// <-- Null ->

test("Parse Null", () => {
    expect(EXPRESSION.field.tryParse("null")).toEqual(Fields.NULL);
    expect(EXPRESSION.field.tryParse("\"null\"")).toEqual(Fields.literal("null"));
});

// <-- Indexes -->

test("Parse Dot Notation", () => {
    expect(EXPRESSION.field.tryParse("Dates.Birthday")).toEqual(Fields.index(Fields.variable("Dates"), Fields.literal("Birthday")));
    expect(EXPRESSION.field.tryParse("a.b.c3")).toEqual(Fields.index(Fields.index(Fields.variable("a"), Fields.literal("b")), Fields.literal("c3")));
});

test("Parse Index Notation", () => {
    expect(EXPRESSION.field.tryParse("a[0]")).toEqual(Fields.index(Fields.variable("a"), Fields.literal(0)));
    expect(EXPRESSION.field.tryParse("\"hello\"[0]")).toEqual(Fields.index(Fields.literal("hello"), Fields.literal(0)));
    expect(EXPRESSION.field.tryParse("hello[brain]")).toEqual(Fields.index(Fields.variable("hello"), Fields.variable("brain")));
});

test("Parse Mixed Index/Dot Notation", () => {
    expect(EXPRESSION.field.tryParse("a.b[0]")).toEqual(Fields.index(Fields.index(Fields.variable("a"), Fields.literal("b")), Fields.literal(0)));
    expect(EXPRESSION.field.tryParse("\"hello\".what[yes]")).toEqual(Fields.index(Fields.index(
        Fields.literal("hello"), Fields.literal("what")
    ), Fields.variable("yes")));
});

test("Parse negated index", () => {
    expect(EXPRESSION.field.tryParse("!a[b]")).toEqual(Fields.negate(Fields.index(Fields.variable("a"), Fields.variable("b"))));
    expect(EXPRESSION.field.tryParse("!a.b")).toEqual(Fields.negate(Fields.index(Fields.variable("a"), Fields.literal("b"))));
});


// <-- Functions -->

test("Parse function with no arguments", () => {
    expect(EXPRESSION.field.tryParse("hello()")).toEqual(Fields.func(Fields.variable('hello'), []));
    expect(EXPRESSION.field.tryParse("lma0()")).toEqual(Fields.func(Fields.variable('lma0'), []));
});

test("Parse function with arguments", () => {
    expect(EXPRESSION.field.tryParse("list(1, 2, 3)"))
        .toEqual(Fields.func(Fields.variable('list'), [Fields.literal(1), Fields.literal(2), Fields.literal(3)]));
    expect(EXPRESSION.field.tryParse("object(\"a\", 1, \"b\", 2)"))
        .toEqual(Fields.func(Fields.variable('object'), [Fields.literal("a"), Fields.literal(1), Fields.literal("b"), Fields.literal(2)]));
});

test("Parse function with duration", () => {
    expect(EXPRESSION.field.tryParse("today() + dur(4hr)"))
        .toEqual(Fields.binaryOp(Fields.func(Fields.variable('today'), []), '+', Fields.literal(Duration.fromObject({ hours: 4 }))));
});

test("Parse function with mixed dot, index, and function call", () => {
    expect(EXPRESSION.field.tryParse("list().parts[0]")).toEqual(Fields.index(Fields.index(
        Fields.func(Fields.variable("list"), []), Fields.literal("parts")), Fields.literal(0)));
});

// <-- Binary Ops -->

test("Parse Simple Addition", () => {
    let result = EXPRESSION.binaryOpField.parse("16 + \"what\"") as Success<BinaryOpField>;
    expect(result.status).toBe(true);
    expect(result.value).toEqual(Fields.binaryOp(Fields.literal(16), '+', Fields.literal("what")));
});

test("Parse Simple Division", () => {
    expect(EXPRESSION.field.tryParse("14 / 2")).toEqual(Fields.binaryOp(Fields.literal(14), '/', Fields.literal(2)));
    expect(EXPRESSION.field.tryParse("31 / 9.0")).toEqual(Fields.binaryOp(Fields.literal(31), '/', Fields.literal(9.0)));
})

test("Parse Parenthesis", () => {
    let result = EXPRESSION.field.parse("(16 - 4) - 8") as Success<BinaryOpField>;
    expect(result.status).toBe(true);
    expect(result.value).toEqual(Fields.binaryOp(Fields.binaryOp(Fields.literal(16), '-', Fields.literal(4)), '-', Fields.literal(8)));
});

test("Parse Order of Operations", () => {
    expect(EXPRESSION.field.tryParse("14 + 6 >= 19 - 2")).toEqual(Fields.binaryOp(
        Fields.binaryOp(Fields.literal(14), '+', Fields.literal(6)),
        '>=',
        Fields.binaryOp(Fields.literal(19), '-', Fields.literal(2)),
    ));
});

// <-- Negation -->

test("Parse Negated field", () => {
    expect(EXPRESSION.field.tryParse("!true")).toEqual(Fields.negate(Fields.literal(true)));
    expect(EXPRESSION.field.tryParse("!14")).toEqual(Fields.negate(Fields.literal(14)));
    expect(EXPRESSION.field.tryParse("!neat(0)")).toEqual(Fields.negate(Fields.func(Fields.variable("neat"), [Fields.literal(0)])));
    expect(EXPRESSION.field.tryParse("!!what")).toEqual(Fields.negate(Fields.negate(Fields.variable("what"))));
});

test("Parse binaryop negated field", () => {
    expect(EXPRESSION.field.tryParse("!(true & false)")).toEqual(Fields.negate(
        Fields.binaryOp(Fields.literal(true), '&', Fields.literal(false))
    ));
    expect(EXPRESSION.field.tryParse("true & !false")).toEqual(
        Fields.binaryOp(Fields.literal(true), '&', Fields.negate(Fields.literal(false))));
});

// <-- Sources -->

test("Parse simple sources", () => {
    expect(EXPRESSION.source.tryParse("\"hello\"")).toEqual(Sources.folder("hello"));
    expect(EXPRESSION.source.tryParse("#neat")).toEqual(Sources.tag("#neat"));
});

test("Parse negated source", () => {
    expect(EXPRESSION.source.tryParse("-\"hello\"")).toEqual(Sources.negate(Sources.folder("hello")));
    expect(EXPRESSION.source.tryParse("!\"hello\"")).toEqual(Sources.negate(Sources.folder("hello")));
    expect(EXPRESSION.source.tryParse("-#neat")).toEqual(Sources.negate(Sources.tag("#neat")));
    expect(EXPRESSION.source.tryParse("!#neat")).toEqual(Sources.negate(Sources.tag("#neat")));
});

test("Parse parens source", () => {
    expect(EXPRESSION.source.tryParse("(\"lma0\")")).toEqual(Sources.folder("lma0"));
    expect(EXPRESSION.source.tryParse("(#neat0)")).toEqual(Sources.tag("#neat0"));
})

test("Parse binary source", () => {
    expect(EXPRESSION.source.tryParse("\"lma0\" or #neat")).toEqual(
        Sources.binaryOp(Sources.folder("lma0"), '|', Sources.tag("#neat")));

    expect(EXPRESSION.source.tryParse("\"meme\" & #dirty")).toEqual(
        Sources.binaryOp(Sources.folder("meme"), '&', Sources.tag("#dirty")));
});

test("Parse negated parens source", () => {
    expect(EXPRESSION.source.tryParse("-(#neat)")).toEqual(Sources.negate(Sources.tag("#neat")));
    expect(EXPRESSION.source.tryParse("!(#neat)")).toEqual(Sources.negate(Sources.tag("#neat")));
    expect(EXPRESSION.source.tryParse("-(\"meme\" & #dirty)")).toEqual(
        Sources.negate(Sources.binaryOp(Sources.folder("meme"), '&', Sources.tag("#dirty"))));
    expect(EXPRESSION.source.tryParse("!(\"meme\" & #dirty)")).toEqual(
        Sources.negate(Sources.binaryOp(Sources.folder("meme"), '&', Sources.tag("#dirty"))));
    expect(EXPRESSION.source.tryParse("-\"meme\" & #dirty")).toEqual(
        Sources.binaryOp(Sources.negate(Sources.folder("meme")), '&', Sources.tag("#dirty")));
    expect(EXPRESSION.source.tryParse("!\"meme\" & #dirty")).toEqual(
        Sources.binaryOp(Sources.negate(Sources.folder("meme")), '&', Sources.tag("#dirty")));
});


// <-- Stress Tests -->

test("Parse Various Fields", () => {
    expect(EXPRESSION.field.tryParse("list(a, \"b\", 3, [[4]])")).toEqual(
        Fields.func(Fields.variable('list'), [Fields.variable("a"), Fields.literal("b"), Fields.literal(3), Fields.literal(Link.file("4", false))]));
});
