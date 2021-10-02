// <-- regexreplace() -->

import { parseEval } from "test/common";

describe("regexreplace()", () => {
    test("letter", () => expect(parseEval('regexreplace("yes", "y", "no")')).toEqual("noes"));
    test("full", () => expect(parseEval('regexreplace("yes", "yes", "no")')).toEqual("no"));
    test("regex", () => expect(parseEval('regexreplace("yes", ".+", "no")')).toEqual("no"));
});

// <-- containsword() -->

describe("containsword()", () => {
    test("single word", () => expect(parseEval('containsword("yes", "yes")')).toEqual(true));
    test("two word", () => expect(parseEval('containsword("yes no", "no")')).toEqual(true));
    test("negative two word", () => expect(parseEval('containsword("yes no", "maybe")')).toEqual(false));
    test("subword", () => expect(parseEval('containsword("Hello there, chap!", "the")')).toEqual(false));
    test("punctuation", () => expect(parseEval('containsword("Hello there, chap!", "there")')).toEqual(true));
    test("case insensitive", () => expect(parseEval('containsword("Hello there, chap!", "hello")')).toEqual(true));
    test("case insensitive 2", () => expect(parseEval('containsword("Hello there, chap!", "HELLO")')).toEqual(true));
});

// <-- regexmatch() -->

describe("regexmatch()", () => {
    test(".+", () => expect(parseEval('regexmatch(".+", "stuff")')).toEqual(true));
    test(".+ empty", () => expect(parseEval('regexmatch(".+", "")')).toEqual(false));
    test(".* empty", () => expect(parseEval('regexmatch(".*", "")')).toEqual(true));
    test("word", () => expect(parseEval('regexmatch("\\w+", "m3me")')).toEqual(true));
    test("whitespace", () => expect(parseEval('regexmatch("\\s+", "  ")')).toEqual(true));
    test("exact", () => expect(parseEval('regexmatch("what", "what")')).toEqual(true));
});

// <-- replace() -- >

describe("replace()", () => {
    test("letter", () => expect(parseEval('replace("hello", "h", "me")')).toEqual("meello"));
    test("full", () => expect(parseEval('replace("meep", "meep", "pleh")')).toEqual("pleh"));
    test("ignores regex", () => expect(parseEval('replace("x.z", "x.", "z$")')).toEqual("z$z"));
    test("ignores regex dot", () => expect(parseEval('replace("x.z", ".", "z")')).toEqual("xzz"));
});

// <-- lower/upper() -->

describe("lower()", () => {
    test("idempotent", () => expect(parseEval('lower("hello")')).toEqual("hello"));
    test("Hello", () => expect(parseEval('lower("Hello")')).toEqual("hello"));
});

describe("upper()", () => {
    test("Hello", () => expect(parseEval('upper("Hello")')).toEqual("HELLO"));
    test("hello", () => expect(parseEval('upper("hello")')).toEqual("HELLO"));
    test("idempotent", () => expect(parseEval('upper("HELLO")')).toEqual("HELLO"));
});

// <-- split() -->

test("split(string, string)", () => {
    expect(parseEval(`split("hello world", " ")`)).toEqual(parseEval(`list("hello", "world")`));
    expect(parseEval(`split("hello world", "( )")`)).toEqual(parseEval(`list("hello", " ", "world")`));
    expect(parseEval(`split("hello  world", "\\s+")`)).toEqual(parseEval(`list("hello", "world")`));
    expect(parseEval(`split("hello world", "x")`)).toEqual(parseEval(`list("hello world")`));
    expect(parseEval(`split("hello world", "( )(x)?")`)).toEqual(parseEval(`list("hello", " ", "", "world")`));
    expect(parseEval(`split("hello there world", "(t?here)")`)).toEqual(parseEval(`list("hello ", "there", " world")`));
    expect(parseEval(`split("hello there world", "( )(x)?")`)).toEqual(
        parseEval(`list("hello", " ", "", "there", " ", "", "world")`)
    );
});

test("split(string, string, limit)", () => {
    expect(parseEval(`split("hello world", " ", 0)`)).toEqual(parseEval(`list()`));
    expect(parseEval(`split("hello world", " ", 1)`)).toEqual(parseEval(`list("hello")`));
    expect(parseEval(`split("hello world", " ", 3)`)).toEqual(parseEval(`list("hello", "world")`));
    expect(parseEval(`split("hello world", "( )", 2)`)).toEqual(parseEval(`list("hello", " ")`));
});

// <-- startswith()/endswith() -->

describe("startswith()", () => {
    test("(yes, ye)", () => expect(parseEval(`startswith("yes", "ye")`)).toEqual(true));
    test("(Yes, ye)", () => expect(parseEval(`startswith("Yes", "ye")`)).toEqual(false));
    test("(yes, no)", () => expect(parseEval(`startswith("yes", "no")`)).toEqual(false));
});

describe("endswith()", () => {
    test("(yes, ye)", () => expect(parseEval(`endswith("yes", "ye")`)).toEqual(false));
    test("(yes, es)", () => expect(parseEval(`endswith("yes", "es")`)).toEqual(true));
    test("(yes, no)", () => expect(parseEval(`endswith("yes", "no")`)).toEqual(false));
});

// <-- padleft()/padright() -->

describe("padleft()", () => {
    test("(hello, 10)", () => expect(parseEval(`padleft("hello", 10)`)).toEqual("     hello"));
    test("(hello, 7)", () => expect(parseEval(`padleft("hello", 7)`)).toEqual("  hello"));
    test("(hello, 7, x)", () => expect(parseEval(`padleft("hello", 7, "x")`)).toEqual("xxhello"));
    test("(, 1)", () => expect(parseEval(`padleft("", 1)`)).toEqual(" "));
});

describe("padright()", () => {
    test("(hello, 10)", () => expect(parseEval(`padright("hello", 10)`)).toEqual("hello     "));
    test("(hello, 7)", () => expect(parseEval(`padright("hello", 7)`)).toEqual("hello  "));
    test("(hello, 7, x)", () => expect(parseEval(`padright("hello", 7, "x")`)).toEqual("helloxx"));
    test("(, 1)", () => expect(parseEval(`padright("", 1)`)).toEqual(" "));
});
