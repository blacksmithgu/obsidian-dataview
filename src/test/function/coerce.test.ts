import { DateTime } from "luxon";
import { expectEvals, parseEval } from "test/common";

test("number()", () => {
    expect(parseEval('number("hmm")')).toEqual(null);
    expect(parseEval("number(34)")).toEqual(34);
    expect(parseEval('number("34")')).toEqual(34);
    expect(parseEval('number("17 years")')).toEqual(17);
    expect(parseEval('number("-19")')).toEqual(-19);
});

describe("string()", () => {
    test("number", () => expect(parseEval(`string(18)`)).toEqual("18"));
});

test("date()", () => {
    expect(parseEval("date([[2020-04-18]])")).toEqual(DateTime.fromObject({ year: 2020, month: 4, day: 18 }));
    expect(parseEval("date([[Place|2021-04]])")).toEqual(DateTime.fromObject({ year: 2021, month: 4, day: 1 }));
    expect(parseEval('date("12/31/2022", "MM/dd/yyyy")')).toEqual(DateTime.fromObject({ year: 2022, month: 12, day: 31 }));
    expect(parseEval('date("210331", "yyMMdd")')).toEqual(DateTime.fromObject({ year: 2022, month: 3, day: 12 }));   
});

test("list()", () => {
    expectEvals("list(1, 2, 3)", [1, 2, 3]);
    expectEvals("list()", []);
});

test("object()", () => {
    expect(parseEval("object()")).toEqual({});
    expect(parseEval('object("hello", 1)')).toEqual({ hello: 1 });
});
