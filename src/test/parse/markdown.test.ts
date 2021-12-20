/** Extensively tests the built-in markdown tokenizer and parser. */

import { classifyLine, extractLinks, extractTags, markdownFile, reduceIndent, splitIndent } from "data/parse/markdown";
import { Link } from "data/value";

describe("Split Indent", () => {
    test("None", () => expect(splitIndent("hello")).toEqual([0, "hello"]));
    test("1 Space", () => expect(splitIndent(" hello")).toEqual([1, "hello"]));
    test("3 Space", () => expect(splitIndent("   hello")).toEqual([3, "hello"]));
    test("1 Tab", () => expect(splitIndent("\thello")).toEqual([4, "hello"]));
    test("2 Tab", () => expect(splitIndent("\t\thello")).toEqual([8, "hello"]));
    test("2 Tab, 2 Space", () => expect(splitIndent("\t  \thello")).toEqual([10, "hello"]));
});

describe("Reduce Indent", () => {
    test("None", () => expect(reduceIndent("hello", 0)).toEqual("hello"));
    test("No-op", () => expect(reduceIndent(" hello", 0)).toEqual(" hello"));
    test("1 -> 0", () => expect(reduceIndent(" hello", 1)).toEqual("hello"));
    test("3 -> 1", () => expect(reduceIndent("   hello", 2)).toEqual(" hello"));
    test("Tab -> 0", () => expect(reduceIndent("\thello", 2)).toEqual("hello"));
});

describe("Line Classification", () => {
    test("Empty", () => expect(classifyLine("").type).toEqual("empty"));
    test("Empty With Spaces", () => expect(classifyLine("   \t   ").type).toEqual("empty"));
    test("Text", () => expect(classifyLine("hello there").type).toEqual("text"));
    test("Text And Numbers", () => expect(classifyLine("hello 21892 there!!! [[hello]]").type).toEqual("text"));
    test("Heading 1", () => expect(classifyLine("\t# Greetings").type).toEqual("heading"));
    test("Heading 3", () => expect(classifyLine("\t### Greetings").type).toEqual("heading"));
    test("Not Heading (Space)", () => expect(classifyLine("\t###Greetings").type).toEqual("text"));
    test("Blockquote", () => expect(classifyLine("> Nice!").type).toEqual("blockquote"));
});

describe("Paragraphs", () => {
    test("Single Line", () =>
        expect(markdownFile("Hello!")).toEqual([{ type: "paragraph", contents: ["Hello!"], line: 0 }]));

    test("Multiple Lines", () =>
        expect(markdownFile(" Hello! \t\n  How are you?")).toEqual([
            { type: "paragraph", contents: ["Hello!", "How are you?"], line: 0 },
        ]));

    test("Multiple Paragraphs", () =>
        expect(markdownFile(" Hello! \t\n  How are you?\n\nI'm doing fine.")).toEqual([
            { type: "paragraph", contents: ["Hello!", "How are you?"], line: 0 },
            { type: "paragraph", contents: ["I'm doing fine."], line: 3 },
        ]));
});

describe("Headings", () => {
    test("Level 1 Heading", () =>
        expect(markdownFile("# Hello!")).toEqual([
            { type: "heading", level: 1, text: "Hello!", line: 0, ruling: false },
        ]));

    test("Level 4 Heading", () =>
        expect(markdownFile("#### Hello There!")).toEqual([
            { type: "heading", level: 4, text: "Hello There!", line: 0, ruling: false },
        ]));

    test("Too Many Octothorpes", () =>
        expect(markdownFile("######## Nope.")).toEqual([{ type: "paragraph", contents: ["######## Nope."], line: 0 }]));

    test("Ruling-based Heading ('=')", () =>
        expect(markdownFile("Hello\n===")).toEqual([
            { type: "heading", level: 1, text: "Hello", line: 0, ruling: true },
        ]));

    test("Ruling-based Heading ('-')", () =>
        expect(markdownFile("Hello\n---")).toEqual([
            { type: "heading", level: 1, text: "Hello", line: 0, ruling: true },
        ]));

    test("Not Enough Dashes", () =>
        expect(markdownFile("Hello\n==")).toEqual([{ type: "paragraph", contents: ["Hello", "=="], line: 0 }]));

    test("Space In Between", () =>
        expect(markdownFile("Hello\n\n==")).toEqual([
            { type: "paragraph", contents: ["Hello"], line: 0 },
            { type: "paragraph", contents: ["=="], line: 2 },
        ]));
});

describe("Frontmatter", () => {
    test("Single Line", () => {
        expect(markdownFile("---\nok: true\n---\n")).toEqual([
            { type: "frontmatter", line: 0, contents: ["ok: true"] },
        ]);
    });

    test("Multiline", () => {
        expect(markdownFile("---\nok: true\nyes: no\n---\n")).toEqual([
            { type: "frontmatter", line: 0, contents: ["ok: true", "yes: no"] },
        ]);
    });
});

describe("Codeblocks", () => {
    test("Indented Codeblock", () => {
        expect(markdownFile("\tNice.\n\tStuff.")).toEqual([
            {
                type: "codeblock",
                delimiter: "<indented>",
                contents: ["Nice.", "Stuff."],
                indented: true,
                languages: [],
                line: 0,
            },
        ]);
    });

    test("Indented Codeblock (Reduction)", () => {
        expect(markdownFile("\t\tNice.\n\tStuff.")).toEqual([
            {
                type: "codeblock",
                delimiter: "<indented>",
                contents: ["\tNice.", "Stuff."],
                indented: true,
                languages: [],
                line: 0,
            },
        ]);
    });

    test("Delimited Codeblock", () => {
        expect(markdownFile("```hello\nNice.\nStuff.\n```")).toEqual([
            {
                type: "codeblock",
                delimiter: "```",
                contents: ["Nice.", "Stuff."],
                indented: false,
                languages: ["hello"],
                line: 0,
            },
        ]);
    });

    test("Delimited Codeblock (Indented)", () => {
        expect(markdownFile("```hello\n\tNice.\nStuff.\n```")).toEqual([
            {
                type: "codeblock",
                delimiter: "```",
                contents: ["\tNice.", "Stuff."],
                indented: false,
                languages: ["hello"],
                line: 0,
            },
        ]);
    });

    test("Combination Paragraph and Codeblock", () => {
        expect(markdownFile("Greetings.\n```hello\n\tNice.\nStuff.\n```")).toEqual([
            { type: "paragraph", contents: ["Greetings."], line: 0 },
            {
                type: "codeblock",
                delimiter: "```",
                contents: ["\tNice.", "Stuff."],
                indented: false,
                languages: ["hello"],
                line: 1,
            },
        ]);
    });
});

describe("Block Quotes", () => {
    test("Single Line", () => {
        expect(markdownFile("> Nice!")).toEqual([{ type: "blockquote", contents: ["Nice!"], line: 0 }]);
    });

    test("Multiline", () => {
        expect(markdownFile("> Nice!\n>Cool!\n> Epic!")).toEqual([
            { type: "blockquote", contents: ["Nice!", "Cool!", "Epic!"], line: 0 },
        ]);
    });

    test("Multiline Independent", () => {
        expect(markdownFile("> Nice!\n>Cool!\n\n> Epic!")).toEqual([
            { type: "blockquote", contents: ["Nice!", "Cool!"], line: 0 },
            { type: "blockquote", contents: ["Epic!"], line: 3 },
        ]);
    });
});

describe("List Elements", () => {
    test("Single", () =>
        expect(markdownFile("- Hmm...")).toEqual([
            {
                type: "list",
                line: 0,
                elements: [
                    {
                        symbol: "-",
                        text: [{ type: "paragraph", contents: ["Hmm..."], line: 0 }],
                        contents: [],
                        children: [],
                        line: 0,
                        task: undefined,
                    },
                ],
            },
        ]));

    test("Double", () =>
        expect(markdownFile("- Hmm...\n- [ ] Yes, interesting.")).toEqual([
            {
                type: "list",
                line: 0,
                elements: [
                    {
                        symbol: "-",
                        text: [{ type: "paragraph", contents: ["Hmm..."], line: 0 }],
                        contents: [],
                        children: [],
                        line: 0,
                        task: undefined,
                    },
                    {
                        symbol: "-",
                        text: [{ type: "paragraph", contents: ["Yes, interesting."], line: 1 }],
                        contents: [],
                        children: [],
                        line: 1,
                        task: "",
                    },
                ],
            },
        ]));
});

describe("Tag Extraction", () => {
    let extractSimpleTags = (line: string) => {
        return extractTags(line).map(t => t.value);
    };

    test("No Tags", () => expect(extractSimpleTags("hello")).toEqual([]));
    test("No Tags (Header)", () => expect(extractSimpleTags("# hello #")).toEqual([]));
    test("1 Tag", () => expect(extractSimpleTags("#hello")).toEqual(["#hello"]));
    test("1 Tag (Spaces)", () => expect(extractSimpleTags("   #hello-there ")).toEqual(["#hello-there"]));
    test("2 Tags (Spaces)", () => expect(extractSimpleTags("   #good #riddance ")).toEqual(["#good", "#riddance"]));
});

describe("Link Extraction", () => {
    let extractSimpleLinks = (line: string) => {
        return extractLinks(line).map(t => t.value);
    };

    test("No Links", () => expect(extractSimpleLinks("!!")).toEqual([]));
    test("One Link", () => expect(extractSimpleLinks("[[Yes]]")).toEqual([Link.file("Yes")]));
    test("Two Links", () => expect(extractSimpleLinks("[[Yes]][[No]]")).toEqual([Link.file("Yes"), Link.file("No")]));
    test("Two Links (In Word)", () =>
        expect(extractSimpleLinks("[[Yes]]or[[No]]")).toEqual([Link.file("Yes"), Link.file("No")]));
    test("Two Links (Random Brackets)", () =>
        expect(extractSimpleLinks("[[Yes|Maybe]]]][[[No]]")).toEqual([
            Link.file("Yes", false, "Maybe"),
            Link.file("No"),
        ]));
});
