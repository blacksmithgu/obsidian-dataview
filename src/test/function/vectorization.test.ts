import { Literal } from "data-model/value";
import { parseEval } from "test/common";

describe("Single List Argument", () => {
    test("replace(list, string, string)", () => check('replace(list("yes", "re"), "e", "a")', ["yas", "ra"]));

    test("lower(list)", () => check('lower(["YES", "nO"])', ["yes", "no"]));
    test("upper(list)", () => check('upper(["okay", "yep", "1"])', ["OKAY", "YEP", "1"]));
});

describe("Multi-List Arguments", () => {
    test("replace(list, list, string)", () => check('replace(["a", "b", "c"], ["a", "b", "c"], "d")', ["d", "d", "d"]));
    test("replace(list, string, list)", () => check('replace(["a", "b", "c"], "a", ["d", "e", "f"])', ["d", "b", "c"]));
    test("replace(list, list, list)", () =>
        check('replace(["a", "b", "c"], ["a", "b", "c"], ["x", "y", "z"])', ["x", "y", "z"]));
});

function check(statement: string, result: Literal) {
    expect(parseEval(statement)).toEqual(result);
}
