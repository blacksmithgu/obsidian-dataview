import { DateTime, Duration } from "luxon";
import { Link, LiteralValue } from "src/data/value";
import * as P from 'parsimmon';
import { BinaryOp, Field, Fields, LiteralField, VariableField } from "./field";
import { FolderSource, NegatedSource, Source, SourceOp, Sources, TagSource } from "src/data/source";
import { normalizeDuration } from "src/util/normalize";
import { Result } from "src/api/result";

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

/**
 * Keywords which cannot be used as variables directly. Use `row.<thing>` if it is a variable you have defined and want
 * to access.
 */
export const KEYWORDS = ["FROM", "WHERE", "LIMIT", "GROUP", "FLATTEN"];

///////////////
// Utilities //
///////////////

/** Attempt to parse the inside of a link to pull out display name, subpath, etc. */
export function parseInnerLink(link: string): Link {
    let display: string | undefined = undefined;
    if (link.includes('|')) {
        let split = link.split("|");
        link = split[0];
        display = split[1];
    }

    if (link.includes('#')) {
        let split = link.split('#');
        return Link.header(split[0], split[1], false, display);
    } else if (link.includes('^')) {
        let split = link.split('^');
        return Link.block(split[0], split[1], false, display);
    }

    return Link.file(link, false, display);
}

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
    escapeCharacter: string;
    bool: boolean;
    tag: string;
    identifier: string;
    identifierDot: string;
    link: Link;
    embedLink: Link;
    rootDate: DateTime;
    date: DateTime;
    datePlus: DateTime;
    durationType: keyof typeof DURATION_TYPES;
    duration: Duration;
    rawNull: string;

    binaryPlusMinus: BinaryOp;
    binaryMulDiv: BinaryOp;
    binaryCompareOp: BinaryOp;
    binaryBooleanOp: BinaryOp;

    // Source-related parsers.
    tagSource: TagSource;
    folderSource: FolderSource;
    parensSource: Source;
    atomSource: Source;
    linkIncomingSource: Source;
    linkOutgoingSource: Source;
    negateSource: NegatedSource;
    binaryOpSource: Source;
    source: Source;

    // Field-related parsers.
    variableField: VariableField;
    numberField: LiteralField;
    boolField: LiteralField;
    stringField: LiteralField;
    dateField: LiteralField;
    durationField: LiteralField;
    linkField: LiteralField;
    nullField: LiteralField;
    literalField: LiteralField;

    atomInlineField: LiteralValue;
    inlineFieldList: LiteralValue[];
    inlineField: LiteralValue;

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
    string: q => P.string('"')
        .then(P.alt(q.escapeCharacter, P.noneOf('"\\')).atLeast(0).map(chars => chars.join('')))
        .skip(P.string('"'))
        .desc("string"),

    escapeCharacter: q => P.string('\\').then(P.any).map(escaped => {
        // If we are escaping a backslash or a quote, pass in on in escaped form
        if (escaped === '"') return '\"';
        if (escaped === '\\') return '\\';
        else return '\\' + escaped;
    }),

    // A boolean true/false value.
    bool: q => P.regexp(/true|false|True|False/).map(str => str.toLowerCase() == "true")
        .desc("boolean ('true' or 'false')"),

    // A tag of the form '#stuff/hello-there'.
    tag: q => P.regexp(/#[\p{Letter}\p{Emoji_Presentation}\w/-]+/u).desc("tag ('#hello/stuff')"),

    // A variable identifier, which is alphanumeric and must start with a letter.
    identifier: q => P.regexp(/[\p{Letter}\p{Emoji_Presentation}][\p{Letter}\p{Emoji_Presentation}\w_-]*/u).desc("variable identifier"),

    // A variable identifier, which is alphanumeric and must start with a letter. Can include dots.
    identifierDot: q => P.regexp(/[\p{Letter}\p{Emoji_Presentation}][\p{Letter}\p{Emoji_Presentation}\.\w_-]*/u).desc("variable identifier"),

    // An Obsidian link of the form [[<link>]].
    link: q => P.regexp(/\[\[([^\[\]]*?)\]\]/u, 1).map(linkInner => parseInnerLink(linkInner)).desc("file link"),
    embedLink: q => P.seqMap(P.string("!").atMost(1), q.link, (p, l) => {
        if (p.length > 0) l.embed = true;
        return l;
    }),

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
        P.string("tomorrow").map(_ => DateTime.local().startOf("day").plus(Duration.fromObject({ day: 1 }))),
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

    // A raw null value.
    rawNull: q => P.string("null"),

    // Source parsing.
    tagSource: q => q.tag.map(tag => Sources.tag(tag)),
    linkIncomingSource: q => q.link.map(link => Sources.link(link.path, true)),
    linkOutgoingSource: q => P.seqMap(P.string("outgoing(").skip(P.optWhitespace), q.link, P.string(")"),
        (_1, link, _2) => Sources.link(link.path, false)),
    folderSource: q => q.string.map(str => Sources.folder(str)),
    parensSource: q => P.seqMap(P.string("("), P.optWhitespace, q.source, P.optWhitespace, P.string(")"), (_1, _2, field, _3, _4) => field),
    negateSource: q => P.seqMap(P.alt(P.string("-"), P.string("!")), q.atomSource, (_, source) => Sources.negate(source)),
    atomSource: q => P.alt<Source>(q.parensSource, q.negateSource, q.linkOutgoingSource, q.linkIncomingSource, q.folderSource, q.tagSource),
    binaryOpSource: q => createBinaryParser(q.atomSource, q.binaryBooleanOp.map(s => s as SourceOp), Sources.binaryOp),
    source: q => q.binaryOpSource,

    // Field parsing.
    variableField: q => q.identifier.chain(r => {
        if (KEYWORDS.includes(r.toUpperCase())) {
            return P.fail("Variable fields cannot be a keyword (" + KEYWORDS.join(" or ") + ")");
        } else {
            return P.succeed(Fields.variable(r));
        }
    }).desc("variable"),
    numberField: q => q.number.map(val => Fields.literal(val)).desc("number"),
    stringField: q => q.string.map(val => Fields.literal(val)).desc("string"),
    boolField: q => q.bool.map(val => Fields.literal(val)).desc("boolean"),
    dateField: q => P.seqMap(P.string("date("), P.optWhitespace, q.datePlus, P.optWhitespace, P.string(")"),
        (prefix, _1, date, _2, postfix) => Fields.literal(date))
        .desc("date"),
    durationField: q => P.seqMap(P.string("dur("), P.optWhitespace, q.duration, P.optWhitespace, P.string(")"),
        (prefix, _1, dur, _2, postfix) => Fields.literal(dur))
        .desc("duration"),
    nullField: q => q.rawNull.map(_ => Fields.NULL),
    linkField: q => q.link.map(f => Fields.literal(f)),

    literalField: q => P.alt(q.nullField, q.numberField, q.stringField, q.boolField, q.dateField, q.durationField),
    atomInlineField: q => P.alt(
        q.date,
        q.duration.map(d => normalizeDuration(d)),
        q.string,
        q.link,
        q.bool,
        q.number,
        q.rawNull),
    inlineFieldList: q => q.atomInlineField.sepBy(P.string(",").trim(P.optWhitespace).lookahead(q.atomInlineField)),
    inlineField: q => P.alt(
        P.seqMap(q.atomInlineField, P.string(",").trim(P.optWhitespace), q.inlineFieldList, (f, _s, l) => [f].concat(l)),
        q.atomInlineField
    ),

    atomField: q => P.alt(q.negatedField, q.parensField, q.boolField, q.numberField, q.stringField, q.linkField, q.dateField, q.durationField, q.nullField, q.variableField),
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

    dotPostfix: q => P.seqMap(P.string("."), q.identifier, (_, field) => { return { type: 'dot', field: Fields.literal(field) } }),
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

/**
 * Attempt to parse a field from the given text, returning a string error if the
 * parse failed.
 */
export function parseField(text: string): Result<Field, string> {
    try {
        return Result.success(EXPRESSION.field.tryParse(text));
    } catch (error) {
        return Result.failure("" + error);
    }
}
