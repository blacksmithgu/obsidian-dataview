import { IndexMap } from "data/index";

// TODO: Replace this with a mock that actually works when expanding vault tests.
jest.mock("data/import/import-manager");

test("Simple Set/Get", () => {
    let index = new IndexMap();
    index.set("test", new Set(["one", "two"]));
    index.set("test2", new Set(["two"]));

    expect(index.get("test")).toEqual(new Set(["one", "two"]));
    expect(index.get("test2")).toEqual(new Set(["two"]));
});

test("Inverted Get", () => {
    let index = new IndexMap();
    index.set("test", new Set(["a", "b", "c"]));
    index.set("test2", new Set(["a", "c"]));
    index.set("test3", new Set([]));

    expect(index.getInverse("a")).toEqual(new Set(["test", "test2"]));
    expect(index.getInverse("b")).toEqual(new Set(["test"]));
    expect(index.getInverse("")).toEqual(new Set());
});
