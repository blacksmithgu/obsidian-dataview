import { expectEvals } from "test/common";

describe("map()", () => {
    test("empty list", () => expectEvals("map([], (k) => 6)", []));
    test("number list", () => expectEvals("map([1, 2, 3], (k) => k + 4)", [5, 6, 7]));
    test("string list", () => expectEvals('map(["a", "be", "ced"], (k) => length(k))', [1, 2, 3]));
});

describe("filter()", () => {
    test("empty list", () => expectEvals("filter(list(), (k) => true)", []));
    test("number list", () => expectEvals("filter(list(1, 2, 3), (k) => k >= 2)", [2, 3]));
});

describe("sum()", () => {
    test("number list", () => expectEvals("sum(list(2, 3, 1))", 6));
    test("string list", () => expectEvals('sum(list("a", "b", "c"))', "abc"));
    test("empty list", () => expectEvals("sum(list())", null));
});

describe("any()", () => {
    test("true, false", () => expectEvals("any(true, false)", true));
    test("[true, false]", () => expectEvals("any(list(true, false))", true));
});

describe("all()", () => {
    test("true, false", () => expectEvals("all(true, false)", false));
    test("true, [false]", () => expectEvals("all(true, list(false))", true));
    test("[true, false]", () => expectEvals("all(list(true, false))", false));

    test("vectorized", () => {
        expectEvals('all(regexmatch("a+", list("a", "aaaa")))', true);
        expectEvals('all(regexmatch("a+", list("a", "aaab")))', false);
        expectEvals('any(regexmatch("a+", list("a", "aaab")))', true);
    });
});
