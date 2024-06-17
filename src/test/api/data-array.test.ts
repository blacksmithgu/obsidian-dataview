import { DataArray } from "api/data-array";
import { DEFAULT_QUERY_SETTINGS } from "settings";

describe("where", () => {
    test("true", () =>
        expect(
            da([1, 2])
                .where(x => true)
                .array()
        ).toEqual([1, 2]));
    test("false", () =>
        expect(
            da([1, 2])
                .where(x => false)
                .array()
        ).toEqual([]));
    test("number predicate", () =>
        expect(
            da([1, 2, 3])
                .where(x => x >= 2)
                .array()
        ).toEqual([2, 3]));
});

test("filter", () =>
    expect(
        da([1, 2])
            .filter(x => true)
            .array()
    ).toEqual([1, 2]));

describe("map", () => {
    test("identity", () =>
        expect(
            da([1, 2, 3])
                .map(x => x)
                .array()
        ).toEqual([1, 2, 3]));
    test("number predicate", () =>
        expect(
            da([1, 2, 3])
                .map(x => x + 4)
                .array()
        ).toEqual([5, 6, 7]));
});

describe("flatMap", () => {
    test("identity", () =>
        expect(
            da([1, 2, 3])
                .flatMap(x => [x])
                .array()
        ).toEqual([1, 2, 3]));
    test("number predicate", () =>
        expect(
            da([1, 2, 3])
                .flatMap(x => [x, x + 1])
                .array()
        ).toEqual([1, 2, 2, 3, 3, 4]));
});

test("mutate", () =>
    expect(
        da([1, 2])
            .mutate(x => x)
            .array()
    ).toEqual([1, 2]));

describe("limit", () => {
    test("zero", () => expect(da([1, 2, 3]).limit(0).array()).toEqual([]));
    test("one", () => expect(da([1, 2, 3]).limit(1).array()).toEqual([1]));
    test("huge", () => expect(da([1, 2, 3]).limit(100).array()).toEqual([1, 2, 3]));
});

describe("slice", () => {
    test("zero", () => expect(da([1, 2, 3, 4]).slice(0, 0).array()).toEqual([]));
    test("one", () => expect(da([1, 2, 3, 4]).slice(0, 1).array()).toEqual([1]));
    test("middle", () => expect(da([1, 2, 3, 4]).slice(1, 3).array()).toEqual([2, 3]));
    test("huge", () => expect(da([1, 2, 3, 4]).slice(1, 80).array()).toEqual([2, 3, 4]));
});

describe("concat", () => {
    test("numbers", () =>
        expect(
            da([1, 2])
                .concat(da([3, 4]))
                .array()
        ).toEqual([1, 2, 3, 4]));
    test("empty", () => expect(da(["yes"]).concat(da([])).array()).toEqual(["yes"]));
});

describe("indexOf", () => {
    test("exists", () => expect(da([1, 2, 3]).indexOf(2)).toEqual(1));
    test("not exists", () => expect(da([1, 2, 3]).indexOf(4)).toEqual(-1));
});

describe("find", () => {
    test("true", () => expect(da([1, 2, 3]).find(x => true)).toEqual(1));
    test("false", () => expect(da([1, 2, 3]).find(x => false)).toEqual(undefined));
    test("number predicate", () => expect(da([1, 2, 3]).find(x => x >= 2)).toEqual(2));
});

describe("findIndex", () => {
    test("true", () => expect(da([1, 2, 3]).findIndex(x => true)).toEqual(0));
    test("false", () => expect(da([1, 2, 3]).findIndex(x => false)).toEqual(-1));
    test("number predicate", () => expect(da([1, 2, 3]).findIndex(x => x >= 2)).toEqual(1));
});

describe("includes", () => {
    test("exists", () => expect(da([1, 2, 3]).includes(2)).toEqual(true));
    test("not exists", () => expect(da([1, 2, 3]).includes(4)).toEqual(false));
});

describe("join", () => {
    test("empty", () => expect(da([]).join(", ")).toEqual(""));
    test("one", () => expect(da([1]).join(", ")).toEqual("1"));
    test("multiple", () => expect(da([1, 2, 3]).join(", ")).toEqual("1, 2, 3"));
});

describe("sort", () => {
    test("empty", () =>
        expect(
            da([])
                .sort(x => x)
                .array()
        ).toEqual([]));
    test("single", () =>
        expect(
            da([1])
                .sort(x => x)
                .array()
        ).toEqual([1]));
    test("numbers", () =>
        expect(
            da([1, 4, -1])
                .sort(x => x)
                .array()
        ).toEqual([-1, 1, 4]));
    test("negated numbers", () =>
        expect(
            da([1, 4, -1])
                .sort(x => -x)
                .array()
        ).toEqual([4, 1, -1]));
    test("reversed numbers", () =>
        expect(
            da([1, 4, -1])
                .sort(x => x, "desc")
                .array()
        ).toEqual([4, 1, -1]));
    test("objects", () =>
        expect(
            da([{ x: 1 }, { x: 4 }, { x: -6 }])
                .sort(x => x.x)
                .array()
        ).toEqual([{ x: -6 }, { x: 1 }, { x: 4 }]));
});

describe("distinct", () => {
    test("empty", () => expect(da([]).distinct().array()).toEqual([]));
    test("single", () => expect(da([1]).distinct().array()).toEqual([1]));
    test("multiple unique", () => expect(da([1, 1, 1]).distinct().array()).toEqual([1]));
    test("multiple same", () => expect(da([1, 3, 7, 3, 1]).distinct().array()).toEqual([1, 3, 7]));
    test("objects", () =>
        expect(
            da([{ x: 1 }, { x: 2 }, { x: 4 }])
                .distinct(x => 1)
                .array()
        ).toEqual([{ x: 1 }]));
});

describe("first", () => {
    test("empty", () => expect(da([]).first()).toEqual(undefined));
    test("nonempty", () => expect(da([1, 2, 3]).first()).toEqual(1));
});

describe("last", () => {
    test("empty", () => expect(da([]).last()).toEqual(undefined));
    test("nonempty", () => expect(da([1, 2, 3]).last()).toEqual(3));
});

describe("sum", () => {
    test("empty", () => expect(da([]).sum()).toEqual(0));
    test("numbers", () => expect(da([1, 10, 2]).sum()).toEqual(13));
});

describe("avg", () => {
    test("empty", () => expect(da([]).avg()).toEqual(NaN));
    test("numbers", () => expect(da([5, 10, 15]).avg()).toEqual(10));
});

describe("min", () => {
    test("empty", () => expect(da([]).min()).toEqual(Infinity));
    test("numbers", () => expect(da([14, 10, 15]).min()).toEqual(10));
});

describe("max", () => {
    test("empty", () => expect(da([]).max()).toEqual(-Infinity));
    test("numbers", () => expect(da([14, 10, 15]).max()).toEqual(15));
});

/** Utility function for quickly creating a data array. */
function da<T>(val: T[]): DataArray<T> {
    return DataArray.wrap(val, DEFAULT_QUERY_SETTINGS);
}
