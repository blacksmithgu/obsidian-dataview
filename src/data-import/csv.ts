import { canonicalizeVarName } from "util/normalize";
import { DataObject } from "data-model/value";
import * as Papa from "papaparse";
import { parseFrontmatter } from "data-import/markdown-file";

/** Parse a CSV file into a collection of data rows. */
export function parseCsv(content: string): DataObject[] {
    let parsed = Papa.parse(content, {
        header: true,
        skipEmptyLines: true,
        comments: "#",
        dynamicTyping: true,
    });

    let rows = [];
    for (let parsedRow of parsed.data) {
        let fields = parseFrontmatter(parsedRow) as DataObject;
        let result: DataObject = {};

        for (let [key, value] of Object.entries(fields)) {
            result[key] = value;
            result[canonicalizeVarName(key)] = value;
        }

        rows.push(result);
    }

    return rows;
}
