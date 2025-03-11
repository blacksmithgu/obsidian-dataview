// <-- Functions -->
// <-- Function vectorization -->

import { DateTime } from "luxon";
import { DefaultFunctions } from "expression/functions";
import { parseEval, simpleContext } from "test/common";

test("Evaluate lower(list)", () => {
    expect(parseEval('lower(list("A", "B"))')).toEqual(["a", "b"]);
});

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

// <-- contains() -->

test("Evaluate contains(object)", () => {
    expect(parseEval('contains(object("hello", 1), "hello")')).toEqual(true);
    expect(parseEval('contains(object("hello", 1), "no")')).toEqual(false);
});

test("Evaluate contains(array)", () => {
    expect(parseEval('contains(list("hello", 1), "hello")')).toEqual(true);
    expect(parseEval('contains(list("hello", 1), 6)')).toEqual(false);
});

test("Evaluate fuzzy contains(array)", () => {
    expect(parseEval(`contains(list("hello"), "he")`)).toEqual(true);
    expect(parseEval(`contains(list("hello"), "no")`)).toEqual(false);
});

test("Evaluate contains(string)", () => {
    expect(parseEval('contains("hello", "hello")')).toEqual(true);
    expect(parseEval('contains("meep", "me")')).toEqual(true);
    expect(parseEval('contains("hello", "xd")')).toEqual(false);
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

// <-- flat() -->

test("Evaluate flat()", () => {
    expect(parseEval("flat(list(1, 2, 3, list(11, 12)))")).toEqual(parseEval("list(1,2,3,11,12)"));
    expect(parseEval("flat(list(1, list(21, list(221, 222)), 3, list(11, 12)))")).toEqual(
        parseEval("list(1,21,list(221,222),3,11,12)")
    ); // flat(...)
    expect(parseEval("flat(list(1, list(2, list(3, list(4, list(5))))), 3)")).toEqual(
        parseEval("list(1,2,3,4,list(5))")
    ); // flat(..., 3)
    expect(parseEval("flat(list(1, list(2, list(3, list(4, list(5))))), 10)")).toEqual(parseEval("list(1,2,3,4,5)")); // flat(..., 10)
});

// <-- slice() -->

test("Evaluate slice()", () => {
    expect(parseEval("slice(list(1, 2, 3, 4, 5), 3)")).toEqual(parseEval("list(4, 5)")); // slice(..., 3)
    expect(parseEval("slice(list(1, 2, 3, 4, 5), 0, 2)")).toEqual(parseEval("list(1, 2)")); // slice(..., 0, 2)
    expect(parseEval("slice(list(1, 2, 3, 4, 5), -2)")).toEqual(parseEval("list(4, 5)")); // slice(..., -2)
    expect(parseEval("slice(list(1, 2, 3, 4, 5), -1, 1)")).toEqual(parseEval("list()")); // slice(..., -1, 1)
    expect(parseEval("slice(list(1, 2, 3, 4, 5))")).toEqual(parseEval("list(1, 2, 3, 4, 5)")); // slice(...)
    expect(parseEval('slice(list(date("2021-01-01"), date("2022-02-02"), date("2023-03-03")), -2)')).toEqual([
        DateTime.fromObject({ year: 2022, month: 2, day: 2 }),
        DateTime.fromObject({ year: 2023, month: 3, day: 3 }),
    ]); // slice(date list, -2)
    expect(parseEval('slice(["ant", "bison", "camel", "duck", "elephant"], -3)')).toEqual([
        "camel",
        "duck",
        "elephant",
    ]); // slice(string list, -3)
});

// <-- sort() -->

describe("sort()", () => {
    test("Evaluate sort(list)", () => {
        expect(parseEval("sort(list(2, 3, 1))")).toEqual(parseEval("list(1, 2, 3)"));
        expect(parseEval('sort(list("a", "c", "b"))')).toEqual(parseEval('list("a", "b", "c")'));
    });

    test("Evaluate sort(list, func)", () => {
        expect(parseEval("sort(list(2, 3, 1), (k) => 0-k)")).toEqual(parseEval("list(3, 2, 1)"));
    });
});

// <-- display() -->

test("Evaluate display()", () => {
    expect(parseEval('display("test")')).toEqual("test");
    expect(parseEval('display("[displayname](http://example.com)")')).toEqual("displayname");
    expect(parseEval('display("[[test]]")')).toEqual("test");
    expect(parseEval('display("[[test|displayname]]")')).toEqual("displayname");
    expect(parseEval('display("long [[test]] **with** [[test2|multiple]] [links](http://example.com)")')).toEqual(
        "long test with multiple links"
    );
    expect(parseEval("display(1)")).toEqual("1");
    expect(parseEval("display(true)")).toEqual("true");
    expect(parseEval("display(null)")).toEqual("");
    expect(parseEval('display(date("2024-11-18"))')).toEqual("November 18, 2024");
    expect(parseEval('display(dur("7 hours"))')).toEqual("7 hours");
    expect(parseEval('display(link("path/to/file.md"))')).toEqual("file");
    expect(parseEval('display(link("path/to/file.md", "displayname"))')).toEqual("displayname");
    expect(parseEval('display(list("test", 2, link("file.md")))')).toEqual("test, 2, file");
});

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
});

test("Evaluate hash()", () => {
    expect(DefaultFunctions.hash(simpleContext(), "2024-03-17", "")).toEqual(3259376374957153);
    expect(DefaultFunctions.hash(simpleContext(), "2024-03-17", 2)).toEqual(271608741894590);
    expect(DefaultFunctions.hash(simpleContext(), "2024-03-17", "Home")).toEqual(3041844187830523);
    expect(DefaultFunctions.hash(simpleContext(), "2024-03-17", "note a1", 21)).toEqual(1143088188331616);
});

// <-- extract() -->

test("Evaluate 1 field extract()", () => {
    let res = parseEval('extract(object("mtime", 1), "mtime")');
    expect(res).toEqual({ mtime: 1 });
});

test("Evaluate 2 field extract()", () => {
    let res = parseEval('extract(object("mtime", 1, "yes", "hello"), "yes", "mtime")');
    expect(res).toEqual({
        yes: "hello",
        mtime: 1,
    });
});

// <-- nonnull() -->

test("Evaluate nonnull()", () => {
    expect(DefaultFunctions.nonnull(simpleContext(), null, null, 1)).toEqual([1]);
    expect(DefaultFunctions.nonnull(simpleContext(), "yes")).toEqual(["yes"]);
});

// <-- date() -->

test("Evaluate date()", () => {
    expect(parseEval("date([[2020-04-18]])")).toEqual(DateTime.fromObject({ year: 2020, month: 4, day: 18 }));
    expect(parseEval("date([[Place|2021-04]])")).toEqual(DateTime.fromObject({ year: 2021, month: 4, day: 1 }));
    expect(parseEval('date("12/31/2022", "MM/dd/yyyy")')).toEqual(
        DateTime.fromObject({ year: 2022, month: 12, day: 31 })
    );
    expect(parseEval('date("210313", "yyMMdd")')).toEqual(DateTime.fromObject({ year: 2021, month: 3, day: 13 }));
    expect(parseEval('date("946778645012","x")')).toEqual(DateTime.fromMillis(946778645012));
    expect(parseEval('date("946778645","X")')).toEqual(DateTime.fromMillis(946778645000));
    expect(DefaultFunctions.date(simpleContext(), null, "MM/dd/yyyy")).toEqual(null);
});
