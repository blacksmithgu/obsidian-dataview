/** Collect data matching a source query. */

import { FullIndex, PathFilters } from "data-index/index";
import { Result } from "api/result";
import { Source } from "./source";
import { DataObject, Link, Literal } from "../data-model/value";

/** A data row which has an ID and associated data (like page link / page data). */
export type Datarow<T> = { id: Literal; data: T };

/** Find source paths which match the given source. */
export function matchingSourcePaths(
    source: Source,
    index: FullIndex,
    originFile: string = ""
): Result<Set<string>, string> {
    switch (source.type) {
        case "empty":
            return Result.success(new Set<string>());
        case "tag":
            return Result.success(index.tags.getInverse(source.tag));
        case "csv":
            return Result.success(new Set<string>([index.prefix.resolveRelative(source.path, originFile)]));
        case "folder":
            // Prefer loading from the folder at the given path.
            if (index.prefix.nodeExists(source.folder))
                return Result.success(index.prefix.get(source.folder, PathFilters.markdown));

            // But allow for loading individual files if they exist.
            if (index.prefix.pathExists(source.folder)) return Result.success(new Set([source.folder]));
            else if (index.prefix.pathExists(source.folder + ".md"))
                return Result.success(new Set([source.folder + ".md"]));

            // For backwards-compat, return an empty result even if the folder does not exist.
            return Result.success(new Set());
        case "link":
            let fullPath = index.metadataCache.getFirstLinkpathDest(source.file, originFile)?.path;
            if (!fullPath) {
                // Look in links which includes unresolved links
                return Result.success(index.links.getInverse(source.file));
            }

            if (source.direction === "incoming") {
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
                if (!(fullPath in resolved))
                    return Result.failure(`Could not find file "${source.file}" during link lookup - does it exist?`);

                return Result.success(new Set<string>(Object.keys(index.metadataCache.resolvedLinks[fullPath])));
            }
        case "binaryop":
            return Result.flatMap2(
                matchingSourcePaths(source.left, index, originFile),
                matchingSourcePaths(source.right, index, originFile),
                (left, right) => {
                    if (source.op == "&") {
                        let result = new Set<string>();
                        for (let elem of right) {
                            if (left.has(elem)) result.add(elem);
                        }

                        return Result.success(result);
                    } else if (source.op == "|") {
                        let result = new Set(left);
                        for (let elem of right) result.add(elem);
                        return Result.success(result);
                    } else {
                        return Result.failure(`Unrecognized operator '${source.op}'.`);
                    }
                }
            );
        case "negate":
            return matchingSourcePaths(source.child, index, originFile).map(child => {
                // TODO: This is obviously very inefficient. Can be improved by complicating the
                // return type of this function & optimizing 'and' / 'or'.
                let allFiles = new Set<string>(index.vault.getMarkdownFiles().map(f => f.path));
                child.forEach(f => allFiles.delete(f));
                return allFiles;
            });
    }
}

/** Convert a path to the data for that path; usually markdown pages, but could also be other file types (like CSV).  */
export async function resolvePathData(path: string, index: FullIndex): Promise<Result<Datarow<DataObject>[], string>> {
    if (PathFilters.csv(path)) return resolveCsvData(path, index);
    else return resolveMarkdownData(path, index);
}

// TODO: We shouldn't be doing path normalization here relative to an origin file,
/** Convert a CSV path to the data in the CSV (in dataview format). */
export async function resolveCsvData(path: string, index: FullIndex): Promise<Result<Datarow<DataObject>[], string>> {
    let rawData = await index.csv.get(path);
    return rawData.map(rows => {
        return rows.map((row, index) => {
            return {
                id: `${path}#${index}`,
                data: row,
            };
        });
    });
}

/** Convert a path pointing to a markdown page, into the associated metadata. */
export function resolveMarkdownData(path: string, index: FullIndex): Result<Datarow<DataObject>[], string> {
    let page = index.pages.get(path);
    if (!page) return Result.success([]);

    return Result.success([
        {
            id: Link.file(path),
            data: page.serialize(index),
        },
    ]);
}

/** Resolve a source to the collection of data rows that it matches. */
export async function resolveSource(
    source: Source,
    index: FullIndex,
    originFile: string = ""
): Promise<Result<Datarow<DataObject>[], string>> {
    let paths = matchingSourcePaths(source, index, originFile);
    if (!paths.successful) return Result.failure(paths.error);

    let result = [];
    for (let path of paths.value) {
        let resolved = await resolvePathData(path, index);
        if (!resolved.successful) return resolved;

        for (let val of resolved.value) result.push(val);
    }

    return Result.success(result);
}
