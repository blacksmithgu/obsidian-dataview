/** Stores various indices on all files in the vault to make dataview generation fast. */
import { MetadataCache, Vault, TFile } from 'obsidian';
import { fromTransferable, PageMetadata, ParsedMarkdown, parsePage } from './file';
import { getParentFolder } from 'src/util/normalize';

import DataviewImportWorker from 'web-worker:./importer.ts';

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

/** Multi-threaded file parser which debounces queues automatically. */
export class BackgroundFileParser {
    /** Time in milliseconds before a file is allowed to be requeued after being queued. */
    static QUEUE_TIMEOUT = 500;

    /* Background workers which do the actual file parsing. */
    workers: Worker[];
    /** Index of the next worker which should recieve a job. */
    nextWorkerId: number;

    /* ID for the interval which regularly checks the reload queue and reloads files. */
    reloadHandler: number;
    /** Paths -> files which have been queued for a reload. */
    reloadQueue: Map<string, TFile>;
    /** Paths -> promises for file reloads which have not yet been queued. */
    waitingCallbacks: Map<string, ((p: ParsedMarkdown) => void)[]>;
    /** Paths -> promises waiting on the successful reload of this file. */
    pastPromises: Map<string, ((p: ParsedMarkdown) => void)[]>;

    public constructor(public numWorkers: number, public vault: Vault) {
        this.workers = [];
        this.nextWorkerId = 0;

        this.reloadQueue = new Map();
        this.waitingCallbacks = new Map();
        this.pastPromises = new Map();

        for (let index = 0; index < numWorkers; index++) {
            let worker = new DataviewImportWorker({ name: "Dataview Indexer" });
            worker.onmessage = (evt) => {
                let callbacks = this.pastPromises.get(evt.data.path);
                let parsed = fromTransferable(evt.data.result);
                if (callbacks && callbacks.length > 0) {
                    for (let callback of callbacks) callback(parsed);
                }

                this.pastPromises.delete(evt.data.path);
            };

            this.workers.push(worker);
        }

        this.reloadHandler = window.setInterval(() => {
            let queueCopy = Array.from(this.reloadQueue.values());
            this.reloadQueue.clear();

            for (let [key, value] of this.waitingCallbacks.entries()) {
                if (this.pastPromises.has(key)) this.pastPromises.set(key, this.pastPromises.get(key)?.concat(value) ?? []);
                else this.pastPromises.set(key, value);
            }
            this.waitingCallbacks.clear();

            for (let file of queueCopy) {
                let workerId = this.nextWorkerId;
                this.vault.read(file)
                    .then(c => this.workers[workerId].postMessage({ path: file.path, contents: c }));

                this.nextWorkerId = (this.nextWorkerId + 1) % this.numWorkers;
            }
        }, BackgroundFileParser.QUEUE_TIMEOUT);
    }

    /** Queue a file for reloading. Files which have recently been queued will not be reloaded. */
    public reload(file: TFile): Promise<ParsedMarkdown> {
        this.reloadQueue.set(file.path, file);
        return new Promise((resolve, _reject) => {
            if (this.waitingCallbacks.has(file.path)) this.waitingCallbacks.get(file.path)?.push(resolve);
            else this.waitingCallbacks.set(file.path, [resolve]);
        });
    }
}

/** Aggregate index which has several sub-indices and will initialize all of them. */
export class FullIndex {
    /** Generate a full index from the given vault. */
    static async generate(vault: Vault, cache: MetadataCache): Promise<FullIndex> {
        let index = new FullIndex(vault, cache);
        await index.initialize();
        return Promise.resolve(index);
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

    /**
     * The current "revision" of the index, which monotonically increases for every index change. Use this to determine
     * if you are up to date.
     */
    public revision: number;

    /** Asynchronously parses files in the background using web workers. */
    public backgroundParser: BackgroundFileParser;

    /** Construct a new index over the given vault and metadata cache. */
    private constructor(public vault: Vault, public metadataCache: MetadataCache) {
        this.pages = new Map();
        this.tags = new IndexMap();
        this.etags = new IndexMap();
        this.links = new IndexMap();
        this.folders = new IndexMap();
        this.revision = 0;

        // The metadata cache is updated on file changes.
        this.metadataCache.on("changed", file => this.reload(file));

        // Renames do not set off the metadata cache; catch these explicitly.
        vault.on("rename", (file, oldPath) => {
            let oldPage = this.pages.get(oldPath);
            if (oldPage) {
                this.pages.delete(oldPath);
                this.pages.set(file.path, oldPage);
            }

            this.tags.rename(oldPath, file.path);
            this.etags.rename(oldPath, file.path);
            this.links.rename(oldPath, file.path);
            this.folders.rename(oldPath, file.path); // TODO: Do renames include folder changes?

            this.revision += 1;
            this.metadataCache.trigger("dataview:metadata-change", "rename", file, oldPath)
        });

        // File creation does cause a metadata change, but deletes do not. Clear the caches for this.
        this.vault.on("delete", file => {
            if (!(file instanceof TFile)) return;
            file = file as TFile;

            this.pages.delete(file.path);
            this.tags.delete(file.path);
            this.etags.delete(file.path);
            this.links.delete(file.path);
            this.folders.delete(file.path);

            this.revision += 1;
            this.metadataCache.trigger("dataview:metadata-change", "delete", file)
        });
    }

    /** I am not a fan of a separate "construct/initialize" step, but constructors cannot be async. */
    private async initialize() {
        this.backgroundParser = new BackgroundFileParser(4, this.vault);

        // Prefix listens to file creation/deletion/rename, and not modifies, so we let it set up it's own listeners.
        this.prefix = await PrefixIndex.generate(this.vault, () => this.revision += 1);

        // Traverse all markdown files & fill in initial data.
        let start = new Date().getTime();
        this.vault.getMarkdownFiles().forEach(file => this.reload(file));
        console.log("Dataview: Task & metadata parsing queued in %.3fs.", (new Date().getTime() - start) / 1000.0);
    }

    /** Queue a file for reloading; this is done asynchronously in the background and may take a few seconds. */
    public reload(file: TFile) {
        this.backgroundParser.reload(file).then(r => this.reloadInternal(file, r));
    }

    private reloadInternal(file: TFile, parsed: ParsedMarkdown) {
        let meta = parsePage(file, this.metadataCache, parsed);

        this.pages.set(file.path, meta);
        this.tags.set(file.path, meta.fullTags());
        this.etags.set(file.path, meta.tags);
        this.links.set(file.path, new Set<string>(meta.links.map(l => l.path)));
        this.folders.set(file.path, new Set<string>([getParentFolder(file.path)]));

        this.revision += 1;
        this.metadataCache.trigger("dataview:metadata-change", "update", file);
    }
}

/** A node in the prefix tree. */
export class PrefixIndexNode {
    // TODO: Instead of only storing file paths at the leaf, consider storing them at every level,
    // since this will make for faster deletes and gathers in exchange for slightly slower adds and more memory usage.
    // since we are optimizing for gather, and file paths tend to be shallow, this should be ok.
    files: Set<string>;
    element: string;
    totalCount: number;
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
        if (prefix.length == 0 || prefix == '/') return root;
        let parts = prefix.split("/");
        let node = root;
        for (let index = 0; index < parts.length; index++) {
            if (!node.children.has(parts[index])) return null;

            node = node.children.get(parts[index]) as PrefixIndexNode;
        }

        return node;
    }

    public static gather(root: PrefixIndexNode): Set<string> {
        let result = new Set<string>();
        PrefixIndexNode.gatherRec(root, result);
        return result;
    }

    static gatherRec(root: PrefixIndexNode, output: Set<string>) {
        for (let file of root.files) output.add(file);
        for (let child of root.children.values()) this.gatherRec(child, output);
    }
}

/** Indexes files by their full prefix - essentially a simple prefix tree. */
export class PrefixIndex {

    public static async generate(vault: Vault, updateRevision: () => void): Promise<PrefixIndex> {
        let root = new PrefixIndexNode("");
        let timeStart = new Date().getTime();

        // First time load...
        for (let file of vault.getMarkdownFiles()) {
            PrefixIndexNode.add(root, file.path);
        }

        let totalTimeMs = new Date().getTime() - timeStart;
        console.log(`Dataview: Parsed all file prefixes (${totalTimeMs / 1000.0}s)`);

        return Promise.resolve(new PrefixIndex(vault, root, updateRevision));
    }

    constructor(public vault: Vault, public root: PrefixIndexNode, public updateRevision: () => void) {
        // TODO: I'm not sure if there is an event for all files in a folder, or just the folder.
        // I'm assuming the former naively for now until I inevitably fix it.
        this.vault.on("delete", file => {
            PrefixIndexNode.remove(this.root, file.path);
            updateRevision();
        });

        this.vault.on("create", file => {
            PrefixIndexNode.add(this.root, file.path);
            updateRevision();
        });

        this.vault.on("rename", (file, old) => {
            PrefixIndexNode.remove(this.root, old);
            PrefixIndexNode.add(this.root, file.path);
            updateRevision();
        });
    }

    public get(prefix: string): Set<string> {
        let node = PrefixIndexNode.find(this.root, prefix);
        if (node == null || node == undefined) return new Set();

        return PrefixIndexNode.gather(node);
    }
}
