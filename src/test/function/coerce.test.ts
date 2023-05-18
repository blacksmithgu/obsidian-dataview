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

test("list()", () => {
    expectEvals("list(1, 2, 3)", [1, 2, 3]);
    expectEvals("list()", []);
});

test("object()", () => {
    expect(parseEval("object()")).toEqual({});
    expect(parseEval('object("hello", 1)')).toEqual({ hello: 1 });
});
