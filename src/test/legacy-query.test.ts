import { Query, QueryType, BinaryOpField, Fields, Sources, NamedField, QuerySortBy, LiteralFieldRepr } from "../query";
import { QUERY_LANGUAGE, parseQuery } from "../legacy-parse";
import { DateTime, Duration } from 'luxon';
import { Success, Failure, Result } from "parsimmon";

test("Parse Query Type", () => {
    let unknown = QUERY_LANGUAGE.queryType.parse("vehicle");
    expect(unknown.status).toBe(false);

    let list = QUERY_LANGUAGE.queryType.parse("list") as Success<QueryType>;
    expect(list.status).toBe(true);
    expect(list.value).toBe('list');

    let listUpper = QUERY_LANGUAGE.queryType.parse("lIsT") as Success<QueryType>;
    expect(listUpper.status).toBe(true);
    expect(listUpper.value).toBe('list');
});

// <-- Fields -->

test("Named Fields", () => {
    let simple = QUERY_LANGUAGE.namedField.parse("time-played") as Success<NamedField>;
    expect(simple.status).toBe(true);
    expect(simple.value).toEqual(Fields.named("time-played", Fields.variable("time-played")));

    let complex = QUERY_LANGUAGE.namedField.parse("(time-played + 4) as something") as Success<NamedField>;
    expect(complex.status).toBe(true);
    expect(complex.value).toEqual(Fields.named("something", Fields.binaryOp(Fields.variable("time-played"), '+', Fields.literal('number', 4))));
});

test("Sort Fields", () => {
    let simple = QUERY_LANGUAGE.sortField.parse("time-played DESC") as Success<QuerySortBy>;
    expect(simple.status).toBe(true);
    expect(simple.value).toEqual(Fields.sortBy(Fields.variable('time-played'), 'descending'));

    let complex = QUERY_LANGUAGE.sortField.parse("(time-played - \"where\")") as Success<QuerySortBy>;
    expect(complex.status).toBe(true);
    expect(complex.value).toEqual(Fields.sortBy(
        Fields.binaryOp(Fields.variable('time-played'), '-', Fields.literal('string', "where")),
        'ascending'));
});

// <-- Full Queries -->

test("Minimal Query", () => {
    let simple = parseQuery("TABLE time-played, rating, length FROM #games") as Query;
    expect(simple.type).toBe('table');
    expect(simple.fields).toEqual([
        Fields.named('time-played', Fields.variable('time-played')),
        Fields.named('rating', Fields.variable('rating')),
        Fields.named('length', Fields.variable('length')),
    ]);
    expect(simple.source).toEqual(Sources.tag("#games"));
});

test("Fat Query", () => {
    let fat = parseQuery("TABLE (time-played + 100) as long, rating as rate, length\n"
        + "FROM #games or #gaming\n"
        + "WHERE long > 150 and rate - 10 < 40\n"
        + "SORT length + 8 + 4 DESCENDING, long ASC") as Query;
    expect(fat.type).toBe('table');
    expect(fat.fields.length).toBe(3);
    expect(fat.source).toEqual(Sources.binaryOp(Sources.tag("#games"), '|', Sources.tag("#gaming")));
    expect(fat.sortBy.length).toBe(2);
});

test("Task query with no fields", () => {
    let q = parseQuery("task from #games") as Query;
    expect(typeof q).toBe('object');
    expect(q.type).toBe('task');
    expect(q.source).toEqual(Sources.tag("#games"));
});