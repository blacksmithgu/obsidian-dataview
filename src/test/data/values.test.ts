import { Values, Link } from "data-model/value";

describe("Links", () => {
    describe("Comparisons", () => {
        test("Same File", () => expect(Link.file("test").equals(Link.file("test"))).toBeTruthy());
        test("Different File", () => expect(Link.file("test").equals(Link.file("test2"))).toBeFalsy());
        test("Different Subpath", () => expect(Link.file("test").equals(Link.header("test", "Hello"))).toBeFalsy());
        test("Different Subpath Type", () =>
            expect(Link.header("test", "abc").equals(Link.block("test", "abc"))).toBeFalsy());
    });

    describe("General Comparisons", () => {
        test("Same File", () => expect(Values.compareValue(Link.file("test"), Link.file("test"))).toBe(0));
        test("Different File", () =>
            expect(Values.compareValue(Link.file("test"), Link.file("test2"))).toBeLessThan(0));
        test("Different Subpath", () =>
            expect(Values.compareValue(Link.file("test"), Link.header("test", "Hello"))).toBeLessThan(0));
        test("Different Subpath Type", () =>
            expect(Values.compareValue(Link.header("test", "abc"), Link.block("test", "abc"))).toBeTruthy());
    });
});
