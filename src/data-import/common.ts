/** Common utilities for extracting tags, links, and other business from metadata. */

import { EXPRESSION } from "expression/parse";

const POTENTIAL_TAG_MATCHER = /#[^\s,;\.:!\?'"`()\[\]\{\}]+/giu;

/** Extract all tags from the given source string. */
export function extractTags(source: string): Set<string> {
    let result = new Set<string>();

    let matches = source.matchAll(POTENTIAL_TAG_MATCHER);
    for (let match of matches) {
        let parsed = EXPRESSION.tag.parse(match[0]);
        if (parsed.status) result.add(parsed.value);
    }

    return result;
}
