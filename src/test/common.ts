import { Literal } from "data-model/value";
import { Context, LinkHandler } from "expression/context";
import { EXPRESSION } from "expression/parse";
import { DEFAULT_QUERY_SETTINGS } from "settings";

/** Expect that the given dataview expression resolves to the given value. */
export function expectEvals(text: string, result: Literal) {
    expect(parseEval(text)).toEqual(result);
}

/** Parse a field expression and evaluate it in the simple context. */
export function parseEval(text: string): Literal {
    let field = EXPRESSION.field.tryParse(text);
    return simpleContext().tryEvaluate(field);
}

/** Create a trivial link handler which never resolves links. */
export function simpleLinkHandler(): LinkHandler {
    return {
        resolve: path => null,
        normalize: path => path,
        exists: path => true,
    };
}

/** Create a trivial context good for evaluations that do not depend on links. */
export function simpleContext(): Context {
    return new Context(simpleLinkHandler(), DEFAULT_QUERY_SETTINGS);
}
