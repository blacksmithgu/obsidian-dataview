import { PageMetadata } from "data-model/markdown";
import { Transferable } from "data-model/transferable";
import localforage from "localforage";

/** A piece of data that has been cached for a specific version and time. */
export interface Cached<T> {
    /** The version of Dataview that the data was written to cache with. */
    version: string;
    /** The time that the data was written to cache. */
    time: number;
    /** The data that was cached. */
    data: T;
}

/** Simpler wrapper for a file-backed cache for arbitrary metadata. */
export class LocalStorageCache {
    public persister: LocalForage;

    public constructor(public appId: string, public version: string) {
        this.persister = localforage.createInstance({
            name: "dataview/cache/" + appId,
            driver: [localforage.INDEXEDDB],
            description: "Cache metadata about files and sections in the dataview index.",
        });
    }

    /** Drop the entire cache instance and re-create a new fresh instance. */
    public async recreate() {
        await localforage.dropInstance({ name: "dataview/cache/" + this.appId });

        this.persister = localforage.createInstance({
            name: "dataview/cache/" + this.appId,
            driver: [localforage.INDEXEDDB],
            description: "Cache metadata about files and sections in the dataview index.",
        });
    }

    /** Load file metadata by path. */
    public async loadFile(path: string): Promise<Cached<Partial<PageMetadata>> | null | undefined> {
        return this.persister.getItem(this.fileKey(path)).then(raw => {
            let result = raw as any as Cached<Partial<PageMetadata>>;
            if (result) result.data = Transferable.value(result.data);
            return result;
        });
    }

    /** Store file metadata by path. */
    public async storeFile(path: string, data: Partial<PageMetadata>): Promise<void> {
        await this.persister.setItem(this.fileKey(path), {
            version: this.version,
            time: Date.now(),
            data: Transferable.transferable(data),
        });
    }

    /** Drop old file keys that no longer exist. */
    public async synchronize(existing: string[] | Set<string>): Promise<Set<string>> {
        let keys = new Set(await this.allFiles());
        for (let exist of existing) keys.delete(exist);

        // Any keys remaining after deleting existing keys are non-existent keys that should be cleared from cache.
        for (let key of keys) await this.persister.removeItem(this.fileKey(key));

        return keys;
    }

    /** Obtain a list of all metadata keys. */
    public async allKeys(): Promise<string[]> {
        return this.persister.keys();
    }

    /** Obtain a list of all persisted files. */
    public async allFiles(): Promise<string[]> {
        let keys = await this.allKeys();
        return keys.filter(k => k.startsWith("file:")).map(k => k.substring(5));
    }

    public fileKey(path: string): string {
        return "file:" + path;
    }
}
