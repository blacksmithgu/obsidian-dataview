/** Stores various indices on all files in the vault to make dataview generation fast. */
import { MetadataCache, Vault, TFile } from 'obsidian';
import { extractMarkdownMetadata, PageMetadata } from './file';
import { getParentFolder } from 'src/util/normalize';

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
export class FullIndex {
    /** How often the reload queue is checked for reloads. */
    static RELOAD_INTERVAL = 2_000;

    /** Generate a full index from the given vault. */
    static async generate(vault: Vault, cache: MetadataCache): Promise<FullIndex> {
        let index = new FullIndex(vault, cache);
        await index.initialize();
        return Promise.resolve(index);
    }

    // Handle for the interval which does the reloading.
    reloadHandle: number;
    // Files which are currently in queue to be reloaded.
    reloadQueue: TFile[];
    // Set of paths being reloaded, used for debouncing.
    reloadSet: Set<string>;

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

    /** Vault that this index was constructed over. */
    public vault: Vault;
    /** Metadata cache that this index was constructed over. */
    public metadataCache: MetadataCache;

    private constructor(vault: Vault, metadataCache: MetadataCache) {
        this.vault = vault;
        this.metadataCache = metadataCache;

        this.pages = new Map();
        this.tags = new IndexMap();
        this.etags = new IndexMap();
        this.links = new IndexMap();
        this.folders = new IndexMap();

        this.reloadQueue = [];
        this.reloadSet = new Set();

        // Background task which regularly checks for reloads (with debouncing).
        this.reloadHandle = window.setInterval(() => this.reloadInternal(), FullIndex.RELOAD_INTERVAL);

        // The metadatda cache is updated on file changes.
        metadataCache.on("changed", file => this.queueReload(file));

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
        });

        // File creation does cause a metadata change, but deletes do not. Clear the caches for this.
        vault.on("delete", file => {
            if (!(file instanceof TFile)) return;
            file = file as TFile;

            this.pages.delete(file.path);
            this.tags.delete(file.path);
            this.etags.delete(file.path);
            this.links.delete(file.path);
            this.folders.delete(file.path);
        })
    }

    /** I am not a fan of a separate "construct/initialize" step, but constructors cannot be async. */
    private async initialize() {
        // Prefix listens to file creation/deletion/rename, and not modifies, so we let it set up it's own listeners.
        this.prefix = await PrefixIndex.generate(this.vault);

        // Traverse all markdown files & fill in initial data.
        let start = new Date().getTime();
        for (let file of this.vault.getMarkdownFiles()) this.reloadInternalFile(file);
        console.log("Dataview task & metadata indices prepared in %.3fs.", (new Date().getTime() - start) / 1000.0);
    }

    /** Queue the file for reloading; several fast reloads in a row will be debounced. */
    public queueReload(file: TFile) {
        if (this.reloadSet.has(file.path)) return;
        this.reloadSet.add(file.path);
        this.reloadQueue.push(file);
    }

    /** Utility method which regularly checks the reload queue. */
    private async reloadInternal() {
        let copy = Array.from(this.reloadQueue);
        this.reloadSet.clear();
        this.reloadQueue = [];

        for (let file of copy) this.reloadInternalFile(file);
    }

    private async reloadInternalFile(file: TFile) {
        // TODO: Hard-coding the inline field syntax here LMAO >.>
        let newPageMeta = await extractMarkdownMetadata(file, this.vault, this.metadataCache,
            /[_\*~`]*([0-9\w\p{Letter}\p{Emoji_Presentation}][-0-9\w\p{Letter}\p{Emoji_Presentation}\s]*)[_\*~`]*\s*::\s*(.+)/u);

        this.pages.set(file.path, newPageMeta);
        this.tags.set(file.path, newPageMeta.fullTags());
        this.etags.set(file.path, newPageMeta.tags);
        this.links.set(file.path, new Set<string>(newPageMeta.links.map(l => l.path)));
        this.folders.set(file.path, new Set<string>([getParentFolder(file.path)]));
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

    public static async generate(vault: Vault): Promise<PrefixIndex> {
        let root = new PrefixIndexNode("");
        let timeStart = new Date().getTime();

        // First time load...
        for (let file of vault.getMarkdownFiles()) {
            PrefixIndexNode.add(root, file.path);
        }

        let totalTimeMs = new Date().getTime() - timeStart;
        console.log(`Dataview: Parsed all file prefixes (${totalTimeMs / 1000.0}s)`);

        return Promise.resolve(new PrefixIndex(vault, root));
    }

    root: PrefixIndexNode;
    vault: Vault;

    constructor(vault: Vault, root: PrefixIndexNode) {
        this.vault = vault;
        this.root = root;

        // TODO: I'm not sure if there is an event for all files in a folder, or just the folder.
        // I'm assuming the former naively for now until I inevitably fix it.
        this.vault.on("delete", file => {
            PrefixIndexNode.remove(this.root, file.path);
        });

        this.vault.on("create", file => {
            PrefixIndexNode.add(this.root, file.path);
        });

        this.vault.on("rename", (file, old) => {
            PrefixIndexNode.remove(this.root, old);
            PrefixIndexNode.add(this.root, file.path);
        });
    }

    public get(prefix: string): Set<string> {
        let node = PrefixIndexNode.find(this.root, prefix);
        if (node == null || node == undefined) return new Set();

        return PrefixIndexNode.gather(node);
    }
}
