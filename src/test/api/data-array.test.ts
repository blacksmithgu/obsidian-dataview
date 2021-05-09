import { DataArray } from "src/api/data-array";

test("concat", () => {
    expect(da([1, 2]).concat(da([3, 4])).array()).toEqual([1, 2, 3, 4]);
    expect(da(["yes"]).concat(da([])).array()).toEqual(["yes"]);
});

function da<T>(val: T[]): DataArray<T> {
    return DataArray.wrap(val);
}
