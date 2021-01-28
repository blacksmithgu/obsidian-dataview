import { Query, QUERY_LANGUAGE, parseQuery, QueryType, BinaryOpField, Fields, NamedField, QuerySortBy } from "../query";
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
    expect(simple.from).toEqual(["#games"]);
});

test("Fat Query", () => {
    let fat = parseQuery("TABLE (time-played + 100) as long, rating as rate, length\n"
        + "FROM #games, #gaming, -#games/unfun\n"
        + "WHERE long > 150 and rate - 10 < 40\n"
        + "SORT length + 8 + 4 DESCENDING, long ASC") as Query;
    expect(fat.type).toBe('table');
    expect(fat.fields.length).toBe(3);
    expect(fat.from).toEqual(["#games", "#gaming"]);
    expect(fat.except).toEqual(["#games/unfun"]);
    expect(fat.sortBy.length).toBe(2);
});