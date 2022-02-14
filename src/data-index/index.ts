/** Stores various indices on all files in the vault to make dataview generation fast. */
import { Result } from "api/result";
import { DataObject } from "data-model/value";
import { App, Component, MetadataCache, TAbstractFile, TFile, TFolder, Vault } from "obsidian";
import { getParentFolder, setsEqual } from "util/normalize";
import { PageMetadata } from "data-model/markdown";
import { DateTime } from "luxon";
import { parseCsv } from "data-import/csv";
import { FileImporter } from "data-import/web-worker/import-manager";
import { IndexEvtFullName, IndexEvtTriggerArgs } from "../typings/events";

/** Aggregate index which has several sub-indices and will initialize all of them. */
export class FullIndex extends Component {
    /** Generate a full index from the given vault. */
    public static create(app: App, onChange: () => void): FullIndex {
        return new FullIndex(app, onChange);
    }

    /** I/O access to the Obsidian vault contents. */
    public vault: Vault;
    /** Access to in-memory metadata, useful for parsing and metadata lookups. */
    public metadataCache: MetadataCache;

    /* Maps path -> markdown metadata for all markdown pages. */
    public pages: Map<string, PageMetadata>;

    /** Map files -> tags in that file, and tags -> files. This version includes subtags. */
    public tags: IndexMap;
    /** Map files -> exact tags in that file, and tags -> files. This version does not automatically add subtags. */
    public etags: IndexMap;
    /** Map files -> linked files in that file, and linked file -> files that link to it. */
    public links: IndexMap;
    /** Search files by path prefix. */
    public prefix: PrefixIndex;
    /** Allows for efficient lookups of whether a file is starred or not. */
    public starred: StarredCache;
    /** Caches data in CSV files. */
    // TODO: CSV parsing should be done by a worker thread asynchronously to avoid frontend stalls.
    public csv: CsvCache;

    /**
     * The current "revision" of the index, which monotonically increases for every index change. Use this to determine
     * if you are up to date.
     */
    public revision: number;

    /** Asynchronously parses files in the background using web workers. */
    public importer: FileImporter;

    /** Construct a new index over the given vault and metadata cache. */
    private constructor(public app: App, public onChange: () => void) {
        super();

        this.vault = app.vault;
        this.metadataCache = app.metadataCache;

        this.pages = new Map();
        this.tags = new IndexMap();
        this.etags = new IndexMap();
        this.links = new IndexMap();
        this.revision = 0;

        // Handles asynchronous reloading of files on web workers.
        this.addChild((this.importer = new FileImporter(2, this.vault, this.metadataCache)));
        // Prefix listens to file creation/deletion/rename, and not modifies, so we let it set up it's own listeners.
        this.addChild((this.prefix = PrefixIndex.create(this.vault, () => this.touch())));
        // The CSV cache also needs to listen to filesystem events for cache invalidation.
        this.addChild((this.csv = new CsvCache(this.vault)));
        // The starred cache fetches starred entries semi-regularly via an interval.
        this.addChild((this.starred = new StarredCache(this.app, () => this.touch())));
    }

    trigger(...args: IndexEvtTriggerArgs): void {
        this.metadataCache.trigger("dataview:metadata-change" as IndexEvtFullName, ...args);
    }

    /** Runs through the whole vault to set up initial file */
    public initialize() {
        // Traverse all markdown files & fill in initial data.
        let start = new Date().getTime();
        for (const file of this.vault.getMarkdownFiles()) {
            this.reloadInternal(file, { path: file.path });
            this.reload(file);
        }
        console.log("Dataview: Task & metadata parsing queued in %.3fs.", (new Date().getTime() - start) / 1000.0);

        // The metadata cache is updated on file changes.
        this.registerEvent(this.metadataCache.on("changed", file => this.reload(file)));

        // Renames do not set off the metadata cache; catch these explicitly.
        this.registerEvent(this.vault.on("rename", this.rename, this));

        // File creation does cause a metadata change, but deletes do not. Clear the caches for this.
        this.registerEvent(
            this.vault.on("delete", af => {
                if (!(af instanceof TFile)) return;
                let file = af as TFile;

                this.pages.delete(file.path);
                this.tags.delete(file.path);
                this.etags.delete(file.path);
                this.links.delete(file.path);

                this.touch();
                this.trigger("delete", file);
            })
        );

        // Initialize sub-indices.
        this.prefix.initialize();
    }

    public rename(file: TAbstractFile, oldPath: string) {
        if (file instanceof TFile) {
            if (this.pages.has(oldPath)) {
                const oldMeta = this.pages.get(oldPath);
                this.pages.delete(oldPath);
                if (oldMeta) {
                    oldMeta.path = file.path;
                    this.pages.set(file.path, oldMeta);
                }
            }
            this.tags.rename(oldPath, file.path);
            this.links.rename(oldPath, file.path);
            this.etags.rename(oldPath, file.path);
        }

        this.touch();
        this.trigger("rename", file, oldPath);
    }

    /** Queue a file for reloading; this is done asynchronously in the background and may take a few seconds. */
    public reload(file: TFile) {
        this.importer.reload<Partial<PageMetadata>>(file).then(r => this.reloadInternal(file, r));
    }

    /** "Touch" the index, incrementing the revision number and causing downstream views to reload. */
    public touch() {
        this.revision += 1;
        this.onChange();
    }

    private reloadInternal(file: TFile, parsed: Partial<PageMetadata>) {
        let meta = PageMetadata.canonicalize(parsed, link => {
            let realPath = this.metadataCache.getFirstLinkpathDest(link.path, file.path);
            if (realPath) return link.withPath(realPath.path);
            else return link;
        });

        this.pages.set(file.path, meta);
        this.tags.set(file.path, meta.fullTags());
        this.etags.set(file.path, meta.tags);
        this.links.set(file.path, new Set<string>(meta.links.map(l => l.path)));

        this.touch();
        this.trigger("update", file);
    }
}

/** Indexes files by their full prefix - essentially a simple prefix tree. */
export class PrefixIndex extends Component {
    public static create(vault: Vault, updateRevision: () => void): PrefixIndex {
        return new PrefixIndex(vault, updateRevision);
    }

    constructor(public vault: Vault, public updateRevision: () => void) {
        super();
    }

    /** Run through the whole vault to set up the initial prefix index. */
    public initialize() {}

    private *walk(folder: TFolder, filter?: (path: string) => boolean): Generator<string> {
        for (const file of folder.children) {
            if (file instanceof TFolder) {
                yield* this.walk(file, filter);
            } else if (filter ? filter(file.path) : true) {
                yield file.path;
            }
        }
    }

    /** Get the list of all files under the given path. */
    public get(prefix: string, filter?: (path: string) => boolean): Set<string> {
        let folder = this.vault.getAbstractFileByPath(prefix || "/");
        return new Set(folder instanceof TFolder ? this.walk(folder, filter) : []);
    }

    /** Determines if the given path exists in the prefix index. */
    public pathExists(path: string): boolean {
        return this.vault.getAbstractFileByPath(path || "/") != null;
    }

    /** Determines if the given prefix exists in the prefix index. */
    public nodeExists(prefix: string): boolean {
        return this.vault.getAbstractFileByPath(prefix || "/") instanceof TFolder;
    }

    /**
     * Use the in-memory prefix index to convert a relative path to an absolute one.
     */
    public resolveRelative(path: string, origin?: string): string {
        if (!origin) return path;
        else if (path.startsWith("/")) return path.substring(1);

        let relativePath = getParentFolder(origin) + "/" + path;
        if (this.pathExists(relativePath)) return relativePath;
        else return path;
    }
}

/** Simple path filters which filter file types. */
export namespace PathFilters {
    export function csv(path: string): boolean {
        return path.toLowerCase().endsWith(".csv");
    }

    export function markdown(path: string): boolean {
        let lcPath = path.toLowerCase();
        return lcPath.endsWith(".md") || lcPath.endsWith(".markdown");
    }
}

/**
 * Caches in-use CSVs to make high-frequency reloads (such as actively looking at a document
 * that uses CSV) fast.
 */
export class CsvCache extends Component {
    public static CACHE_EXPIRY_SECONDS: number = 5 * 60;

    // Cache of loaded CSVs; old entries will periodically be removed
    cache: Map<string, { data: DataObject[]; loadTime: DateTime }>;
    // Periodic job which clears out the cache based on time.
    cacheClearInterval: number;

    public constructor(public vault: Vault) {
        super();

        this.cache = new Map();

        // Force-flush the cache on CSV file deletions or modifications.
        this.registerEvent(
            this.vault.on("modify", file => {
                if (file instanceof TFile && PathFilters.csv(file.path)) this.cache.delete(file.path);
            })
        );

        this.registerEvent(
            this.vault.on("delete", file => {
                if (file instanceof TFile && PathFilters.csv(file.path)) this.cache.delete(file.path);
            })
        );
    }

    /** Load a CSV file from the cache, doing a fresh load if it has not been loaded. */
    public async get(path: string): Promise<Result<DataObject[], string>> {
        // Clear old entries on every fresh load, since the path being loaded may be stale.
        this.clearOldEntries();

        let existing = this.cache.get(path);
        if (existing) return Result.success(existing.data);
        else {
            let value = await this.loadInternal(path);
            if (value.successful) this.cache.set(path, { data: value.value, loadTime: DateTime.now() });
            return value;
        }
    }

    /** Do the actual raw loading of a CSV path (which is either local or an HTTP request). */
    private async loadInternal(path: string): Promise<Result<DataObject[], string>> {
        // Allow http://, https://, and file:// prefixes which use AJAX.
        if (path.startsWith("http://") || path.startsWith("https://") || path.startsWith("file://")) {
            try {
                let result = await fetch(path, {
                    method: "GET",
                    mode: "no-cors",
                    redirect: "follow",
                });

                return Result.success(parseCsv(await result.text()));
            } catch (ex) {
                return Result.failure("" + ex + "\n\n" + ex.stack);
            }
        }

        // Otherwise, assume it is a fully-qualified file path.
        try {
            let fileData = await this.vault.adapter.read(path);
            return Result.success(parseCsv(fileData));
        } catch (ex) {
            return Result.failure(`Failed to load data from path '${path}'.`);
        }
    }

    /** Clear old entries in the cache (as measured by insertion time). */
    private clearOldEntries() {
        let currentTime = DateTime.now();
        let keysToRemove = new Set<string>();
        for (let [key, value] of this.cache.entries()) {
            let entryAge = Math.abs(currentTime.diff(value.loadTime, "seconds").seconds);
            if (entryAge > CsvCache.CACHE_EXPIRY_SECONDS) keysToRemove.add(key);
        }

        keysToRemove.forEach(key => this.cache.delete(key));
    }
}

export type StarredEntry = { type: "file"; path: string; title: string } | { type: "folder" } | { type: "query" };

/** Optional connector to the Obsidian 'Starred' plugin which allows for efficiently querying if a file is starred or not. */
export class StarredCache extends Component {
    /** How frequently to check for star updates. */
    public static REFRESH_INTERVAL = 30 * 1_000;

    /** Set of all starred file paths. */
    private stars: Set<string>;

    public constructor(public app: App, public onUpdate: () => void) {
        super();

        this.stars = StarredCache.fetch(this.app);
        this.registerInterval(window.setInterval(() => this.reload(), StarredCache.REFRESH_INTERVAL));
    }

    /** Determines if the given path is starred. */
    public starred(path: string): boolean {
        return this.stars.has(path);
    }

    private reload() {
        let newStars = StarredCache.fetch(this.app);
        if (!setsEqual(this.stars, newStars)) {
            this.stars = newStars;
            this.onUpdate();
        }
    }

    /** Fetch all starred files from the stars plugin, if present. */
    private static fetch(app: App): Set<string> {
        let items = (app as any)?.internalPlugins?.plugins?.starred?.instance?.items as StarredEntry[];
        if (items == undefined) return new Set();

        return new Set(
            items.filter((l): l is { type: "file"; path: string; title: string } => l.type === "file").map(l => l.path)
        );
    }
}

/** A generic index which indexes variables of the form key -> value[], allowing both forward and reverse lookups. */
export class IndexMap {
    /** Maps key -> values for that key. */
    map: Map<string, Set<string>>;
    /** Cached inverse map; maps value -> keys that reference that value. */
    invMap: Map<string, Set<string>>;

    /** Create a new, empty index map. */
    public constructor() {
        this.map = new Map();
        this.invMap = new Map();
    }

    /** Returns all values for the given key.  (This is unused except for tests - does it really need to be here?) */
    public get(key: string): Set<string> {
        let result = this.map.get(key);
        if (result) {
            return new Set(result);
        } else {
            return new Set();
        }
    }

    /** Returns all keys that reference the given key. Mutating the returned set is not allowed. */
    public getInverse(value: string): Readonly<Set<string>> {
        return this.invMap.get(value) || IndexMap.EMPTY_SET;
    }

    /** Sets the key to the given values; this will delete the old mapping for the key if one was present. */
    public set(key: string, values: Set<string>): this {
        if (!values.size) {
            // no need to store if no values
            this.delete(key);
            return this;
        }
        let oldValues = this.map.get(key);
        if (oldValues) {
            for (let value of oldValues) {
                // Only delete the ones we're not adding back
                if (!values.has(key)) this.invMap.get(value)?.delete(key);
            }
        }
        this.map.set(key, values);
        for (let value of values) {
            if (!this.invMap.has(value)) this.invMap.set(value, new Set([key]));
            else this.invMap.get(value)?.add(key);
        }
        return this;
    }

    /** Clears all values for the given key so they can be re-added. */
    public delete(key: string): boolean {
        let oldValues = this.map.get(key);
        if (!oldValues) return false;

        this.map.delete(key);
        for (let value of oldValues) {
            this.invMap.get(value)?.delete(key);
        }

        return true;
    }

    /** Rename all references to the given key to a new value. */
    public rename(oldKey: string, newKey: string): boolean {
        let oldValues = this.map.get(oldKey);
        if (!oldValues) return false;

        this.delete(oldKey);
        this.set(newKey, oldValues);
        return true;
    }

    /** Clear the entire index. */
    public clear() {
        this.map.clear();
        this.invMap.clear();
    }

    static EMPTY_SET: Readonly<Set<string>> = Object.freeze(new Set<string>());
}
