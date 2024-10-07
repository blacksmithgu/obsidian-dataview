import { DateTime, Duration } from "luxon";
import { Literal, Link } from "data-model/value";
import * as P from "parsimmon";
import { BinaryOp, Field, Fields, LambdaField, ListField, LiteralField, ObjectField, VariableField } from "./field";
import { FolderSource, NegatedSource, Source, SourceOp, Sources, TagSource, CsvSource } from "data-index/source";
import { normalizeDuration } from "util/normalize";
import { Result } from "api/result";
import emojiRegex from "emoji-regex";

/** Emoji regex without any additional flags. */
const EMOJI_REGEX = new RegExp(emojiRegex(), "");

/** Provides a lookup table for unit durations of the given type. */
export const DURATION_TYPES = {
    year: Duration.fromObject({ years: 1 }),
    years: Duration.fromObject({ years: 1 }),
    yr: Duration.fromObject({ years: 1 }),
    yrs: Duration.fromObject({ years: 1 }),

    month: Duration.fromObject({ months: 1 }),
    months: Duration.fromObject({ months: 1 }),
    mo: Duration.fromObject({ months: 1 }),
    mos: Duration.fromObject({ months: 1 }),

    week: Duration.fromObject({ weeks: 1 }),
    weeks: Duration.fromObject({ weeks: 1 }),
    wk: Duration.fromObject({ weeks: 1 }),
    wks: Duration.fromObject({ weeks: 1 }),
    w: Duration.fromObject({ weeks: 1 }),

    day: Duration.fromObject({ days: 1 }),
    days: Duration.fromObject({ days: 1 }),
    d: Duration.fromObject({ days: 1 }),

    hour: Duration.fromObject({ hours: 1 }),
    hours: Duration.fromObject({ hours: 1 }),
    hr: Duration.fromObject({ hours: 1 }),
    hrs: Duration.fromObject({ hours: 1 }),
    h: Duration.fromObject({ hours: 1 }),

    minute: Duration.fromObject({ minutes: 1 }),
    minutes: Duration.fromObject({ minutes: 1 }),
    min: Duration.fromObject({ minutes: 1 }),
    mins: Duration.fromObject({ minutes: 1 }),
    m: Duration.fromObject({ minutes: 1 }),

    second: Duration.fromObject({ seconds: 1 }),
    seconds: Duration.fromObject({ seconds: 1 }),
    sec: Duration.fromObject({ seconds: 1 }),
    secs: Duration.fromObject({ seconds: 1 }),
    s: Duration.fromObject({ seconds: 1 }),
};

/** Shorthand for common dates (relative to right now). */
export const DATE_SHORTHANDS = {
    now: () => DateTime.local(),
    today: () => DateTime.local().startOf("day"),
    yesterday: () =>
        DateTime.local()
            .startOf("day")
            .minus(Duration.fromObject({ days: 1 })),
    tomorrow: () =>
        DateTime.local()
            .startOf("day")
            .plus(Duration.fromObject({ days: 1 })),
    sow: () => DateTime.local().startOf("week"),
    "start-of-week": () => DateTime.local().startOf("week"),
    eow: () => DateTime.local().endOf("week"),
    "end-of-week": () => DateTime.local().endOf("week"),
    soy: () => DateTime.local().startOf("year"),
    "start-of-year": () => DateTime.local().startOf("year"),
    eoy: () => DateTime.local().endOf("year"),
    "end-of-year": () => DateTime.local().endOf("year"),
    som: () => DateTime.local().startOf("month"),
    "start-of-month": () => DateTime.local().startOf("month"),
    eom: () => DateTime.local().endOf("month"),
    "end-of-month": () => DateTime.local().endOf("month"),
};

/**
 * Keywords which cannot be used as variables directly. Use `row.<thing>` if it is a variable you have defined and want
 * to access.
 */
export const KEYWORDS = ["FROM", "WHERE", "LIMIT", "GROUP", "FLATTEN"];

///////////////
// Utilities //
///////////////

/** Split on unescaped pipes in an inner link. */
function splitOnUnescapedPipe(link: string): [string, string | undefined] {
    let pipe = -1;
    while ((pipe = link.indexOf("|", pipe + 1)) >= 0) {
        if (pipe > 0 && link[pipe - 1] == "\\") continue;
        return [link.substring(0, pipe).replace(/\\\|/g, "|"), link.substring(pipe + 1)];
    }

    return [link.replace(/\\\|/g, "|"), undefined];
}

/** Attempt to parse the inside of a link to pull out display name, subpath, etc. */
export function parseInnerLink(rawlink: string): Link {
    let [link, display] = splitOnUnescapedPipe(rawlink);
    return Link.infer(link, false, display);
}

/** Create a left-associative binary parser which parses the given sub-element and separator. Handles whitespace. */
export function createBinaryParser<T, U>(
    child: P.Parser<T>,
    sep: P.Parser<U>,
    combine: (a: T, b: U, c: T) => T
): P.Parser<T> {
    return P.seqMap(child, P.seq(P.optWhitespace, sep, P.optWhitespace, child).many(), (first, rest) => {
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
    });
}

////////////////////////
// Expression Parsing //
////////////////////////

export type PostfixFragment =
    | { type: "dot"; field: string }
    | { type: "index"; field: Field }
    | { type: "function"; fields: Field[] };

export interface ExpressionLanguage {
    number: number;
    string: string;
    escapeCharacter: string;
    bool: boolean;
    tag: string;
    identifier: string;
    link: Link;
    embedLink: Link;
    rootDate: DateTime;
    dateShorthand: keyof typeof DATE_SHORTHANDS;
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
    csvSource: CsvSource;
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

    listField: ListField;
    objectField: ObjectField;

    atomInlineField: Literal;
    inlineFieldList: Literal[];
    inlineField: Literal;

    negatedField: Field;
    atomField: Field;
    indexField: Field;
    lambdaField: LambdaField;

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
    number: q =>
        P.regexp(/-?[0-9]+(\.[0-9]+)?/)
            .map(str => Number.parseFloat(str))
            .desc("number"),

    // A quote-surrounded string which supports escape characters ('\').
    string: q =>
        P.string('"')
            .then(
                P.alt(q.escapeCharacter, P.noneOf('"\\'))
                    .atLeast(0)
                    .map(chars => chars.join(""))
            )
            .skip(P.string('"'))
            .desc("string"),

    escapeCharacter: _ =>
        P.string("\\")
            .then(P.any)
            .map(escaped => {
                // If we are escaping a backslash or a quote, pass in on in escaped form
                if (escaped === '"') return '"';
                if (escaped === "\\") return "\\";
                else return "\\" + escaped;
            }),

    // A boolean true/false value.
    bool: _ =>
        P.regexp(/true|false|True|False/)
            .map(str => str.toLowerCase() == "true")
            .desc("boolean ('true' or 'false')"),

    // A tag of the form '#stuff/hello-there'.
    tag: _ =>
        P.seqMap(
            P.string("#"),
            P.alt(P.regexp(/[^\u2000-\u206F\u2E00-\u2E7F'!"#$%&()*+,.:;<=>?@^`{|}~\[\]\\\s]/).desc("text")).many(),
            (start, rest) => start + rest.join("")
        ).desc("tag ('#hello/stuff')"),

    // A variable identifier, which is alphanumeric and must start with a letter or... emoji.
    identifier: _ =>
        P.seqMap(
            P.alt(P.regexp(/\p{Letter}/u), P.regexp(EMOJI_REGEX).desc("text")),
            P.alt(P.regexp(/[0-9\p{Letter}_-]/u), P.regexp(EMOJI_REGEX).desc("text")).many(),
            (first, rest) => first + rest.join("")
        ).desc("variable identifier"),

    // An Obsidian link of the form [[<link>]].
    link: _ =>
        P.regexp(/\[\[([^\[\]]*?)\]\]/u, 1)
            .map(linkInner => parseInnerLink(linkInner))
            .desc("file link"),

    // An embeddable link which can start with '!'. This overlaps with the normal negation operator, so it is only
    // provided for metadata parsing.
    embedLink: q =>
        P.seqMap(P.string("!").atMost(1), q.link, (p, l) => {
            if (p.length > 0) l.embed = true;
            return l;
        }).desc("file link"),

    // Binary plus or minus operator.
    binaryPlusMinus: _ =>
        P.regexp(/\+|-/)
            .map(str => str as BinaryOp)
            .desc("'+' or '-'"),

    // Binary times or divide operator.
    binaryMulDiv: _ =>
        P.regexp(/\*|\/|%/)
            .map(str => str as BinaryOp)
            .desc("'*' or '/' or '%'"),

    // Binary comparison operator.
    binaryCompareOp: _ =>
        P.regexp(/>=|<=|!=|>|<|=/)
            .map(str => str as BinaryOp)
            .desc("'>=' or '<=' or '!=' or '=' or '>' or '<'"),

    // Binary boolean combination operator.
    binaryBooleanOp: _ =>
        P.regexp(/and|or|&|\|/i)
            .map(str => {
                if (str.toLowerCase() == "and") return "&";
                else if (str.toLowerCase() == "or") return "|";
                else return str as BinaryOp;
            })
            .desc("'and' or 'or'"),

    // A date which can be YYYY-MM[-DDTHH:mm:ss].
    rootDate: _ =>
        P.seqMap(P.regexp(/\d{4}/), P.string("-"), P.regexp(/\d{2}/), (year, _, month) => {
            return DateTime.fromObject({ year: Number.parseInt(year), month: Number.parseInt(month) });
        }).desc("date in format YYYY-MM[-DDTHH-MM-SS.MS]"),
    dateShorthand: _ =>
        P.alt(
            ...Object.keys(DATE_SHORTHANDS)
                .sort((a, b) => b.length - a.length)
                .map(P.string)
        ) as P.Parser<keyof typeof DATE_SHORTHANDS>,
    date: q =>
        chainOpt<DateTime>(
            q.rootDate,
            (ym: DateTime) =>
                P.seqMap(P.string("-"), P.regexp(/\d{2}/), (_, day) => ym.set({ day: Number.parseInt(day) })),
            (ymd: DateTime) =>
                P.seqMap(P.string("T"), P.regexp(/\d{2}/), (_, hour) => ymd.set({ hour: Number.parseInt(hour) })),
            (ymdh: DateTime) =>
                P.seqMap(P.string(":"), P.regexp(/\d{2}/), (_, minute) =>
                    ymdh.set({ minute: Number.parseInt(minute) })
                ),
            (ymdhm: DateTime) =>
                P.seqMap(P.string(":"), P.regexp(/\d{2}/), (_, second) =>
                    ymdhm.set({ second: Number.parseInt(second) })
                ),
            (ymdhms: DateTime) =>
                P.alt(
                    P.seqMap(P.string("."), P.regexp(/\d{3}/), (_, millisecond) =>
                        ymdhms.set({ millisecond: Number.parseInt(millisecond) })
                    ),
                    P.succeed(ymdhms) // pass
                ),
            (dt: DateTime) =>
                P.alt(
                    P.seqMap(P.string("+").or(P.string("-")), P.regexp(/\d{1,2}(:\d{2})?/), (pm, hr) =>
                        dt.setZone("UTC" + pm + hr, { keepLocalTime: true })
                    ),
                    P.seqMap(P.string("Z"), () => dt.setZone("utc", { keepLocalTime: true })),
                    P.seqMap(P.string("["), P.regexp(/[0-9A-Za-z+-\/]+/u), P.string("]"), (_a, zone, _b) =>
                        dt.setZone(zone, { keepLocalTime: true })
                    )
                )
        )
            .assert((dt: DateTime) => dt.isValid, "valid date")
            .desc("date in format YYYY-MM[-DDTHH-MM-SS.MS]"),

    // A date, plus various shorthand times of day it could be.
    datePlus: q =>
        P.alt<DateTime>(
            q.dateShorthand.map(d => DATE_SHORTHANDS[d]()),
            q.date
        ).desc("date in format YYYY-MM[-DDTHH-MM-SS.MS] or in shorthand"),

    // A duration of time.
    durationType: _ =>
        P.alt(
            ...Object.keys(DURATION_TYPES)
                .sort((a, b) => b.length - a.length)
                .map(P.string)
        ) as P.Parser<keyof typeof DURATION_TYPES>,
    duration: q =>
        P.seqMap(q.number, P.optWhitespace, q.durationType, (count, _, t) => DURATION_TYPES[t].mapUnits(x => x * count))
            .sepBy1(P.string(",").trim(P.optWhitespace).or(P.optWhitespace))
            .map(durations => durations.reduce((p, c) => p.plus(c)))
            .desc("duration like 4hr2min"),

    // A raw null value.
    rawNull: _ => P.string("null"),

    // Source parsing.
    tagSource: q => q.tag.map(tag => Sources.tag(tag)),
    csvSource: q =>
        P.seqMap(P.string("csv(").skip(P.optWhitespace), q.string, P.string(")"), (_1, path, _2) => Sources.csv(path)),
    linkIncomingSource: q => q.link.map(link => Sources.link(link.path, true)),
    linkOutgoingSource: q =>
        P.seqMap(P.string("outgoing(").skip(P.optWhitespace), q.link, P.string(")"), (_1, link, _2) =>
            Sources.link(link.path, false)
        ),
    folderSource: q => q.string.map(str => Sources.folder(str)),
    parensSource: q =>
        P.seqMap(
            P.string("("),
            P.optWhitespace,
            q.source,
            P.optWhitespace,
            P.string(")"),
            (_1, _2, field, _3, _4) => field
        ),
    negateSource: q =>
        P.seqMap(P.alt(P.string("-"), P.string("!")), q.atomSource, (_, source) => Sources.negate(source)),
    atomSource: q =>
        P.alt<Source>(
            q.parensSource,
            q.negateSource,
            q.linkOutgoingSource,
            q.linkIncomingSource,
            q.folderSource,
            q.tagSource,
            q.csvSource
        ),
    binaryOpSource: q =>
        createBinaryParser(
            q.atomSource,
            q.binaryBooleanOp.map(s => s as SourceOp),
            Sources.binaryOp
        ),
    source: q => q.binaryOpSource,

    // Field parsing.
    variableField: q =>
        q.identifier
            .chain(r => {
                if (KEYWORDS.includes(r.toUpperCase())) {
                    return P.fail("Variable fields cannot be a keyword (" + KEYWORDS.join(" or ") + ")");
                } else {
                    return P.succeed(Fields.variable(r));
                }
            })
            .desc("variable"),
    numberField: q => q.number.map(val => Fields.literal(val)).desc("number"),
    stringField: q => q.string.map(val => Fields.literal(val)).desc("string"),
    boolField: q => q.bool.map(val => Fields.literal(val)).desc("boolean"),
    dateField: q =>
        P.seqMap(
            P.string("date("),
            P.optWhitespace,
            q.datePlus,
            P.optWhitespace,
            P.string(")"),
            (prefix, _1, date, _2, postfix) => Fields.literal(date)
        ).desc("date"),
    durationField: q =>
        P.seqMap(
            P.string("dur("),
            P.optWhitespace,
            q.duration,
            P.optWhitespace,
            P.string(")"),
            (prefix, _1, dur, _2, postfix) => Fields.literal(dur)
        ).desc("duration"),
    nullField: q => q.rawNull.map(_ => Fields.NULL),
    linkField: q => q.link.map(f => Fields.literal(f)),
    listField: q =>
        q.field
            .sepBy(P.string(",").trim(P.optWhitespace))
            .wrap(P.string("[").skip(P.optWhitespace), P.optWhitespace.then(P.string("]")))
            .map(l => Fields.list(l))
            .desc("list ('[1, 2, 3]')"),
    objectField: q =>
        P.seqMap(q.identifier.or(q.string), P.string(":").trim(P.optWhitespace), q.field, (name, _sep, value) => {
            return { name, value };
        })
            .sepBy(P.string(",").trim(P.optWhitespace))
            .wrap(P.string("{").skip(P.optWhitespace), P.optWhitespace.then(P.string("}")))
            .map(vals => {
                let res: Record<string, Field> = {};
                for (let entry of vals) res[entry.name] = entry.value;
                return Fields.object(res);
            })
            .desc("object ('{ a: 1, b: 2 }')"),

    atomInlineField: q =>
        P.alt(
            q.date,
            q.duration.map(d => normalizeDuration(d)),
            q.string,
            q.tag,
            q.embedLink,
            q.bool,
            q.number,
            q.rawNull
        ),
    inlineFieldList: q => q.atomInlineField.sepBy(P.string(",").trim(P.optWhitespace).lookahead(q.atomInlineField)),
    inlineField: q =>
        P.alt(
            P.seqMap(q.atomInlineField, P.string(",").trim(P.optWhitespace), q.inlineFieldList, (f, _s, l) =>
                [f].concat(l)
            ),
            q.atomInlineField
        ),

    atomField: q =>
        P.alt(
            // Place embed links above negated fields as they are the special parser case '![[thing]]' and are generally unambiguous.
            q.embedLink.map(l => Fields.literal(l)),
            q.negatedField,
            q.linkField,
            q.listField,
            q.objectField,
            q.lambdaField,
            q.parensField,
            q.boolField,
            q.numberField,
            q.stringField,
            q.dateField,
            q.durationField,
            q.nullField,
            q.variableField
        ),
    indexField: q =>
        P.seqMap(q.atomField, P.alt(q.dotPostfix, q.indexPostfix, q.functionPostfix).many(), (obj, postfixes) => {
            let result = obj;
            for (let post of postfixes) {
                switch (post.type) {
                    case "dot":
                        result = Fields.index(result, Fields.literal(post.field));
                        break;
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
    parensField: q =>
        P.seqMap(
            P.string("("),
            P.optWhitespace,
            q.field,
            P.optWhitespace,
            P.string(")"),
            (_1, _2, field, _3, _4) => field
        ),
    lambdaField: q =>
        P.seqMap(
            q.identifier
                .sepBy(P.string(",").trim(P.optWhitespace))
                .wrap(P.string("(").trim(P.optWhitespace), P.string(")").trim(P.optWhitespace)),
            P.string("=>").trim(P.optWhitespace),
            q.field,
            (ident, _ignore, value) => {
                return { type: "lambda", arguments: ident, value };
            }
        ),

    dotPostfix: q =>
        P.seqMap(P.string("."), q.identifier, (_, field) => {
            return { type: "dot", field: field };
        }),
    indexPostfix: q =>
        P.seqMap(P.string("["), P.optWhitespace, q.field, P.optWhitespace, P.string("]"), (_, _2, field, _3, _4) => {
            return { type: "index", field };
        }),
    functionPostfix: q =>
        P.seqMap(
            P.string("("),
            P.optWhitespace,
            q.field.sepBy(P.string(",").trim(P.optWhitespace)),
            P.optWhitespace,
            P.string(")"),
            (_, _1, fields, _2, _3) => {
                return { type: "function", fields };
            }
        ),

    // The precedence hierarchy of operators - multiply/divide, add/subtract, compare, and then boolean operations.
    binaryMulDivField: q => createBinaryParser(q.indexField, q.binaryMulDiv, Fields.binaryOp),
    binaryPlusMinusField: q => createBinaryParser(q.binaryMulDivField, q.binaryPlusMinus, Fields.binaryOp),
    binaryCompareField: q => createBinaryParser(q.binaryPlusMinusField, q.binaryCompareOp, Fields.binaryOp),
    binaryBooleanField: q => createBinaryParser(q.binaryCompareField, q.binaryBooleanOp, Fields.binaryOp),
    binaryOpField: q => q.binaryBooleanField,

    field: q => q.binaryOpField,
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
