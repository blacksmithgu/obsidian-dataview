/** Collect data matching a source query. */

import {DataArray} from 'src/api/data-array';
import {FullIndex} from 'src/data/index';
import {Result} from 'src/api/result';
import {Source} from './source';
import {DataObject, Link, LiteralValue} from './value';

/** A data row which has an ID and associated data (like page link / page data). */
export type Datarow<T> = {id: LiteralValue; data: T};

/** Collect page paths which match the given source. */
export function collectPagePaths(
    source: Source,
    index: FullIndex,
    originFile = ''
): Result<Set<string>, string> {
    switch (source.type) {
        case 'empty':
            return Result.success(new Set<string>());
        case 'tag':
            return Result.success(index.tags.getInverse(source.tag));
        case 'folder':
            return Result.success(index.prefix.get(source.folder));
        case 'link':
            const fullPath = index.metadataCache.getFirstLinkpathDest(
                source.file,
                originFile
            )?.path;
            if (!fullPath)
                return Result.failure(
                    `Could not resolve link "${source.file}" during link lookup - does it exist?`
                );

            if (source.direction === 'incoming') {
                // To find all incoming links (i.e., things that link to this), use the index that Obsidian provides.
                // TODO: Use an actual index so this isn't a fullscan.
                const resolved = index.metadataCache.resolvedLinks;
                const incoming = new Set<string>();

                for (const [key, value] of Object.entries(resolved)) {
                    if (fullPath in value) incoming.add(key);
                }

                return Result.success(incoming);
            } else {
                const resolved = index.metadataCache.resolvedLinks;
                if (!(fullPath in resolved))
                    return Result.failure(
                        `Could not find file "${source.file}" during link lookup - does it exist?`
                    );

                return Result.success(
                    new Set<string>(
                        Object.keys(index.metadataCache.resolvedLinks[fullPath])
                    )
                );
            }
        case 'binaryop':
            return Result.flatMap2(
                collectPagePaths(source.left, index, originFile),
                collectPagePaths(source.right, index, originFile),
                (left, right) => {
                    if (source.op == '&') {
                        const result = new Set<string>();
                        for (const elem of right) {
                            if (left.has(elem)) result.add(elem);
                        }

                        return Result.success(result);
                    } else if (source.op == '|') {
                        const result = new Set(left);
                        for (const elem of right) result.add(elem);
                        return Result.success(result);
                    } else {
                        return Result.failure(
                            `Unrecognized operator '${source.op}'.`
                        );
                    }
                }
            );
        case 'negate':
            return collectPagePaths(source.child, index, originFile).map(
                child => {
                    // TODO: This is obviously very inefficient.
                    const allFiles = new Set<string>(
                        index.vault.getMarkdownFiles().map(f => f.path)
                    );
                    child.forEach(f => allFiles.delete(f));
                    return allFiles;
                }
            );
    }
}

/** Collect full page metadata for pages which match the given source. */
export function collectPages(
    source: Source,
    index: FullIndex,
    originFile = ''
): Result<Datarow<DataObject>[], string> {
    return collectPagePaths(source, index, originFile).map(s =>
        DataArray.from(s)
            .flatMap(p => {
                const page = index.pages.get(p);
                if (!page) return [];

                return [{id: Link.file(page.path), data: page.toObject(index)}];
            })
            .array()
    );
}
