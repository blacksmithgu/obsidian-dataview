import { Query, QUERY_LANGUAGE, parseQuery, QueryType, BinaryOpField, Fields, Sources, NamedField, QuerySortBy } from "../query";
import { Duration } from 'luxon';
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

test("Parse Identifier", () => {
    let ident = QUERY_LANGUAGE.identifier.parse("lma0") as Success<string>;
    expect(ident.status).toBe(true);
    expect(ident.value).toBe("lma0");

    let badIdent = QUERY_LANGUAGE.identifier.parse("0no");
    expect(badIdent.status).toBe(false);
});

// Literal Parsing.

test("Parse Number Literal", () => {
    expect(QUERY_LANGUAGE.number.parse("0no").status).toBe(false);

    let res = QUERY_LANGUAGE.number.parse("123") as Success<number>;
    expect(res.status).toBe(true);
    expect(res.value).toBe(123);
});

test("Parse String Literal", () => {
    let badResult = QUERY_LANGUAGE.string.parse("this won't work, no quotes");
    expect(badResult.status).toBe(false);

    let goodResult = QUERY_LANGUAGE.string.parse("\"hello\"") as Success<string>;
    expect(goodResult.status).toBe(true);
    expect(goodResult.value).toBe("hello");
});

// Date Parsing.

test("Parse Year-Month date", () => {
    let date = QUERY_LANGUAGE.date.tryParse("2020-04");
    expect(date.year).toBe(2020);
    expect(date.month).toBe(4);
});

test("Parse Year-Month-Day date", () => {
    let date = QUERY_LANGUAGE.date.tryParse("1984-08-15");
    expect(date.year).toBe(1984);
    expect(date.month).toBe(8);
    expect(date.day).toBe(15);
});

test("Parse Year-Month-DayTHour:Minute:Second", () => {
    let date = QUERY_LANGUAGE.date.tryParse("1984-08-15T12:42:59");
    expect(date.year).toBe(1984);
    expect(date.month).toBe(8);
    expect(date.day).toBe(15);
    expect(date.hour).toBe(12);
    expect(date.minute).toBe(42);
    expect(date.second).toBe(59);
});

// Duration parsing.

test("Duration day parsing", () => {
    let day = QUERY_LANGUAGE.duration.tryParse("6 days");
    let day2 = QUERY_LANGUAGE.duration.tryParse("6day");

    expect(day).toEqual(day2);
    expect(day).toEqual(Duration.fromObject({ days: 6 }));
});

test("Duration minute parsing", () => {
    let min = QUERY_LANGUAGE.duration.tryParse("4min");
    let min2 = QUERY_LANGUAGE.duration.tryParse("4 minutes");
    let min3 = QUERY_LANGUAGE.duration.tryParse("4 minute");

    expect(min).toEqual(min2);
    expect(min).toEqual(min3);
    expect(min).toEqual(Duration.fromObject({ minutes: 4 }));
});

// Tags with dashes.
test("Tag Parsing", () => {
    let tag = QUERY_LANGUAGE.tag.tryParse("#hello-from-marketing/yes");
    expect(tag).toEqual("#hello-from-marketing/yes");
});

// Binary op parsing.

test("Parse Simple Binary", () => {
    let result = QUERY_LANGUAGE.binaryOpField.parse("16 + \"what\"") as Success<BinaryOpField>;
    expect(result.status).toBe(true);
    expect(result.value).toEqual(Fields.binaryOp(Fields.literal('number', 16), '+', Fields.literal('string', "what")));
});

test("Parse Parenthesis", () => {
    let result = QUERY_LANGUAGE.field.parse("(16 - 4) - 8") as Success<BinaryOpField>;
    expect(result.status).toBe(true);
    expect(result.value).toEqual(Fields.binaryOp(Fields.binaryOp(Fields.literal('number', 16), '-', Fields.literal('number', 4)), '-', Fields.literal('number', 8)));
});

test("Order of Operations", () => {
    let result = QUERY_LANGUAGE.field.parse("14 + 6 >= 19 - 2") as Success<BinaryOpField>;
    expect(result.status).toBe(true);
    expect(result.value).toEqual(Fields.binaryOp(
        Fields.binaryOp(Fields.literal('number', 14), '+', Fields.literal('number', 6)),
        '>=',
        Fields.binaryOp(Fields.literal('number', 19), '-', Fields.literal('number', 2)),
    ));
});

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

test("Nested Identifier", () => {
    let q = QUERY_LANGUAGE.identifier.tryParse("Dates.Birthday");
    expect(q).toEqual("Dates.Birthday");
});

test("Task query with no fields", () => {
    let q = parseQuery("task from #games") as Query;
    expect(typeof q).toBe('object');
    expect(q.type).toBe('task');
    expect(q.source).toEqual(Sources.tag("#games"));
});