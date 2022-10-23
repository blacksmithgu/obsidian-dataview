import { BinaryOpField, Fields, LiteralField } from "expression/field";
import { EXPRESSION } from "expression/parse";
import { DateTime, Duration } from "luxon";
import { Success } from "parsimmon";
import { Sources } from "data-index/source";
import { Values, Link } from "data-model/value";

// <-- Integer Literals -->

test("Parse Integer Literal", () => {
    expect(EXPRESSION.number.parse("0no").status).toBe(false);
    expect(EXPRESSION.number.tryParse("123")).toBe(123);
    expect(EXPRESSION.number.tryParse("-123")).toBe(-123);
});

test("Parse Float Literal", () => {
    expect(EXPRESSION.number.tryParse("123.45")).toBeCloseTo(123.45);
    expect(EXPRESSION.number.tryParse("1000.0")).toBeCloseTo(1000);
    expect(EXPRESSION.number.tryParse("-123.18")).toBe(-123.18);
    expect(EXPRESSION.number.parse("123.0.0").status).toBe(false);
});

// <-- String Literals -->

describe("String Literals", () => {
    test("Parse String Literal", () => {
        expect(EXPRESSION.string.parse(`this won't work, no quotes`).status).toBe(false);
        expect(EXPRESSION.string.tryParse(`"hello"`)).toBe("hello");

        expect(EXPRESSION.string.tryParse(`"\\""`)).toBe('"');
        expect(EXPRESSION.string.parse(`"\\\\""`).status).toBe(false);

        // Test case which failed on old regex
        expect(EXPRESSION.string.tryParse(`"\\\\\\""`)).toBe(`\\"`);

        // Testcase for escape in regex strings.
        expect(EXPRESSION.string.tryParse('"\\w+"')).toBe("\\w+");
    });

    test("Parse Empty String Literal", () => {
        expect(EXPRESSION.string.tryParse('""')).toBe("");
    });

    test("Parse String Escape", () => {
        expect(EXPRESSION.string.tryParse('"\\""')).toBe('"');
    });

    test("Parse String Escape Escape", () => {
        expect(EXPRESSION.string.tryParse('"\\\\"')).toBe("\\");
    });

    test("Parse Multiple Strings", () => {
        let result = EXPRESSION.field.tryParse('"" or "yes"') as BinaryOpField;
        expect(result.type).toBe("binaryop");

        let left = result.left as LiteralField;
        expect(left.type).toBe("literal");
        expect(left.value).toBe("");

        let right = result.right as LiteralField;
        expect(right.type).toBe("literal");
        expect(right.value).toBe("yes");
    });

    test("Parse emoji", () => {
        expect(EXPRESSION.string.tryParse('"📷"')).toEqual("📷");
        expect(EXPRESSION.string.tryParse('"⚙️"')).toEqual("⚙️");
    });

    test("Parse string which includes emoji", () => {
        expect(EXPRESSION.string.tryParse('"⚗️ KNOWLEDGE"')).toEqual("⚗️ KNOWLEDGE");
    });
});

// <-- Booleans -->

test("Parse boolean literal", () => {
    expect(EXPRESSION.bool.tryParse("true")).toBe(true);
    expect(EXPRESSION.bool.tryParse("false")).toBe(false);
    expect(EXPRESSION.bool.parse("fal").status).toBe(false);
});

// <-- Tags -->

describe("Tag Literals", () => {
    test("Daily", () => expect(EXPRESSION.tag.tryParse("#daily/2021/20/08")).toEqual("#daily/2021/20/08"));
    test("Dashes", () =>
        expect(EXPRESSION.tag.tryParse("#hello-from-marketing/yes")).toEqual("#hello-from-marketing/yes"));

    test("#📷", () => expect(EXPRESSION.tag.tryParse("#📷")).toEqual("#📷"));
    test("#🌱/🌿", () => expect(EXPRESSION.tag.tryParse("#🌱/🌿")).toEqual("#🌱/🌿"));
    test("#⚙️", () => expect(EXPRESSION.tag.tryParse("#⚙️")).toEqual("#⚙️"));
    test("#début", () => expect(EXPRESSION.tag.tryParse("#début")).toEqual("#début"));
});

// <-- Identifiers -->

describe("Identifiers", () => {
    test("lma0", () => expect(EXPRESSION.identifier.tryParse("lma0")).toEqual("lma0"));
    test("0no", () => expect(EXPRESSION.identifier.parse("0no").status).toBeFalsy());
    test("a*b", () => expect(EXPRESSION.identifier.parse("a*b").status).toBeFalsy());
    test("😊", () => expect(EXPRESSION.identifier.tryParse("😊")).toEqual("😊"));
    test("📷", () => expect(EXPRESSION.identifier.tryParse("📷")).toEqual("📷"));
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

test("Parse Year-Month-DayTHour:Minute:Second", () => {
    let date = EXPRESSION.date.tryParse("1984-08-15T12:42:59");
    expect(date.year).toBe(1984);
    expect(date.month).toBe(8);
    expect(date.day).toBe(15);
    expect(date.hour).toBe(12);
    expect(date.minute).toBe(42);
    expect(date.second).toBe(59);
});

test("Parse Year-Month-DayTHour:Minute:Second.Millisecond", () => {
    let date = EXPRESSION.date.tryParse("1984-08-15T12:42:59.123");
    expect(date.year).toBe(1984);
    expect(date.month).toBe(8);
    expect(date.day).toBe(15);
    expect(date.hour).toBe(12);
    expect(date.minute).toBe(42);
    expect(date.second).toBe(59);
    expect(date.millisecond).toBe(123);

    let builtin = EXPRESSION.date.tryParse(new Date("1984-08-15T12:42:59.123").toISOString());
    // only seconds and milliseconds are inconsistent due to Javascript being bad with
    // time zones, but the goal here is to ensure values are parsed appropriately at least
    expect(builtin.second).toBe(59);
    expect(builtin.millisecond).toBe(123);
});

describe("Parse Year-Month-DayTHour:Minute:Second(.Millisecond?)Timezone", () => {
    test("Offset", () => {
        let date1 = EXPRESSION.date.tryParse("1984-08-15T12:40:50-07:00");
        expect(date1.year).toBe(1984);
        expect(date1.month).toBe(8);
        expect(date1.day).toBe(15);
        expect(date1.hour).toBe(12);
        expect(date1.minute).toBe(40);
        expect(date1.second).toBe(50);
        expect(date1.millisecond).toBe(0);
        expect(date1.zoneName).toBe("UTC-7");

        let date2 = EXPRESSION.date.tryParse("1984-08-15T12:40:50+9");
        expect(date2.zoneName).toBe("UTC+9");

        let date3 = EXPRESSION.date.tryParse("1985-12-06T19:40:10+06:30");
        expect(date3.zoneName).toBe("UTC+6:30");
    });

    test("Named timezone", () => {
        let date1 = EXPRESSION.date.tryParse("2021-08-15T12:40:50[Europe/Paris]");
        expect(date1.year).toBe(2021);
        expect(date1.month).toBe(8);
        expect(date1.day).toBe(15);
        expect(date1.hour).toBe(12);
        expect(date1.minute).toBe(40);
        expect(date1.second).toBe(50);
        expect(date1.millisecond).toBe(0);
        expect(date1.toString()).toBe("2021-08-15T12:40:50.000+02:00");
        expect(date1.zoneName).toBe("Europe/Paris");

        let date2 = EXPRESSION.date.tryParse("2021-11-15T12:40:50[Europe/Paris]");
        expect(date2.year).toBe(2021);
        expect(date2.month).toBe(11);
        expect(date2.day).toBe(15);
        expect(date2.hour).toBe(12);
        expect(date2.minute).toBe(40);
        expect(date2.second).toBe(50);
        expect(date2.millisecond).toBe(0);
        expect(date2.toString()).toBe("2021-11-15T12:40:50.000+01:00");
        expect(date2.zoneName).toBe("Europe/Paris");
    });

    test("Z", () => {
        let date1 = EXPRESSION.date.tryParse("1985-12-06T19:40:10Z");
        expect(date1.year).toBe(1985);
        expect(date1.month).toBe(12);
        expect(date1.day).toBe(6);
        expect(date1.hour).toBe(19);
        expect(date1.minute).toBe(40);
        expect(date1.second).toBe(10);
        expect(date1.millisecond).toBe(0);
        expect(date1.zoneName).toBe("UTC");

        let date2 = EXPRESSION.date.tryParse("1985-12-06T19:40:10.123Z");
        expect(date2.zoneName).toBe("UTC");

        // built-in always returns UTC
        let date3 = EXPRESSION.date.tryParse(new Date().toISOString());
        expect(date3.zoneName).toBe("UTC");
    });
});

test("Parse invalid date", () => expect(EXPRESSION.date.parse("4237-14-73").status).toBeFalsy());

test("Parse Today", () => {
    let date = EXPRESSION.dateField.tryParse("date(today)") as LiteralField;
    expect(Values.isDate(date.value)).toEqual(true);
    expect(date.value).toEqual(DateTime.local().startOf("day"));
});

// <-- Durations -->

describe("Durations", () => {
    test("6 days", () => {
        let day = EXPRESSION.duration.tryParse("6 days");
        let day2 = EXPRESSION.duration.tryParse("6day");

        expect(day).toEqual(day2);
        expect(day).toEqual(Duration.fromObject({ days: 6 }));
    });

    test("4 minutes", () => {
        let min = EXPRESSION.duration.tryParse("4min");
        let min2 = EXPRESSION.duration.tryParse("4 minutes");
        let min3 = EXPRESSION.duration.tryParse("4 minute");

        expect(min).toEqual(min2);
        expect(min).toEqual(min3);
        expect(min).toEqual(Duration.fromObject({ minutes: 4 }));
    });

    test("4 hours 15 minutes", () => {
        let dur = EXPRESSION.duration.tryParse("4 hr 15 min");
        let dur2 = EXPRESSION.duration.tryParse("4h15m");
        let dur3 = EXPRESSION.duration.tryParse("4 hours, 15 minutes");

        expect(dur).toEqual(dur2);
        expect(dur).toEqual(dur3);
        expect(dur).toEqual(Duration.fromObject({ hours: 4, minutes: 15 }));
    });

    test("4 years 6 weeks 9 minutes 3 seconds", () => {
        let dur = EXPRESSION.duration.tryParse("4 years 6 weeks 9 minutes 3 seconds");
        let dur2 = EXPRESSION.duration.tryParse("4yr6w9m3s");
        let dur3 = EXPRESSION.duration.tryParse("4 yrs, 6 wks, 9 mins, 3 s");

        expect(dur).toEqual(dur2);
        expect(dur).toEqual(dur3);
        expect(dur).toEqual(Duration.fromObject({ years: 4, weeks: 6, minutes: 9, seconds: 3 }));
    });
});

// <-- Links -->

describe("Parse Link", () => {
    test("simple", () =>
        expect(EXPRESSION.field.tryParse("[[test/Main]]")).toEqual(Fields.literal(Link.file("test/Main", false))));
    test("extension", () =>
        expect(EXPRESSION.field.tryParse("[[test/Main.md]]")).toEqual(
            Fields.literal(Link.file("test/Main.md", false))
        ));
    test("number", () =>
        expect(EXPRESSION.field.tryParse("[[simple0]]")).toEqual(Fields.literal(Link.file("simple0", false))));
    test("date", () =>
        expect(EXPRESSION.field.tryParse("[[2020-08-15]]")).toEqual(Fields.literal(Link.file("2020-08-15", false))));
    test("glyphs", () =>
        expect(EXPRESSION.field.tryParse("[[%Man & Machine + Mind%]]")).toEqual(
            Fields.literal(Link.file("%Man & Machine + Mind%", false))
        ));

    test("escaped pipe", () =>
        expect(EXPRESSION.link.tryParse("[[Hello \\| There]]")).toEqual(Link.file("Hello | There")));
    test("escaped pipe with display", () =>
        expect(EXPRESSION.link.tryParse("[[\\||Yes]]")).toEqual(Link.file("|", false, "Yes")));
});

test("Parse link with display", () => {
    expect(EXPRESSION.field.tryParse("[[test/Main|Yes]]")).toEqual(
        Fields.literal(Link.file("test/Main", false, "Yes"))
    );
    expect(EXPRESSION.field.tryParse("[[%Man + Machine%|0h no]]")).toEqual(
        Fields.literal(Link.file("%Man + Machine%", false, "0h no"))
    );
});

test("Parse link with header/block", () => {
    expect(EXPRESSION.field.tryParse("[[test/Main#Yes]]")).toEqual(
        Fields.literal(Link.header("test/Main", "Yes", false))
    );
    expect(EXPRESSION.field.tryParse("[[2020#^14df]]")).toEqual(Fields.literal(Link.block("2020", "14df", false)));
});

test("Parse link with header and display", () => {
    expect(EXPRESSION.field.tryParse("[[test/Main#what|Yes]]")).toEqual(
        Fields.literal(Link.header("test/Main", "what", false, "Yes"))
    );
    expect(EXPRESSION.field.tryParse("[[%Man + Machine%#^no|0h no]]")).toEqual(
        Fields.literal(Link.block("%Man + Machine%", "no", false, "0h no"))
    );
});

test("Parse embedded link", () => {
    expect(EXPRESSION.field.tryParse("![[hello]]")).toEqual(Fields.literal(Link.file("hello", true)));
});

// <-- Null ->

test("Parse Null", () => {
    expect(EXPRESSION.field.tryParse("null")).toEqual(Fields.NULL);
    expect(EXPRESSION.field.tryParse('"null"')).toEqual(Fields.literal("null"));
});

// <-- Indexes -->

test("Parse Dot Notation", () => {
    expect(EXPRESSION.field.tryParse("Dates.Birthday")).toEqual(
        Fields.index(Fields.variable("Dates"), Fields.literal("Birthday"))
    );
    expect(EXPRESSION.field.tryParse("a.b.c3")).toEqual(
        Fields.index(Fields.index(Fields.variable("a"), Fields.literal("b")), Fields.literal("c3"))
    );
});

test("Parse Index Notation", () => {
    expect(EXPRESSION.field.tryParse("a[0]")).toEqual(Fields.index(Fields.variable("a"), Fields.literal(0)));
    expect(EXPRESSION.field.tryParse('"hello"[0]')).toEqual(Fields.index(Fields.literal("hello"), Fields.literal(0)));
    expect(EXPRESSION.field.tryParse("hello[brain]")).toEqual(
        Fields.index(Fields.variable("hello"), Fields.variable("brain"))
    );
});

test("Parse Mixed Index/Dot Notation", () => {
    expect(EXPRESSION.field.tryParse("a.b[0]")).toEqual(
        Fields.index(Fields.index(Fields.variable("a"), Fields.literal("b")), Fields.literal(0))
    );
    expect(EXPRESSION.field.tryParse('"hello".what[yes]')).toEqual(
        Fields.index(Fields.index(Fields.literal("hello"), Fields.literal("what")), Fields.variable("yes"))
    );
});

test("Parse negated index", () => {
    expect(EXPRESSION.field.tryParse("!a[b]")).toEqual(
        Fields.negate(Fields.index(Fields.variable("a"), Fields.variable("b")))
    );
    expect(EXPRESSION.field.tryParse("!a.b")).toEqual(
        Fields.negate(Fields.index(Fields.variable("a"), Fields.literal("b")))
    );
});

// <-- Functions -->

test("Parse function with no arguments", () => {
    expect(EXPRESSION.field.tryParse("hello()")).toEqual(Fields.func(Fields.variable("hello"), []));
    expect(EXPRESSION.field.tryParse("lma0()")).toEqual(Fields.func(Fields.variable("lma0"), []));
});

test("Parse function with arguments", () => {
    expect(EXPRESSION.field.tryParse("list(1, 2, 3)")).toEqual(
        Fields.func(Fields.variable("list"), [Fields.literal(1), Fields.literal(2), Fields.literal(3)])
    );
    expect(EXPRESSION.field.tryParse('object("a", 1, "b", 2)')).toEqual(
        Fields.func(Fields.variable("object"), [
            Fields.literal("a"),
            Fields.literal(1),
            Fields.literal("b"),
            Fields.literal(2),
        ])
    );
});

test("Parse function with duration", () => {
    expect(EXPRESSION.field.tryParse("today() + dur(4hr)")).toEqual(
        Fields.binaryOp(
            Fields.func(Fields.variable("today"), []),
            "+",
            Fields.literal(Duration.fromObject({ hours: 4 }))
        )
    );
});

test("Parse null duration", () => {
    expect(EXPRESSION.field.tryParse("dur(null)")).toEqual(Fields.func(Fields.variable("dur"), [Fields.literal(null)]));
    expect(EXPRESSION.field.tryParse('dur("null")')).toEqual(
        Fields.func(Fields.variable("dur"), [Fields.literal("null")])
    );
});

test("Parse function with null duration", () => {
    expect(EXPRESSION.field.tryParse("today() + dur(null)")).toEqual(
        Fields.binaryOp(
            Fields.func(Fields.variable("today"), []),
            "+",
            Fields.func(Fields.variable("dur"), [Fields.literal(null)])
        )
    );
});

test("Parse date +/- null", () => {
    expect(EXPRESSION.field.tryParse("today() + null")).toEqual(
        Fields.binaryOp(Fields.func(Fields.variable("today"), []), "+", Fields.literal(null))
    );
    expect(EXPRESSION.field.tryParse("today() - null")).toEqual(
        Fields.binaryOp(Fields.func(Fields.variable("today"), []), "-", Fields.literal(null))
    );
});

test("Parse function with mixed dot, index, and function call", () => {
    expect(EXPRESSION.field.tryParse("list().parts[0]")).toEqual(
        Fields.index(Fields.index(Fields.func(Fields.variable("list"), []), Fields.literal("parts")), Fields.literal(0))
    );
});

// <-- Lambdas -->
describe("Lambda Expressions", () => {
    test("Parse 0-argument constant lambda", () => {
        expect(EXPRESSION.field.tryParse("() => 16")).toEqual(Fields.lambda([], Fields.literal(16)));
    });

    test("Parse 0-argument binary op lambda", () => {
        expect(EXPRESSION.field.tryParse("() => a + 2")).toEqual(
            Fields.lambda([], Fields.binaryOp(Fields.variable("a"), "+", Fields.literal(2)))
        );
    });

    test("Parse 1-argument lambda", () => {
        expect(EXPRESSION.field.tryParse("(v) => v")).toEqual(Fields.lambda(["v"], Fields.variable("v")));
    });

    test("Parse 2-argument lambda", () => {
        expect(EXPRESSION.field.tryParse("(yes, no) => yes - no")).toEqual(
            Fields.lambda(["yes", "no"], Fields.binaryOp(Fields.variable("yes"), "-", Fields.variable("no")))
        );
    });
});

// <-- Lists -->

describe("Lists", () => {
    test("[]", () => expect(EXPRESSION.field.tryParse("[]")).toEqual(Fields.list([])));
    test("[1]", () => expect(EXPRESSION.field.tryParse("[1]")).toEqual(Fields.list([Fields.literal(1)])));
    test("[1, 2]", () =>
        expect(EXPRESSION.field.tryParse("[1,2]")).toEqual(Fields.list([Fields.literal(1), Fields.literal(2)])));
    test("[1, 2, 3]", () =>
        expect(EXPRESSION.field.tryParse("[ 1,  2, 3   ]")).toEqual(
            Fields.list([Fields.literal(1), Fields.literal(2), Fields.literal(3)])
        ));

    test('["a"]', () => expect(EXPRESSION.field.tryParse('["a" ]')).toEqual(Fields.list([Fields.literal("a")])));

    test("[[]]", () => expect(EXPRESSION.field.tryParse("[ [] ]")).toEqual(Fields.list([Fields.list([])])));
});

// <-- Objects -->

describe("Objects", () => {
    test("{}", () => expect(EXPRESSION.field.tryParse("{}")).toEqual(Fields.object({})));
    test("{ a: 1 }", () =>
        expect(EXPRESSION.field.tryParse("{ a: 1 }")).toEqual(Fields.object({ a: Fields.literal(1) })));
    test('{ "a": 1 }', () =>
        expect(EXPRESSION.field.tryParse('{ "a": 1 }')).toEqual(Fields.object({ a: Fields.literal(1) })));
    test('{ "yes no": 1 }', () =>
        expect(EXPRESSION.field.tryParse('{ "yes no": 1 }')).toEqual(Fields.object({ "yes no": Fields.literal(1) })));

    test("{a:1,b:[2]}", () =>
        expect(EXPRESSION.field.tryParse("{ a: 1, b: [2] }")).toEqual(
            Fields.object({ a: Fields.literal(1), b: Fields.list([Fields.literal(2)]) })
        ));
});

// <-- Binary Ops -->

describe("Binary Operators", () => {
    test("Simple Addition", () => {
        let result = EXPRESSION.binaryOpField.parse('16 + "what"') as Success<BinaryOpField>;
        expect(result.status).toBe(true);
        expect(result.value).toEqual(Fields.binaryOp(Fields.literal(16), "+", Fields.literal("what")));
    });

    test("Simple Division", () => {
        expect(EXPRESSION.field.tryParse("14 / 2")).toEqual(
            Fields.binaryOp(Fields.literal(14), "/", Fields.literal(2))
        );
        expect(EXPRESSION.field.tryParse("31 / 9.0")).toEqual(
            Fields.binaryOp(Fields.literal(31), "/", Fields.literal(9.0))
        );
    });

    test("Simple Modulo", () => {
        expect(EXPRESSION.field.tryParse("14 % 2")).toEqual(
            Fields.binaryOp(Fields.literal(14), "%", Fields.literal(2))
        );
        expect(EXPRESSION.field.tryParse("31 % 9.0")).toEqual(
            Fields.binaryOp(Fields.literal(31), "%", Fields.literal(9.0))
        );
    });

    test("Multiplication (No Spaces)", () => {
        expect(EXPRESSION.field.tryParse("3*a")).toEqual(Fields.binaryOp(Fields.literal(3), "*", Fields.variable("a")));
    });

    test("Parenthesis", () => {
        let result = EXPRESSION.field.parse("(16 - 4) - 8") as Success<BinaryOpField>;
        expect(result.status).toBe(true);
        expect(result.value).toEqual(
            Fields.binaryOp(Fields.binaryOp(Fields.literal(16), "-", Fields.literal(4)), "-", Fields.literal(8))
        );
    });

    test("Order of Operations", () => {
        expect(EXPRESSION.field.tryParse("14 + 6 >= 19 - 2")).toEqual(
            Fields.binaryOp(
                Fields.binaryOp(Fields.literal(14), "+", Fields.literal(6)),
                ">=",
                Fields.binaryOp(Fields.literal(19), "-", Fields.literal(2))
            )
        );
    });
});

// <-- Negation -->

test("Parse Negated field", () => {
    expect(EXPRESSION.field.tryParse("!true")).toEqual(Fields.negate(Fields.literal(true)));
    expect(EXPRESSION.field.tryParse("!14")).toEqual(Fields.negate(Fields.literal(14)));
    expect(EXPRESSION.field.tryParse("!neat(0)")).toEqual(
        Fields.negate(Fields.func(Fields.variable("neat"), [Fields.literal(0)]))
    );
    expect(EXPRESSION.field.tryParse("!!what")).toEqual(Fields.negate(Fields.negate(Fields.variable("what"))));
});

test("Parse binaryop negated field", () => {
    expect(EXPRESSION.field.tryParse("!(true & false)")).toEqual(
        Fields.negate(Fields.binaryOp(Fields.literal(true), "&", Fields.literal(false)))
    );
    expect(EXPRESSION.field.tryParse("true & !false")).toEqual(
        Fields.binaryOp(Fields.literal(true), "&", Fields.negate(Fields.literal(false)))
    );
});

// <-- Sources -->

test("Parse simple sources", () => {
    expect(EXPRESSION.source.tryParse('"hello"')).toEqual(Sources.folder("hello"));
    expect(EXPRESSION.source.tryParse("#neat")).toEqual(Sources.tag("#neat"));
    expect(EXPRESSION.source.tryParse('csv("data/a.csv")')).toEqual(Sources.csv("data/a.csv"));
});

test("Parse negated source", () => {
    expect(EXPRESSION.source.tryParse('-"hello"')).toEqual(Sources.negate(Sources.folder("hello")));
    expect(EXPRESSION.source.tryParse('!"hello"')).toEqual(Sources.negate(Sources.folder("hello")));
    expect(EXPRESSION.source.tryParse("-#neat")).toEqual(Sources.negate(Sources.tag("#neat")));
    expect(EXPRESSION.source.tryParse("!#neat")).toEqual(Sources.negate(Sources.tag("#neat")));
});

test("Parse parens source", () => {
    expect(EXPRESSION.source.tryParse('("lma0")')).toEqual(Sources.folder("lma0"));
    expect(EXPRESSION.source.tryParse("(#neat0)")).toEqual(Sources.tag("#neat0"));
});

test("Parse binary source", () => {
    expect(EXPRESSION.source.tryParse('"lma0" or #neat')).toEqual(
        Sources.binaryOp(Sources.folder("lma0"), "|", Sources.tag("#neat"))
    );

    expect(EXPRESSION.source.tryParse('"meme" & #dirty')).toEqual(
        Sources.binaryOp(Sources.folder("meme"), "&", Sources.tag("#dirty"))
    );
});

test("Parse negated parens source", () => {
    expect(EXPRESSION.source.tryParse("-(#neat)")).toEqual(Sources.negate(Sources.tag("#neat")));
    expect(EXPRESSION.source.tryParse("!(#neat)")).toEqual(Sources.negate(Sources.tag("#neat")));
    expect(EXPRESSION.source.tryParse('-("meme" & #dirty)')).toEqual(
        Sources.negate(Sources.binaryOp(Sources.folder("meme"), "&", Sources.tag("#dirty")))
    );
    expect(EXPRESSION.source.tryParse('!("meme" & #dirty)')).toEqual(
        Sources.negate(Sources.binaryOp(Sources.folder("meme"), "&", Sources.tag("#dirty")))
    );
    expect(EXPRESSION.source.tryParse('-"meme" & #dirty')).toEqual(
        Sources.binaryOp(Sources.negate(Sources.folder("meme")), "&", Sources.tag("#dirty"))
    );
    expect(EXPRESSION.source.tryParse('!"meme" & #dirty')).toEqual(
        Sources.binaryOp(Sources.negate(Sources.folder("meme")), "&", Sources.tag("#dirty"))
    );
});

// TODO: refactor this; currently cannot test file.ts because it imports obsidian
// import { parseTaskForAnnotations } from "data/file";
// test("Parse Task for inline annotations", () => {
//     expect(parseTaskForAnnotations("key::value")).toEqual({ key: "value" });
//     expect(parseTaskForAnnotations("key key::value value")).toEqual({ key: "value" });
//     expect(parseTaskForAnnotations("key::value key2::value2")).toEqual({ key: "value", key2: "value2" });
//     expect(parseTaskForAnnotations("some dueDate::2021-09-21")).toEqual({ dueDate: DateTime.fromISO("2021-09-21") });
// });

// <-- Stress Tests -->

test("Parse Various Fields", () => {
    expect(EXPRESSION.field.tryParse('list(a, "b", 3, [[4]])')).toEqual(
        Fields.func(Fields.variable("list"), [
            Fields.variable("a"),
            Fields.literal("b"),
            Fields.literal(3),
            Fields.literal(Link.file("4", false)),
        ])
    );
});
