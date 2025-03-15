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

describe("unique()", () => {
    test("empty", () => expectEvals("unique([])", []));
    test("single", () => expectEvals("unique([1])", [1]));
    test("multiple unique", () => expectEvals("unique([1, 1, 1])", [1]));
    test("multiple same", () => expectEvals("unique([1, 3, 7, 3, 1])", [1, 3, 7]));
});

describe("min()", () => {
    test("empty", () => expectEvals("min()", null));
    test("single", () => expectEvals("min(6)", 6));
    test("multiple", () => expectEvals("min(6, 9, 12)", 6));
    test("list empty", () => expectEvals("min([])", null));
    test("list multiple", () => expectEvals("min([1, 2, 3])", 1));
});

describe("minby()", () => {
    test("empty", () => expectEvals("minby([], (k) => k)", null));
    test("single", () => expectEvals("minby([1], (k) => k)", 1));
    test("multiple", () => expectEvals("minby([1, 2, 3], (k) => 0 - k)", 3));
});

describe("max()", () => {
    test("empty", () => expectEvals("max()", null));
    test("single", () => expectEvals("max(6)", 6));
    test("multiple", () => expectEvals("max(6, 9, 12)", 12));
    test("list empty", () => expectEvals("max([])", null));
    test("list multiple", () => expectEvals("max([1, 2, 3])", 3));
});

describe("maxby()", () => {
    test("empty", () => expectEvals("maxby([], (k) => k)", null));
    test("single", () => expectEvals("maxby([1], (k) => k)", 1));
    test("multiple", () => expectEvals("maxby([1, 2, 3], (k) => 0 - k)", 1));
});

describe("sum()", () => {
    test("number list", () => expectEvals("sum([2, 3, 1])", 6));
    test("string list", () => expectEvals('sum(["a", "b", "c"])', "abc"));
    test("empty list", () => expectEvals("sum([])", null));
});

describe("average()", () => {
    test("number list", () => expectEvals("average([2, 3, 1])", 2));
    test("number list", () => expectEvals("average(nonnull([2, 3, null, 1]))", 2));
    test("empty list", () => expectEvals("average([])", null));
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

        expectEvals('all(regextest("a+", list("a", "aaaa")))', true);
        expectEvals('all(regextest("a+", list("a", "aaab")))', true);
        expectEvals('any(regextest("a+", list("a", "aaab")))', true);
    });
});

describe("nonnull()", () => {
    test("empty", () => expectEvals("nonnull([])", []));
    test("[null, false]", () => expectEvals("nonnull([null, false])", [false]));
});

describe("firstvalue()", () => {
    test("empty", () => expectEvals("firstvalue([])", null));
    test("null", () => expectEvals("firstvalue(null)", null));
    test("[1, 2, 3]", () => expectEvals("firstvalue([1, 2, 3])", 1));
    test("[null, 1, 2]", () => expectEvals("firstvalue([null, 1, 2])", 1));
});
