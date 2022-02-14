/** A mock for `FileImporter` which runs on the same thread. */

import { runImport } from "data-import/web-worker/import-impl";
import { CachedMetadata, MetadataCache, TFile, Vault } from "obsidian";

export class FileImporter {
    public constructor(public numWorkers: number, public vault: Vault, public metadataCache: MetadataCache) {}

    public async reload<T>(file: TFile): Promise<T> {
        let contents = await this.vault.read(file);
        let metadata = await this.metadataCache.getFileCache(file);
        return runImport(file.path, contents, file.stat, metadata as CachedMetadata) as any as T;
    }
}
