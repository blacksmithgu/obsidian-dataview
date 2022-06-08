import { Duration } from "luxon";
import { parseEval } from "test/common";

describe("dur()", () => {
    test("8 minutes", () => expect(parseEval(`dur("8 minutes")`)).toEqual(Duration.fromObject({ minutes: 8 })));
    test("3 hrs", () => expect(parseEval(`dur("3 hrs")`)).toEqual(Duration.fromObject({ hours: 3 })));
    test("2 days, 6 minutes", () =>
        expect(parseEval(`dur("2 days, 6 minutes")`)).toEqual(Duration.fromObject({ days: 2, minutes: 6 })));
});

describe("typeof()", () => {
    test("string", () => expect(parseEval(`typeof("nice")`)).toEqual("string"));
    test("object", () => expect(parseEval(`typeof({a: 1, b: 2})`)).toEqual("object"));
    test("array", () => expect(parseEval(`typeof(["nice"])`)).toEqual("array"));
    test("number", () => expect(parseEval(`typeof(18.4)`)).toEqual("number"));
});
