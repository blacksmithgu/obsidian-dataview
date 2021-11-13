import { Duration } from "luxon";
import { parseEval } from "test/common";

describe("dur()", () => {
    test("8 minutes", () => expect(parseEval(`dur("8 minutes")`)).toEqual(Duration.fromObject({ minutes: 8 })));
    test("3 hrs", () => expect(parseEval(`dur("3 hrs")`)).toEqual(Duration.fromObject({ hours: 3 })));
    test("2 days, 6 minutes", () =>
        expect(parseEval(`dur("2 days, 6 minutes")`)).toEqual(Duration.fromObject({ days: 2, minutes: 6 })));
});
