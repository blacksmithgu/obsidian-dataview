import { TableQuery, ListQuery, SortByStep, QueryFields } from "src/query/query";
import { QUERY_LANGUAGE, parseQuery } from "src/query/parse";
import { Sources } from "src/data/source";
import { DEFAULT_QUERY_SETTINGS } from "src/settings";
import { Fields } from "src/expression/field";

test("Parse Query Type", () => {
    let unknown = QUERY_LANGUAGE.queryType.parse("vehicle");
    expect(unknown.status).toBe(false);

    let list = QUERY_LANGUAGE.queryType.tryParse("list");
    expect(list).toEqual('list');

    let listUpper = QUERY_LANGUAGE.queryType.tryParse("lIsT");
    expect(listUpper).toEqual('list');
});

// <-- Source Types -->
test("Link Source", () => {
    expect(QUERY_LANGUAGE.query.tryParse("list from [[Stuff]]")).toEqual({
        header: { type: 'list' },
        source: Sources.link('Stuff', true),
        settings: DEFAULT_QUERY_SETTINGS,
        operations: []
    })
});

// <-- Fields -->

test("Named Fields", () => {
    let simple = QUERY_LANGUAGE.namedField.tryParse("time-played");
    expect(simple).toEqual(QueryFields.named("time-played", Fields.variable("time-played")));

    let complex = QUERY_LANGUAGE.namedField.tryParse("(time-played + 4) as something");
    expect(complex).toEqual(QueryFields.named("something", Fields.binaryOp(Fields.variable("time-played"), '+', Fields.literal(4))));
});

test("Sort Fields", () => {
    let simple = QUERY_LANGUAGE.sortField.tryParse("time-played DESC");
    expect(simple).toEqual(QueryFields.sortBy(Fields.variable('time-played'), 'descending'));

    let complex = QUERY_LANGUAGE.sortField.tryParse("(time-played - \"where\")");
    expect(complex).toEqual(QueryFields.sortBy(
        Fields.binaryOp(Fields.variable('time-played'), '-', Fields.literal("where")),
        'ascending'));
});

// <-- Full Queries -->

test("Minimal Query", () => {
    let simple = parseQuery("TABLE time-played, rating, length FROM #games").orElseThrow();
    expect(simple.header.type).toBe('table');
    expect((simple.header as TableQuery).fields).toEqual([
        QueryFields.named('time-played', Fields.variable('time-played')),
        QueryFields.named('rating', Fields.variable('rating')),
        QueryFields.named('length', Fields.variable('length')),
    ]);
    expect(simple.source).toEqual(Sources.tag("#games"));
});

test("Fat Query", () => {
    let fat = parseQuery("TABLE (time-played + 100) as long, rating as rate, length\n"
        + "FROM #games or #gaming\n"
        + "WHERE long > 150 and rate - 10 < 40\n"
        + "SORT length + 8 + 4 DESCENDING, long ASC").orElseThrow();
    expect(fat.header.type).toBe('table');
    expect((fat.header as TableQuery).fields.length).toBe(3);
    expect(fat.source).toEqual(Sources.binaryOp(Sources.tag("#games"), '|', Sources.tag("#gaming")));
    expect((fat.operations[1] as SortByStep).fields.length).toBe(2);
});

test("List query with format", () => {
    let query = parseQuery("LIST file.name FROM #games").orElseThrow();
    expect(query.header.type).toBe('list');
    expect((query.header as ListQuery).format).toEqual(Fields.indexVariable("file.name"));
});

test("Task query with no fields", () => {
    let q = parseQuery("task from #games").orElseThrow();
    expect(typeof q).toBe('object');
    expect(q.header.type).toBe('task');
    expect(q.source).toEqual(Sources.tag("#games"));
});
