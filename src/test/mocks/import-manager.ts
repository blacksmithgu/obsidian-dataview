/** A mock for `FileImporter` which runs on the same thread. */

import { runImport } from "data/import/import-impl";
import { TFile, Vault } from "obsidian";

export class FileImporter {
    public constructor(public numWorkers: number, public vault: Vault) {}

    public async reload<T>(file: TFile): Promise<T> {
        let contents = await this.vault.read(file);
        return runImport(file.path, contents) as any as T;
    }
}
