import { DateTime, Duration } from 'luxon';
import { BinaryOp, TagSource, FolderSource, Source, VariableField, Field, Fields, Sources, NegatedSource } from 'src/query';
import * as P from 'parsimmon';

///////////
// TYPES //
///////////

/** Provides a lookup table for unit durations of the given type. */
export const DURATION_TYPES = {
    "year": Duration.fromObject({ years: 1 }),
    "yr": Duration.fromObject({ years: 1 }),
    "month": Duration.fromObject({ months: 1 }),
    "mo": Duration.fromObject({ months: 1 }),
    "week": Duration.fromObject({ weeks: 1 }),
    "wk": Duration.fromObject({ weeks: 1 }),
    "w": Duration.fromObject({ weeks: 1 }),
    "day": Duration.fromObject({ days: 1 }),
    "d": Duration.fromObject({ days: 1 }),
    "hour": Duration.fromObject({ hours: 1 }),
    "hr": Duration.fromObject({ hours: 1 }),
    "h": Duration.fromObject({ hours: 1 }),
    "minute": Duration.fromObject({ minute: 1 }),
    "min": Duration.fromObject({ minute: 1 }),
    "m": Duration.fromObject({ minute: 1 }),
    "second": Duration.fromObject({ seconds: 1 }),
    "sec": Duration.fromObject({ seconds: 1 }),
    "s": Duration.fromObject({ seconds: 1 })
};

///////////////
// Utilities //
///////////////

/** Create a left-associative binary parser which parses the given sub-element and separator. Handles whitespace. */
export function createBinaryParser<T, U>(child: P.Parser<T>, sep: P.Parser<U>, combine: (a: T, b: U, c: T) => T): P.Parser<T> {
    return P.seqMap(child, P.seq(P.optWhitespace, sep, P.optWhitespace, child).many(),
        (first, rest) => {
            if (rest.length == 0) return first;

            let node = combine(first, rest[0][1], rest[0][3]);
            for (let index = 1; index < rest.length; index++) {
                node = combine(node, rest[index][1], rest[index][3]);
            }
            return node;
        });
}

export function chainOpt<T>(base: P.Parser<T>, ...funcs: ((r: T) => P.Parser<T>)[]): P.Parser<T> {
    return P.custom((success, failure) => {
        return (input, i) => {
            let result = (base as any)._(input, i);
            if (!result.status) return result;

            for (let func of funcs) {
                let next = (func(result.value as T) as any)._(input, result.index);
                if (!next.status) return result;
                
                result = next;
            }

            return result;
        };
    })
}

////////////////////////
// Expression Parsing //
////////////////////////

type PostfixFragment =
    { 'type': 'dot'; field: Field; }
    | { 'type': 'index'; field: Field; }
    | { 'type': 'function'; fields: Field[]; };

interface ExpressionLanguage {
    number: number;
    string: string;
    bool: boolean;
    tag: string;
    identifier: string;
    identifierDot: string;
    link: string;
    rootDate: DateTime;
    date: DateTime;
    datePlus: DateTime;
    durationType: keyof typeof DURATION_TYPES;
    duration: Duration;

    binaryPlusMinus: BinaryOp;
    binaryMulDiv: BinaryOp;
    binaryCompareOp: BinaryOp;
    binaryBooleanOp: BinaryOp;

    // Source-related parsers.
    tagSource: TagSource;
    folderSource: FolderSource;
    parensSource: Source;
    atomSource: Source;
    negateSource: NegatedSource;
    binaryOpSource: Source;
    source: Source;

    // Field-related parsers.
    variableField: VariableField;
    numberField: Field;
    boolField: Field;
    stringField: Field;
    dateField: Field;
    durationField: Field;
    linkField: Field;
    negatedField: Field;
    atomField: Field;
    indexField: Field;

    // Postfix parsers for function calls & the like.
    dotPostfix: PostfixFragment;
    indexPostfix: PostfixFragment;
    functionPostfix: PostfixFragment;

    // Binary op parsers.
    binaryMulDivField: Field;
    binaryPlusMinusField: Field;
    binaryCompareField: Field;
    binaryBooleanField: Field;
    binaryOpField: Field;
    parensField: Field;
    field: Field;
}

export const EXPRESSION = P.createLanguage<ExpressionLanguage>({
    // A floating point number; the decimal point is optional.
    number: q => P.regexp(/[0-9]+(.[0-9]+)?/).map(str => Number.parseFloat(str)).desc("number"),

    // A quote-surrounded string which supports escape characters ('\').
    string: q => P.regexp(/"(.*?)(?<!(?<!\\)\\)"/, 1)
        .map(str => str.replace(/(?<!\\)\\"/, "\""))
        .map(str => str.replace(/\\\\/, "\\"))
        .desc("string"),

    // A boolean true/false value.
    bool: q => P.regexp(/true|false|True|False/).map(str => str.toLowerCase() == "true")
        .desc("boolean ('true' or 'false')"),

    // A tag of the form '#stuff/hello-there'.
    tag: q => P.regexp(/#[\p{Letter}\w/-]+/u).desc("tag ('#hello/stuff')"),

    // A variable identifier, which is alphanumeric and must start with a letter.
    identifier: q => P.regexp(/[\p{Letter}][\p{Letter}\w_-]*/u).desc("variable identifier"),

    // A variable identifier, which is alphanumeric and must start with a letter. Can include dots.
    identifierDot: q => P.regexp(/[\p{Letter}][\p{Letter}\.\w_-]*/u).desc("variable identifier"),

    // An Obsidian link of the form [[<link>]].
    link: q => P.regexp(/\[\[([\p{Letter}\w./-]+)\]\]/u, 1).desc("file link"),

    // Binary plus or minus operator.
    binaryPlusMinus: q => P.regexp(/\+|-/).map(str => str as BinaryOp).desc("'+' or '-'"),

    // Binary times or divide operator.
    binaryMulDiv: q => P.regexp(/\*|\//).map(str => str as BinaryOp).desc("'*' or '/'"),

    // Binary comparison operator.
    binaryCompareOp: q => P.regexp(/>=|<=|!=|>|<|=/).map(str => str as BinaryOp).desc("'>=' or '<=' or '!=' or '=' or '>' or '<'"),
    
    // Binary boolean combination operator.
    binaryBooleanOp: q => P.regexp(/and|or|&|\|/i).map(str => {
        if (str.toLowerCase() == 'and') return '&';
        else if (str.toLowerCase() == 'or') return '|';
        else return str as BinaryOp;
    }).desc("'and' or 'or'"),

    // A date which can be YYYY-MM[-DDTHH:mm:ss].
    // TODO: Add time-zone support.
    // TODO: Will probably want a custom combinator for optional parsing.
    rootDate: q => P.seqMap(P.regexp(/\d{4}/), P.string("-"), P.regexp(/\d{2}/), (year, _, month) => {
        return DateTime.fromObject({ year: Number.parseInt(year), month: Number.parseInt(month) })
    }).desc("date in format YYYY-MM[-DDTHH-MM-SS]"),
    date: q => chainOpt<DateTime>(q.rootDate,
        (ym: DateTime) => P.seqMap(P.string("-"), P.regexp(/\d{2}/), (_, day) => ym.set({ day: Number.parseInt(day) })),
        (ymd: DateTime) => P.seqMap(P.string("T"), P.regexp(/\d{2}/), (_, hour) => ymd.set({ hour: Number.parseInt(hour) })),
        (ymdh: DateTime) => P.seqMap(P.string(":"), P.regexp(/\d{2}/), (_, minute) => ymdh.set({ minute: Number.parseInt(minute) })),
        (ymdhm: DateTime) => P.seqMap(P.string(":"), P.regexp(/\d{2}/), (_, second) => ymdhm.set({ second: Number.parseInt(second) })),
        (ymdhms: DateTime) => P.seqMap(P.string("."), P.regexp(/\d{3}/), (_, millisecond) => ymdhms.set({ millisecond: Number.parseInt(millisecond) }))
    ),

    // A date, plus various shorthand times of day it could be.
    datePlus: q => P.alt<DateTime>(
        P.string("now").map(_ => DateTime.local()),
        P.string("today").map(_ => DateTime.local().startOf("day")),
        P.string("tommorow").map(_ => DateTime.local().startOf("day").plus(Duration.fromObject({ day: 1 }))),
        P.string("som").map(_ => DateTime.local().startOf("month")),
        P.string("soy").map(_ => DateTime.local().startOf("year")),
        P.string("eom").map(_ => DateTime.local().endOf("month")),
        P.string("eoy").map(_ => DateTime.local().endOf("year")),
        q.date
    ),

    // A duration of time.
    durationType: q => P.alt(... Object.keys(DURATION_TYPES).map(P.string)) as P.Parser<keyof typeof DURATION_TYPES>,
    duration: q => P.seqMap(q.number, P.optWhitespace, q.durationType, P.string("s").atMost(1), (count, _, t, _2) =>
        DURATION_TYPES[t].mapUnits(x => x * count)),
    
    // Source parsing.
    tagSource: q => q.tag.map(tag => Sources.tag(tag)),
    folderSource: q => q.string.map(str => Sources.folder(str)),
    parensSource: q => P.seqMap(P.string("("), P.optWhitespace, q.source, P.optWhitespace, P.string(")"), (_1, _2, field, _3, _4) => field),
    negateSource: q => P.seqMap(P.string("-"), q.atomSource, (_, source) => Sources.negate(source)),
    atomSource: q => P.alt<Source>(q.parensSource, q.negateSource, q.folderSource, q.tagSource),
    binaryOpSource: q => createBinaryParser(q.atomSource, q.binaryBooleanOp, Sources.binaryOp),
    source: q => q.binaryOpSource,

    // Field parsing.
    variableField: q => q.identifier.map(Fields.variable).desc("variable"),
    numberField: q => q.number.map(val => Fields.literal('number', val)).desc("number"),
    stringField: q => q.string.map(val => Fields.literal('string', val)).desc("string"),
    boolField: q => q.bool.map(val => Fields.literal('boolean', val)).desc("boolean"),
    dateField: q => P.seqMap(P.string("date("), P.optWhitespace, q.datePlus, P.optWhitespace, P.string(")"),
        (prefix, _1, date, _2, postfix) => Fields.literal('date', date))
        .desc("date"),
    durationField: q => P.seqMap(P.string("dur("), P.optWhitespace, q.duration, P.optWhitespace, P.string(")"),
        (prefix, _1, dur, _2, postfix) => Fields.literal('duration', dur))
        .desc("duration"),
    linkField: q => q.link.map(f => Fields.link(f)),
    atomField: q => P.alt(q.negatedField, q.parensField, q.boolField, q.numberField, q.stringField, q.linkField, q.dateField, q.durationField, q.variableField),
    indexField: q => P.seqMap(q.atomField, P.alt(q.dotPostfix, q.indexPostfix, q.functionPostfix).many(), (obj, postfixes) => {
        let result = obj;
        for (let post of postfixes) {
            switch (post.type) {
                case "dot":
                case "index":
                    result = Fields.index(result, post.field);
                    break;
                case "function":
                    result = Fields.func(result, post.fields);
                    break;
            }
        }

        return result;
    }),
    negatedField: q => P.seqMap(P.string("!"), q.indexField, (_, field) => Fields.negate(field)).desc("negated field"),
    parensField: q => P.seqMap(P.string("("), P.optWhitespace, q.field, P.optWhitespace, P.string(")"), (_1, _2, field, _3, _4) => field),
    
    dotPostfix: q => P.seqMap(P.string("."), q.variableField, (_, field) => { return { type: 'dot', field: Fields.string(field.name) } }),
    indexPostfix: q => P.seqMap(P.string("["), P.optWhitespace, q.field, P.optWhitespace, P.string("]"),
        (_, _2, field, _3, _4) => { return { type: 'index', field }}),
    functionPostfix: q => P.seqMap(P.string("("), P.optWhitespace, q.field.sepBy(P.string(",").trim(P.optWhitespace)), P.optWhitespace, P.string(")"),
        (_, _1, fields, _2, _3) => { return { type: 'function', fields }}),

    // The precedence hierarchy of operators - multiply/divide, add/subtract, compare, and then boolean operations.
    binaryMulDivField: q => createBinaryParser(q.indexField, q.binaryMulDiv, Fields.binaryOp),
    binaryPlusMinusField: q => createBinaryParser(q.binaryMulDivField, q.binaryPlusMinus, Fields.binaryOp),
    binaryCompareField: q => createBinaryParser(q.binaryPlusMinusField, q.binaryCompareOp, Fields.binaryOp),
    binaryBooleanField: q => createBinaryParser(q.binaryCompareField, q.binaryBooleanOp, Fields.binaryOp),
    binaryOpField: q => q.binaryBooleanField,

    field: q => q.binaryOpField
});