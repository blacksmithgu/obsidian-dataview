import { parseEval } from "test/common";

test("Evaluate meta(link).display", () => {
    expect(parseEval(`meta([[2021-11-01|Displayed link text]]).display`)).toEqual("Displayed link text");
    expect(parseEval(`meta([[2021-11-01]]).display`)).toBeNull;
});

test("Evaluate meta(link).path", () => {
    expect(parseEval(`meta([[My Project#Next Actions]]).path`)).toEqual("My Project");
    expect(parseEval(`meta([[My Project#^9bcbe8]]).path`)).toEqual("My Project");
    expect(parseEval(`meta([[My Project]]).path`)).toEqual("My Project");
});

test("Evaluate meta(link).subpath", () => {
    expect(parseEval(`meta([[My Project#Next Actions]]).subpath`)).toEqual("Next Actions");
    expect(parseEval(`meta([[My Project#^9bcbe8]]).subpath`)).toEqual("9bcbe8");
    expect(parseEval(`meta([[My Project]]).subpath`)).toBeNull;
});

test("Evaluate meta(link).type", () => {
    expect(parseEval(`meta([[My Project]]).type`)).toEqual("file");
    expect(parseEval(`meta([[My Project#Next Actions]]).type`)).toEqual("header");
    expect(parseEval(`meta([[My Project#^9bcbe8]]).type`)).toEqual("block");
});
