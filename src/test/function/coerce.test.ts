import { DateTime } from "luxon";
import { expectEvals, parseEval } from "test/common";

test("Evaluate number()", () => {
    expect(parseEval('number("hmm")')).toEqual(null);
    expect(parseEval("number(34)")).toEqual(34);
    expect(parseEval('number("34")')).toEqual(34);
    expect(parseEval('number("17 years")')).toEqual(17);
    expect(parseEval('number("-19")')).toEqual(-19);
});

test("Evaluate date()", () => {
    expect(parseEval("date([[2020-04-18]])")).toEqual(DateTime.fromObject({ year: 2020, month: 4, day: 18 }));
    expect(parseEval("date([[Place|2021-04]])")).toEqual(DateTime.fromObject({ year: 2021, month: 4, day: 1 }));
});

test("Evaluate list()", () => {
    expectEvals("list(1, 2, 3)", [1, 2, 3]);
    expectEvals("list()", []);
});

test("Evaluate object()", () => {
    expect(parseEval("object()")).toEqual({});
    expect(parseEval('object("hello", 1)')).toEqual({ hello: 1 });
});
