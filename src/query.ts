/** Provides an AST for complex queries. */
import 'parsimmon';
import { DateTime, Duration } from 'luxon';
import { EXPRESSION } from './parse';
import * as Parsimmon from 'parsimmon';

/** The supported query types (corresponding to view types). */
export type QueryType = 'list' | 'table' | 'task';

/** The literal types supported by the query engine. */
export type LiteralType = 'boolean' | 'number' | 'string' | 'date' | 'duration' | 'link' | 'array' | 'object' | 'null';
/** Maps the string type to it's actual javascript representation. */
export type LiteralTypeRepr<T extends LiteralType> =
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    T extends 'string' ? string :
    T extends 'duration' ? Duration :
    T extends 'date' ? DateTime :
    T extends 'null' ? null :
    T extends 'link'? string :
    T extends 'array' ? Array<Field> :
    T extends 'object' ? Record<string, Field> :
    any;

/** Valid binary operators. */
export type BinaryOp = '+' | '-' | '*' | '/' | '>' | '>=' | '<=' | '<' | '=' | '!=' | '&' | '|';

/** A (potentially computed) field to select or compare against. */
export type Field = BinaryOpField | VariableField | LiteralField | FunctionField | NegatedField;
export type LiteralField =
    LiteralFieldRepr<'string'>
    | LiteralFieldRepr<'number'>
    | LiteralFieldRepr<'boolean'>
    | LiteralFieldRepr<'date'>
    | LiteralFieldRepr<'duration'>
    | LiteralFieldRepr<'link'>
    | LiteralFieldRepr<'array'>
    | LiteralFieldRepr<'object'>
    | LiteralFieldRepr<'null'>;

/** Literal representation of some field type. */
export interface LiteralFieldRepr<T extends LiteralType> {
    type: 'literal';
    valueType: T;
    value: LiteralTypeRepr<T>;
}

/** A variable field for a variable with a given name. */
export interface VariableField {
    type: 'variable';
    name: string;
}

/** A binary operator field which combines two subnodes somehow. */
export interface BinaryOpField {
    type: 'binaryop';
    left: Field;
    right: Field;
    op: BinaryOp;
}

/** A function field which calls a function on 0 or more arguments. */
export interface FunctionField {
    type: 'function';
    /** The name of the function being called. */
    func: string;
    /** The arguments being passed to the function. */
    arguments: Field[];
}

/** A field which negates the value of the original field. */
export interface NegatedField {
    type: 'negated';
    /** The child field to negated. */
    child: Field;
}

/** Fields used in the query portion. */
export interface NamedField {
    /** The effective name of this field. */
    name: string;
    /** The value of this field. */
    field: Field;
}

/** A query sort by field, for determining sort order. */
export interface QuerySortBy {
    /** The field to sort on. */
    field: Field;
    /** The direction to sort in. */
    direction: 'ascending' | 'descending';
}

/** The source of files for a query. */
export type Source = TagSource | FolderSource | EmptySource | NegatedSource | BinaryOpSource;

/** A tag as a source of data. */
export interface TagSource {
    type: 'tag';
    /** The tag to source from. */
    tag: string;
}

/** A folder prefix as a source of data. */
export interface FolderSource {
    type: 'folder';
    /** The folder prefix to source from. */
    folder: string;
}

/** A source which is everything EXCEPT the files returned by the given source. */
export interface NegatedSource {
    type: 'negate';
    /** The source to negate. */
    child: Source;
}

/** A source which yields nothing. */
export interface EmptySource {
    type: 'empty';
}

/** A source made by combining subsources with a logical operators. */
export interface BinaryOpSource {
    type: 'binaryop';
    op: BinaryOp;
    left: Source;
    right: Source;
}

/** Utility functions for quickly creating fields. */
export namespace Fields {
    export function variable(name: string): VariableField {
        return { type: 'variable', name };
    }

    export function literal<T extends LiteralType>(vtype: T, val: LiteralTypeRepr<T>): LiteralField {
        return { type: 'literal', valueType: vtype, value: val } as LiteralFieldRepr<T> as LiteralField;
    }

    export function bool(value: boolean): LiteralField {
        return Fields.literal('boolean', value);
    }

    export function string(value: string): LiteralField {
        return Fields.literal('string', value);
    }
    
    export function number(value: number): LiteralField {
        return Fields.literal('number', value);
    }

    export function duration(value: Duration): LiteralField {
        return Fields.literal('duration', value);
    }

    export function link(target: string): LiteralField {
        return Fields.literal('link', target);
    }
    
    export function binaryOp(left: Field, op: BinaryOp, right: Field): Field {
        return { type: 'binaryop', left, op, right } as BinaryOpField;
    }

    export function func(func: string, args: Field[]): FunctionField {
        return { type: 'function', func, arguments: args };
    }

    export function negate(child: Field): NegatedField {
        return { type: 'negated', child };
    }

    export function named(name: string, field: Field): NamedField {
        return { name, field } as NamedField;
    }

    export function sortBy(field: Field, dir: 'ascending' | 'descending'): QuerySortBy {
        return { field, direction: dir };
    }

    export function isTruthy(field: LiteralField): boolean {
        switch (field.valueType) {
            case "number":
                return field.value != 0;
            case "string":
                return field.value.length > 0;
            case "boolean":
                return field.value;
            case "null":
                return false;
            case "date":
                return field.value.toMillis() != 0;
            case "duration":
                return field.value.as("seconds") != 0;
            default:
                return false;
        }
    }
}

export namespace Sources {
    export function tag(tag: string): TagSource {
        return { type: 'tag', tag };
    }

    export function folder(prefix: string): FolderSource {
        return { type: 'folder', folder: prefix };
    }

    export function binaryOp(left: Source, op: BinaryOp, right: Source): Source {
        return { type: 'binaryop', left, op, right };
    }

    export function negate(child: Source): NegatedSource {
        return { type: 'negate', child };
    }

    export function empty(): EmptySource {
        return { type: 'empty' };
    }
}

/** A query over the Obsidian database. */
export interface Query {
    /** The view type to render this query in. */
    type: QueryType;
    /** The fields (computed or otherwise) to select. */
    fields: NamedField[];
    /** The source that file candidates will come from. */
    source: Source;
    /** A boolean field which determines if a given entry should be included. */
    where: Field;
    /** */
    sortBy: QuerySortBy[];
}

interface SortByClause {
    type: 'sort-by';
    fields: QuerySortBy[];
}

interface WhereClause {
    type: 'where';
    field: Field;
}

interface FromClause {
    type: 'from';
    source: Source;
}

/** A clause that can be parsed; allows for order of clauses to vary. */
type Clause = SortByClause | WhereClause | FromClause;

/** Typings for the outputs of all of the parser combinators. */
interface QueryLanguageTypes {
    queryType: QueryType;

    explicitNamedField: NamedField;
    namedField: NamedField;
    sortField: QuerySortBy;

    // Entire clauses in queries.
    selectClause: { type: QueryType; fields: NamedField[] };
    fromClause: FromClause;
    whereClause: WhereClause;
    sortByClause: SortByClause;
    clause: Clause;
    query: Query;
}

/** A parsimmon-powered parser-combinator implementation of the query language. */
export const QUERY_LANGUAGE = Parsimmon.createLanguage<QueryLanguageTypes>({
    // Simple atom parsing, like words, identifiers, numbers.
    queryType: q => Parsimmon.alt<string>(Parsimmon.regexp(/TABLE|LIST|TASK/i)).map(str => str.toLowerCase() as QueryType)
        .desc("query type ('TABLE', 'LIST', or 'TASK')"),
    explicitNamedField: q => Parsimmon.seqMap(EXPRESSION.field, Parsimmon.whitespace, Parsimmon.regexp(/AS/i), Parsimmon.whitespace, EXPRESSION.identifier,
        (field, _1, _2, _3, ident) => Fields.named(ident, field)),
    namedField: q => Parsimmon.alt<NamedField>(
        q.explicitNamedField,
        EXPRESSION.variableField.map(field => Fields.named(field.name, field))
    ),
    sortField: q => Parsimmon.seqMap(Parsimmon.optWhitespace,
        EXPRESSION.field, Parsimmon.optWhitespace, Parsimmon.regexp(/ASCENDING|DESCENDING|ASC|DESC/i).atMost(1),
            (_1, field, _2, dir) => {
                let direction = dir.length == 0 ? 'ascending' : dir[0].toLowerCase();
                if (direction == 'desc') direction = 'descending';
                if (direction == 'asc') direction = 'ascending';
                return {
                    field: field,
                    direction: direction as 'ascending' | 'descending'
                };
            }),

    selectClause: q => Parsimmon.seqMap(q.queryType, Parsimmon.whitespace, Parsimmon.sepBy(q.namedField.notFollowedBy(Parsimmon.whitespace.then(EXPRESSION.source)), Parsimmon.string(',').trim(Parsimmon.optWhitespace)),
        (qtype, _, fields) => {
            return { type: qtype, fields }
        }),
    fromClause: q => Parsimmon.seqMap(Parsimmon.regexp(/FROM/i), Parsimmon.whitespace, EXPRESSION.source,
        (from, space, source) => {
            return {
                type: 'from',
                source
            }
        }),
    whereClause: q => Parsimmon.seqMap(Parsimmon.regexp(/WHERE/i), Parsimmon.whitespace, EXPRESSION.field, (where, _, field) => {
        return { type: 'where', field };
    }),
    sortByClause: q => Parsimmon.seqMap(Parsimmon.regexp(/SORT/i), Parsimmon.whitespace, q.sortField.sepBy1(Parsimmon.string(',').trim(Parsimmon.optWhitespace)),
        (sort, _1, fields) => {
            return { type: 'sort-by', fields };
        }),
    // Full query parsing.
    clause: q => Parsimmon.alt(q.fromClause, q.whereClause, q.sortByClause),
    query: q => Parsimmon.seqMap(q.selectClause, q.clause.trim(Parsimmon.optWhitespace).many(), (select, clauses) => {
        let fromClauses = clauses.filter((c): c is FromClause => c.type == 'from');
        let whereClauses = clauses.filter((c): c is WhereClause => c.type == 'where');
        let sortClauses = clauses.filter((c): c is SortByClause => c.type == 'sort-by');

        let source: Source = null;
        for (let clause of fromClauses) {
            if (source == null) source = clause.source;
            else source = Sources.binaryOp(source, '|', clause.source);
        }

        let compoundWhere: Field = null;
        for (let clause of whereClauses) {
            if (compoundWhere == null) compoundWhere = clause.field;
            else compoundWhere = Fields.binaryOp(compoundWhere, '&', clause.field);
        }

        let sortBy: QuerySortBy[] = [];
        for (let clause of sortClauses) {
            clause.fields.forEach(entry => sortBy.push(entry));
        }

        return {
            type: select.type,
            fields: select.fields,
            source: source ?? Sources.folder(""),
            where: compoundWhere ?? Fields.literal('boolean', true),
            sortBy: sortBy
        } as Query;
    })
});

/**
 * Attempt to parse a query from the given query text, returning a string error
 * if the parse failed.
 */
export function parseQuery(text: string): Query | string {
    let result = QUERY_LANGUAGE.query.parse(text);
    if (result.status == true) {
        return result.value;
    } else {
        return `Failed to parse query (line ${result.index.line}, column ${result.index.column}): expected ${result.expected}`;
    }
}
