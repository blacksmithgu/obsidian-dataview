/** Collect data matching a source query. */

import { FullIndex } from "data/index";
import { Result } from "api/result";
import { Source } from "./source";
import { DataObject, Link, LiteralValue } from "./value";
import {getFileName} from "util/normalize";

/** A data row which has an ID and associated data (like page link / page data). */
export type Datarow<T> = { id: LiteralValue, data: T };

/** Find source paths which match the given source. */
export function matchingSourcePaths(source: Source, index: FullIndex, originFile: string = ""): Result<Set<string>, string> {
    switch (source.type) {
        case "empty": return Result.success(new Set<string>());
        case "tag": return Result.success(index.tags.getInverse(source.tag));
        case "csv": return Result.success(new Set<string>([source.path]));
        case "folder": return Result.success(index.prefix.get(source.folder));
        case "link":
            let fullPath = index.metadataCache.getFirstLinkpathDest(source.file, originFile)?.path;
            if (!fullPath) return Result.failure(`Could not resolve link "${source.file}" during link lookup - does it exist?`);

            if (source.direction === 'incoming') {
                // To find all incoming links (i.e., things that link to this), use the index that Obsidian provides.
                // TODO: Use an actual index so this isn't a fullscan.
                let resolved = index.metadataCache.resolvedLinks;
                let incoming = new Set<string>();

                for (let [key, value] of Object.entries(resolved)) {
                    if (fullPath in value) incoming.add(key);
                }

                return Result.success(incoming);
            } else {
                let resolved = index.metadataCache.resolvedLinks;
                if (!(fullPath in resolved)) return Result.failure(`Could not find file "${source.file}" during link lookup - does it exist?`);

                return Result.success(new Set<string>(Object.keys(index.metadataCache.resolvedLinks[fullPath])));
            }
        case "binaryop":
            return Result.flatMap2(
                matchingSourcePaths(source.left, index, originFile),
                matchingSourcePaths(source.right, index, originFile),
                (left, right) => {
                if (source.op == '&') {
                    let result = new Set<string>();
                    for (let elem of right) {
                        if (left.has(elem)) result.add(elem);
                    }

                    return Result.success(result);
                } else if (source.op == '|') {
                    let result = new Set(left);
                    for (let elem of right) result.add(elem);
                    return Result.success(result);
                } else {
                    return Result.failure(`Unrecognized operator '${source.op}'.`);
                }
            });
        case "negate":
            return matchingSourcePaths(source.child, index, originFile).map(child => {
                // TODO: This is obviously very inefficient.
                let allFiles = new Set<string>(index.vault.getMarkdownFiles().map(f => f.path));
                child.forEach(f => allFiles.delete(f));
                return allFiles;
            });
    }
}

/** Convert a path to the data for that path; usually markdown pages, but could also be other file types (like CSV).  */
export function resolvePathData(path: string, index: FullIndex): Result<Datarow<DataObject>[], string> {
    if (path.endsWith("csv")) {
        // CSV file case: look up data rows in the CSV.
        let records = index.csv.get(path);
        return records.map(rows => rows.map((row, index) => {
            let fileData = {
                link: null,
                name: getFileName(path),
                path: path
            };

            return {
                id: `${path}#${index}`,
                data: Object.assign(fileData, row)
            }
        }));
    } else {
        // Default case: Assume it is a markdown page (or has markdown metadata).
        let page = index.pages.get(path);
        if (!page) return Result.success([]);

        return Result.success([{
            id: Link.file(path),
            data: page.toObject(index)
        }]);
    }
}

/** Resolve a source to the collection of data rows that it matches. */
export function resolveSource(source: Source, index: FullIndex, originFile: string = ""): Result<Datarow<DataObject>[], string> {
    let paths = matchingSourcePaths(source, index, originFile);
    if (!paths.successful) return Result.failure(paths.error);

    let result = [];
    for (let path of paths.value) {
        let resolved = resolvePathData(path, index);
        if (!resolved.successful) return resolved;

        for (let val of resolved.value) result.push(val);
    }

    return Result.success(result);
}
