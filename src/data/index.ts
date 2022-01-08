/** Stores various indices on all files in the vault to make dataview generation fast. */
import { Result } from "api/result";
import { DataObject } from "data/value";
import { Component, MetadataCache, TFile, Vault } from "obsidian";
import { getParentFolder } from "util/normalize";
import { PageMetadata } from "data/metadata";
import { ParsedMarkdown, parsePage } from "data/parse/markdown-file";
import { DateTime } from "luxon";
import { parseCsv } from "data/parse/csv";
import { FileImporter } from "data/import/import-manager";
import { IndexEvtFullName, IndexEvtTriggerArgs } from "../typings/events";

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

    /** Returns all values for the given key. */
    public get(key: string): Set<string> {
        let result = this.map.get(key);
        if (result) {
            return new Set(result);
        } else {
            return new Set();
        }
    }

    /** Returns all keys that reference the given key. */
    public getInverse(value: string): Set<string> {
        let result = this.invMap.get(value);
        if (result) {
            return new Set(result);
        } else {
            return new Set();
        }
    }

    public set(key: string, values: Set<string>): IndexMap {
        if (this.map.has(key)) this.delete(key);

        this.map.set(key, values);
        for (let value of values) {
            if (!this.invMap.has(value)) this.invMap.set(value, new Set());
            this.invMap.get(value)?.add(key);
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
}

/** Aggregate index which has several sub-indices and will initialize all of them. */
export class FullIndex extends Component {
    /** Generate a full index from the given vault. */
    public static create(vault: Vault, metadata: MetadataCache, onChange: () => void): FullIndex {
        return new FullIndex(vault, metadata, onChange);
    }

    /* Maps path -> markdown metadata for all markdown pages. */
    public pages: Map<string, PageMetadata>;

    /** Map files -> tags in that file, and tags -> files. This version includes subtags. */
    public tags: IndexMap;
    /** Map files -> exact tags in that file, and tags -> files. This version does not automatically add subtags. */
    public etags: IndexMap;
    /** Map files -> linked files in that file, and linked file -> files that link to it. */
    public links: IndexMap;
    /** Map exact folder paths to files; the 'exact' version of 'prefix'. */
    public folders: IndexMap;
    /** Search files by path prefix. */
    public prefix: PrefixIndex;
    /** Caches rows of CSV files. */
    public csv: CsvCache;

    /**
     * The current "revision" of the index, which monotonically increases for every index change. Use this to determine
     * if you are up to date.
     */
    public revision: number;

    /** Asynchronously parses files in the background using web workers. */
    public importer: FileImporter;

    /** Construct a new index over the given vault and metadata cache. */
    private constructor(public vault: Vault, public metadataCache: MetadataCache, public onChange: () => void) {
        super();
        this.pages = new Map();
        this.tags = new IndexMap();
        this.etags = new IndexMap();
        this.links = new IndexMap();
        this.folders = new IndexMap();
        this.revision = 0;

        // Handles asynchronous reloading of files on web workers.
        this.addChild((this.importer = new FileImporter(2, this.vault, this.metadataCache)));
        // Prefix listens to file creation/deletion/rename, and not modifies, so we let it set up it's own listeners.
        this.addChild((this.prefix = PrefixIndex.create(this.vault, () => this.touch())));
        // The CSV cache also needs to listen to filesystem events for cache invalidation.
        this.csv = new CsvCache(this.vault);
    }

    trigger(...args: IndexEvtTriggerArgs): void {
        this.metadataCache.trigger("dataview:metadata-change" as IndexEvtFullName, ...args);
    }

    /** Runs through the whole vault to set up initial file */
    public initialize() {
        // Traverse all markdown files & fill in initial data.
        let start = new Date().getTime();
        this.vault.getMarkdownFiles().forEach(file => this.reload(file));
        console.log("Dataview: Task & metadata parsing queued in %.3fs.", (new Date().getTime() - start) / 1000.0);

        // The metadata cache is updated on file changes.
        this.registerEvent(this.metadataCache.on("changed", file => this.reload(file)));

        // Renames do not set off the metadata cache; catch these explicitly.
        this.registerEvent(
            this.vault.on("rename", (file, oldPath) => {
                this.folders.delete(oldPath);

                if (file instanceof TFile) {
                    this.pages.delete(oldPath);
                    this.tags.delete(oldPath);
                    this.etags.delete(oldPath);
                    this.links.delete(oldPath);

                    this.reload(file);
                }

                this.touch();
                this.trigger("rename", file, oldPath);
            })
        );

        // File creation does cause a metadata change, but deletes do not. Clear the caches for this.
        this.registerEvent(
            this.vault.on("delete", af => {
                if (!(af instanceof TFile)) return;
                let file = af as TFile;

                this.pages.delete(file.path);
                this.tags.delete(file.path);
                this.etags.delete(file.path);
                this.links.delete(file.path);
                this.folders.delete(file.path);

                this.touch();
                this.trigger("delete", file);
            })
        );

        // Initialize sub-indices.
        this.prefix.initialize();
    }

    /** Queue a file for reloading; this is done asynchronously in the background and may take a few seconds. */
    public reload(file: TFile) {
        this.importer.reload<ParsedMarkdown>(file).then(r => this.reloadInternal(file, r));
    }

    /** "Touch" the index, incrementing the revision number and causing downstream views to reload. */
    public touch() {
        this.revision += 1;
        this.onChange();
    }

    private reloadInternal(file: TFile, parsed: ParsedMarkdown) {
        let meta = parsePage(file, this.metadataCache, parsed);
        this.pages.set(file.path, meta);
        this.tags.set(file.path, meta.fullTags());
        this.etags.set(file.path, meta.tags);
        this.links.set(file.path, new Set<string>(meta.links.map(l => l.path)));
        this.folders.set(file.path, new Set<string>([getParentFolder(file.path)]));

        this.touch();
        this.trigger("update", file);
    }
}

/** A node in the prefix tree. */
export class PrefixIndexNode {
    // The set of file / folder names at this level; these are *full paths*.
    files: Set<string>;
    // The segment name corresponding to the current node.
    element: string;
    // The *total* number of child files in and under this node.
    totalCount: number;
    // A map of name segment -> node for that segment.
    children: Map<string, PrefixIndexNode>;

    constructor(element: string) {
        this.element = element;
        this.files = new Set();
        this.totalCount = 0;
        this.children = new Map();
    }

    public static add(root: PrefixIndexNode, path: string) {
        let parts = path.split("/");
        let node = root;
        for (let index = 0; index < parts.length - 1; index++) {
            if (!node.children.has(parts[index])) node.children.set(parts[index], new PrefixIndexNode(parts[index]));

            node.totalCount += 1;
            node = node.children.get(parts[index]) as PrefixIndexNode;
        }

        node.totalCount += 1;
        node.files.add(path);
    }

    public static remove(root: PrefixIndexNode, path: string) {
        let parts = path.split("/");
        let node = root;
        let nodes = [];
        for (let index = 0; index < parts.length - 1; index++) {
            if (!node.children.has(parts[index])) return;

            nodes.push(node);
            node = node.children.get(parts[index]) as PrefixIndexNode;
        }

        if (!node.files.has(path)) return;
        node.files.delete(path);
        node.totalCount -= 1;

        for (let p of nodes) p.totalCount -= 1;
    }

    public static find(root: PrefixIndexNode, prefix: string): PrefixIndexNode | null {
        if (prefix.length == 0 || prefix == "/") return root;
        let parts = prefix.split("/");
        let node = root;
        for (let index = 0; index < parts.length; index++) {
            if (!node.children.has(parts[index])) return null;

            node = node.children.get(parts[index]) as PrefixIndexNode;
        }

        return node;
    }

    /** Gather all files at and under the given node, optionally filtering the result by the given filter. */
    public static gather(root: PrefixIndexNode, filter?: (path: string) => boolean): Set<string> {
        let result = new Set<string>();
        PrefixIndexNode.gatherRec(root, result);

        if (filter) {
            return new Set(Array.from(result).filter(filter));
        } else {
            return result;
        }
    }

    static gatherRec(root: PrefixIndexNode, output: Set<string>) {
        for (let file of root.files) output.add(file);
        for (let child of root.children.values()) this.gatherRec(child, output);
    }
}

/** Indexes files by their full prefix - essentially a simple prefix tree. */
export class PrefixIndex extends Component {
    public static create(vault: Vault, updateRevision: () => void): PrefixIndex {
        return new PrefixIndex(vault, updateRevision);
    }

    private root: PrefixIndexNode;

    constructor(public vault: Vault, public updateRevision: () => void) {
        super();
        this.root = new PrefixIndexNode("");
    }

    /** Run through the whole vault to set up the initial prefix index. */
    public initialize() {
        let timeStart = new Date().getTime();
        for (let file of this.vault.getFiles()) PrefixIndexNode.add(this.root, file.path);
        console.log("Dataview: File prefix tree built in %.3fs.", (new Date().getTime() - timeStart) / 1000.0);

        // TODO: I'm not sure if there is an event for all files in a folder, or just the folder.
        // I'm assuming the former naively for now until I inevitably fix it.
        this.registerEvent(
            this.vault.on("delete", file => {
                PrefixIndexNode.remove(this.root, file.path);
                this.updateRevision();
            })
        );

        this.registerEvent(
            this.vault.on("create", file => {
                PrefixIndexNode.add(this.root, file.path);
                this.updateRevision();
            })
        );

        this.registerEvent(
            this.vault.on("rename", (file, old) => {
                PrefixIndexNode.remove(this.root, old);
                PrefixIndexNode.add(this.root, file.path);
                this.updateRevision();
            })
        );
    }

    /** Get the list of all files under the given path. */
    public get(prefix: string, filter?: (path: string) => boolean): Set<string> {
        let node = PrefixIndexNode.find(this.root, prefix);
        if (node == null || node == undefined) return new Set();

        return PrefixIndexNode.gather(node, filter);
    }

    /** Determines if the given path exists in the prefix index. */
    public pathExists(path: string): boolean {
        let node = PrefixIndexNode.find(this.root, getParentFolder(path));
        return node != null && node.files.has(path);
    }

    /** Determines if the given prefix exists in the prefix index. */
    public nodeExists(prefix: string): boolean {
        return PrefixIndexNode.find(this.root, prefix) != null;
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
export class CsvCache {
    public static CACHE_EXPIRY_SECONDS: number = 5 * 60;

    // Cache of loaded CSVs; old entries will periodically be removed
    cache: Map<string, { data: DataObject[]; loadTime: DateTime }>;
    // Periodic job which clears out the cache based on time.
    cacheClearInterval: number;

    public constructor(public vault: Vault) {
        this.cache = new Map();
    }

    /** Load a CSV file from the cache, doing a fresh load if it has not been loaded. */
    public async get(path: string): Promise<Result<DataObject[], string>> {
        // Clear old entries on every fresh load, since the path being loaded may be stale.
        this.clearOldEntries();

        let existing = this.cache.get(path);
        if (existing) return Result.success(existing.data);
        else {
            let value = await this.load(path);
            if (value.successful) this.cache.set(path, { data: value.value, loadTime: DateTime.now() });
            return value;
        }
    }

    /** Do the actual raw loading of a CSV path (which is either local or an HTTP request). */
    private async load(path: string): Promise<Result<DataObject[], string>> {
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
