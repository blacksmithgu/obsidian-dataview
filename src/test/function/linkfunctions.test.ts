import { parseEval } from "test/common";

test("Evaluate display(link)", () => {
    expect(parseEval(`display([[2021-11-01|Displayed link text]])`)).toEqual("Displayed link text");
    expect(parseEval(`display([[2021-11-01]])`)).toBeNull;
})

test("Evaluate path(link)", () => {
    expect(parseEval(`path([[My Project#Next Actions]])`)).toEqual("My Project");
    expect(parseEval(`path([[My Project#^9bcbe8]])`)).toEqual("My Project");
    expect(parseEval(`path([[My Project]])`)).toEqual("My Project");
});

test("Evaluate subpath(link)", () => {
    expect(parseEval(`subpath([[My Project#Next Actions]])`)).toEqual("Next Actions");
    expect(parseEval(`subpath([[My Project#^9bcbe8]])`)).toEqual("9bcbe8");
    expect(parseEval(`subpath([[My Project]])`)).toBeNull;
});

test("Evaluate type(link)", () => {
    expect(parseEval(`type([[My Project]])`)).toEqual("file");
    expect(parseEval(`type([[My Project#Next Actions]])`)).toEqual("header");
    expect(parseEval(`type([[My Project#^9bcbe8]])`)).toEqual("block");
});
