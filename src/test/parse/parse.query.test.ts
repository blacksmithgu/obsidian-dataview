import { TableQuery, ListQuery, CalendarQuery, SortByStep, QueryFields, Query } from "query/query";
import { QUERY_LANGUAGE, parseQuery } from "query/parse";
import { Sources } from "data-index/source";
import { DEFAULT_QUERY_SETTINGS } from "settings";
import { Fields } from "expression/field";

function testQueryTypeAlone(name: string) {
    const upper = name.toUpperCase();
    const lower = name.toLowerCase();

    function expectQ(q: Query) {
        expect(q.header.type).toBe(lower);
    }

    const tests = [upper, lower].flatMap(type => ["", " ", "\n", " \n", "\n "].map(suffix => type + suffix));

    test(`Just ${upper}`, () => {
        for (const test of tests) {
            expectQ(parseQuery(test).orElseThrow());
        }
    });
}

test("Parse Query Type", () => {
    let unknown = QUERY_LANGUAGE.queryType.parse("vehicle");
    expect(unknown.status).toBe(false);

    let list = QUERY_LANGUAGE.queryType.tryParse("list");
    expect(list).toEqual("list");

    let listUpper = QUERY_LANGUAGE.queryType.tryParse("lIsT");
    expect(listUpper).toEqual("list");
});

// <-- Source Types -->
test("Link Source", () => {
    expect(QUERY_LANGUAGE.query.tryParse("list from [[Stuff]]")).toEqual({
        header: { type: "list", showId: true },
        source: Sources.link("Stuff", true),
        settings: DEFAULT_QUERY_SETTINGS,
        operations: [],
    });
});

// <-- Comments -->
describe("Comments", () => {
    test("Valid Comments", () => {
        let commentWithSpace = QUERY_LANGUAGE.comment.tryParse("// This is a comment");
        expect(commentWithSpace).toEqual("This is a comment");

        let commentNoSpace = QUERY_LANGUAGE.comment.tryParse("//This is a comment");
        expect(commentNoSpace).toEqual("This is a comment");

        let empty = QUERY_LANGUAGE.comment.tryParse("//");
        expect(empty).toEqual("");

        let emptyWithSpace = QUERY_LANGUAGE.comment.tryParse("// ");
        expect(emptyWithSpace).toEqual("");
    });

    test("Invalid comment in quotes", () => {
        let commentSolo = QUERY_LANGUAGE.comment.parse('"// This is not a comment"');
        if (!commentSolo.status) {
            expect(commentSolo.expected).toEqual(["Not a comment"]);
        } else {
            fail("Solo comment should not have parsed");
        }

        let commentMiddle = QUERY_LANGUAGE.comment.parse('"The is before the comment // This is not a comment"');
        if (!commentMiddle.status) {
            expect(commentMiddle.expected).toEqual(["Not a comment"]);
        } else {
            fail("Comment in the middle of a string should not have parsed");
        }
    });
});

// <-- Fields -->

describe("Named Fields", () => {
    test("Explicit", () => {
        let simple = QUERY_LANGUAGE.namedField.tryParse("time-played");
        expect(simple).toEqual(QueryFields.named("time-played", Fields.variable("time-played")));

        let complex = QUERY_LANGUAGE.namedField.tryParse("(time-played + 4) as something");
        expect(complex).toEqual(
            QueryFields.named("something", Fields.binaryOp(Fields.variable("time-played"), "+", Fields.literal(4)))
        );
    });

    test("Implicit", () => {
        let simple = QUERY_LANGUAGE.namedField.tryParse("8 + 4");
        expect(simple).toEqual(QueryFields.named("8 + 4", Fields.binaryOp(Fields.literal(8), "+", Fields.literal(4))));
    });
});

test("Sort Fields", () => {
    let simple = QUERY_LANGUAGE.sortField.tryParse("time-played DESC");
    expect(simple).toEqual(QueryFields.sortBy(Fields.variable("time-played"), "descending"));

    let complex = QUERY_LANGUAGE.sortField.tryParse('(time-played - "where")');
    expect(complex).toEqual(
        QueryFields.sortBy(Fields.binaryOp(Fields.variable("time-played"), "-", Fields.literal("where")), "ascending")
    );
});

// <-- Full Queries -->

describe("Task Queries", () => {
    testQueryTypeAlone("task");

    test("Task query with no fields", () => {
        let q = parseQuery("task from #games").orElseThrow();
        expect(typeof q).toBe("object");
        expect(q.header.type).toBe("task");
        expect(q.source).toEqual(Sources.tag("#games"));
    });
});

describe("List Queries", () => {
    testQueryTypeAlone("list");

    test("With Format", () => {
        let query = parseQuery("LIST file.name FROM #games").orElseThrow();
        expect(query.header.type).toBe("list");
        expect((query.header as ListQuery).format).toEqual(Fields.indexVariable("file.name"));
    });

    test("WITHOUT ID", () => {
        let query = parseQuery("LIST WITHOUT ID file.name FROM #games").orElseThrow();
        expect(query.header.type).toBe("list");
        expect((query.header as ListQuery).showId).toBe(false);
        expect((query.header as ListQuery).format).toEqual(Fields.indexVariable("file.name"));
    });
});

describe("Table Queries", () => {
    testQueryTypeAlone("table");

    test("Minimal Query", () => {
        let simple = parseQuery("TABLE time-played, rating, length FROM #games").orElseThrow();
        expect(simple.header.type).toBe("table");
        expect((simple.header as TableQuery).fields).toEqual([
            QueryFields.named("time-played", Fields.variable("time-played")),
            QueryFields.named("rating", Fields.variable("rating")),
            QueryFields.named("length", Fields.variable("length")),
        ]);
        expect(simple.source).toEqual(Sources.tag("#games"));
        expect((simple.header as TableQuery).showId).toBe(true);
    });

    test("Fat Query", () => {
        let fat = parseQuery(
            "TABLE (time-played + 100) as long, rating as rate, length\n" +
                "FROM #games or #gaming\n" +
                "WHERE long > 150 and rate - 10 < 40\n" +
                "SORT length + 8 + 4 DESCENDING, long ASC"
        ).orElseThrow();
        expect(fat.header.type).toBe("table");
        expect((fat.header as TableQuery).fields.length).toBe(3);
        expect(fat.source).toEqual(Sources.binaryOp(Sources.tag("#games"), "|", Sources.tag("#gaming")));
        expect((fat.operations[1] as SortByStep).fields.length).toBe(2);
    });

    test("Commented Query", () => {
        let commented = parseQuery(
            "// This is a comment at the beginning\n" +
                "TABLE (time-played + 100) as long, rating as rate, length\n" +
                "// This is a comment\n" +
                "// This is a second comment\n" +
                "FROM #games or #gaming  // This is an inline comment\n" +
                "// This is a third comment\n" +
                "WHERE long > 150 and rate - 10 < 40\n" +
                "// This is a fourth comment\n" +
                "\n" +
                "   // This is a comment with whitespace prior\n" +
                "SORT length + 8 + 4 DESCENDING, long ASC\n" +
                "// This is a comment at the end"
        ).orElseThrow();
        expect(commented.header.type).toBe("table");
        expect((commented.header as TableQuery).fields.length).toBe(3);
        expect(commented.source).toEqual(Sources.binaryOp(Sources.tag("#games"), "|", Sources.tag("#gaming")));
        expect((commented.operations[1] as SortByStep).fields.length).toBe(2);
    });

    test("WITHOUT ID", () => {
        let q = parseQuery("TABLE WITHOUT ID name, value").orElseThrow();
        expect(typeof q).toBe("object");
        expect(q.header.type).toBe("table");

        let tq = q.header as TableQuery;
        expect(tq.showId).toBe(false);
    });

    test("WITHOUT ID (weird spacing)", () => {
        let q = parseQuery("TABLE    WITHOUT     ID   name, value").orElseThrow();
        expect(typeof q).toBe("object");
        expect(q.header.type).toBe("table");

        let tq = q.header as TableQuery;
        expect(tq.showId).toBe(false);
    });
});

describe("Calendar Queries", () => {
    test("Minimal Query", () => {
        let simple = parseQuery("CALENDAR my-date FROM #games\n" + "WHERE foo > 100").orElseThrow();
        expect(simple.header.type).toBe("calendar");
        expect((simple.header as CalendarQuery).field).toEqual(
            QueryFields.named("my-date", Fields.variable("my-date"))
        );
        expect(simple.source).toEqual(Sources.tag("#games"));
    });
});
