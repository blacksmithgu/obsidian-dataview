/** Collect data matching a source query. */

import { DataArray } from "src/api/data-array";
import { FullIndex } from "src/data/index";
import { Result } from "src/api/result";
import { Source } from "./source";
import { DataObject, Link, LiteralValue } from "./value";
import {getFileName} from "src/util/normalize";

/** A data row which has an ID and associated data (like page link / page data). */
export type Datarow<T> = { id: LiteralValue, data: T };

/** Collect page paths which match the given source. */
export function collectPagePaths(source: Source, index: FullIndex, originFile: string = ""): Result<Set<string>, string> {
    switch (source.type) {
        case "empty": return Result.success(new Set<string>());
        case "tag": return Result.success(index.tags.getInverse(source.tag));
        case "csv": return Result.success(new Set<string>(["csv://"+source.path]));
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
                collectPagePaths(source.left, index, originFile),
                collectPagePaths(source.right, index, originFile),
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
            return collectPagePaths(source.child, index, originFile).map(child => {
                // TODO: This is obviously very inefficient.
                let allFiles = new Set<string>(index.vault.getMarkdownFiles().map(f => f.path));
                child.forEach(f => allFiles.delete(f));
                return allFiles;
            });
    }
}

/** Collect full page metadata for pages which match the given source. */
export function collectPages(source: Source, index: FullIndex, originFile: string = ""): Result<Datarow<DataObject>[], string> {
    return collectPagePaths(source, index, originFile)
        .map(s => DataArray.from(s).flatMap(p => {
            if (p.startsWith("csv://")) {
                let filePath = p.substring("csv://".length);
                let records = index.csv.get(filePath);
                if (!records) return [];
                return records.map((x) => {
                    x['file'] = {
                        link: null,
                        name: getFileName(filePath),
                        path: filePath,
                    }
                    return {id: null, data: x} as Datarow<DataObject>
                })
            }
            let page = index.pages.get(p);
            if (!page) return [];

            return [{ id: Link.file(page.path), data: page.toObject(index) }];
        }).array());
}
