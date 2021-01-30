/** Stores various indices on all files in the vault to make dataview generation fast. */
import { MetadataCache, Vault, TFile } from 'obsidian';
import { Task } from './tasks';
import * as Tasks from './tasks';

/** Aggregate index which has several sub-indices and will initialize all of them. */
export class FullIndex {
    /** How often the reload queue is checked for reloads. */
    static RELOAD_INTERVAL = 1_000;

    /** Generate a full index from the given vault. */
    static async generate(vault: Vault, cache: MetadataCache): Promise<FullIndex> {
        // TODO: Probably need to do this on a worker thread to actually get 
        let tags = TagIndex.generate(vault, cache);
        let front = FrontmatterIndex.generate(vault, cache);
        let tasks = TaskCache.generate(vault);

        return Promise.all([tags, front, tasks]).then(value => {
            return new FullIndex(vault, cache, value[0], value[1], value[2]);
        });
    }

    // Handle for the interval which does the reloading.
    reloadHandle: number;
    // Files which are currently in queue to be reloaded.
    reloadQueue: TFile[];
    // Set of paths being reloaded, used for debouncing.
    reloadSet: Set<string>;

    // The set of indices which we update.
    tag: TagIndex;
    frontmatter: FrontmatterIndex;
    task: TaskCache;

    // Other useful things to hold onto.
    vault: Vault;
    metadataCache: MetadataCache;

    constructor(vault: Vault, metadataCache: MetadataCache, tag: TagIndex,
        front: FrontmatterIndex, task: TaskCache) {
        this.vault = vault;
        this.metadataCache = metadataCache;

        this.tag = tag;
        this.frontmatter = front;
        this.task = task;

        this.reloadQueue = [];
        this.reloadSet = new Set();

        // Background task which regularly checks for reloads.
        this.reloadHandle = window.setInterval(() => this.reloadInternal(), FullIndex.RELOAD_INTERVAL);

        // Reload on any modify.
        vault.on("modify", file => {
            if (file instanceof TFile) {
                this.queueReload(file);
            }
        });
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

        for (let file of copy) {
            await Promise.all([
                this.task.reloadFile(file),
                this.tag.reloadFile(file),
                this.frontmatter.reloadFile(file)
            ]);
        }
    }
}

/** Index which efficiently allows querying by tags / subtags. */
export class TagIndex {

    /** Parse all subtags out of the given tag. I.e., #hello/i/am would yield [#hello/i/am, #hello/i, #hello]. */
    public static parseSubtags(tag: string): string[] {
        let result = [tag];
        while (tag.contains("/")) {
            tag = tag.substring(0, tag.lastIndexOf("/"));
            result.push(tag);
        }

        return result;
    }

    public static async generate(vault: Vault, cache: MetadataCache): Promise<TagIndex> {
        let initialMap = new Map<string, Set<string>>();
        let initialInvMap = new Map<string, Set<string>>();
        let timeStart = new Date().getTime();

        // First time load...
        for (let file of vault.getMarkdownFiles()) {
            let tagCache = cache.getFileCache(file).tags;
            if (!tagCache) continue;

            let allTags = new Set<string>();
            for (let tag of tagCache) {
                for (let subtag of this.parseSubtags(tag.tag)) {
                    allTags.add(subtag);

                    if (!initialMap.has(subtag)) initialMap.set(subtag, new Set<string>());
                    initialMap.get(subtag).add(file.path);
                }
            }

            initialInvMap.set(file.path, allTags);
        }

        let totalTimeMs = new Date().getTime() - timeStart;
        console.log(`Dataview: Parsed ${initialMap.size} tags in ${initialInvMap.size} markdown files (${totalTimeMs / 1000.0}s)`);

        return new TagIndex(vault, cache, initialMap, initialInvMap);
    }

    /** Maps tags -> set of files containing that exact tag. */
    map: Map<string, Set<string>>;
    /** Cached inverse map; maps file -> tags it was last known to contain. */
    invMap: Map<string, Set<string>>;

    vault: Vault;
    cache: MetadataCache;

    constructor(vault: Vault, metadataCache: MetadataCache,
        map: Map<string, Set<string>>, invMap: Map<string, Set<string>>) {
        this.vault = vault;
        this.cache = metadataCache;

        this.map = map;
        this.invMap = invMap;
    }

    /** Returns all files which have the given tag. */
    public get(tag: string): string[] {
        let result = this.map.get(tag);
        if (result === undefined) {
            return [];
        } else {
            return Array.from(result);
        }
    }

    /** Returns all tags the given file has. */
    public getInverse(file: string): string[] {
        let result = this.invMap.get(file);
        if (result === undefined) {
            return [];
        } else {
            return Array.from(result);
        }
    }

    async reloadFile(file: TFile) {
        this.clearFile(file.path);

        let tagCache = this.cache.getFileCache(file).tags;
        if (!tagCache) return;

        let allTags = new Set<string>();
        for (let tag of tagCache) {
            for (let subtag of TagIndex.parseSubtags(tag.tag)) {
                allTags.add(subtag);

                if (!this.map.has(subtag)) this.map.set(subtag, new Set<string>());
                this.map.get(subtag).add(file.path);
            }
        }

        this.invMap.set(file.path, allTags);
    }

    /** Clears all tags for the given file so they can be re-added. */
    private clearFile(path: string) {
        let oldTags = this.invMap.get(path);
        if (!oldTags) return;

        this.invMap.delete(path);
        for (let tag of oldTags) {
            this.map.get(tag).delete(path);
        }
    }
}

/** Index which efficiently allows querying which files have given frontmatter keys. */
export class FrontmatterIndex {
    static async generate(vault: Vault, cache: MetadataCache): Promise<FrontmatterIndex> {
        // TODO: Implement me.
        return Promise.resolve(null);
    }

    reloadFile(file: TFile) {}
}

/** Caches tasks for each file to avoid repeated re-loading. */
export class TaskCache {

    /** Create a task cache for the given vault. */
    static async generate(vault: Vault): Promise<TaskCache> {
        let initialCache: Record<string, Task[]> = {};
        let timeStart = new Date().getTime();

        // First time load...
        for (let file of vault.getMarkdownFiles()) {
            let tasks = await Tasks.findTasksInFile(vault, file);
            if (tasks.length == 0) continue;
            initialCache[file.path] = tasks;
        }

        let totalTimeMs = new Date().getTime() - timeStart;
        console.log(`Dataview: Parsed tasks in ${Object.keys(initialCache).length} markdown files (${totalTimeMs / 1000.0}s)`);

        return new TaskCache(vault, initialCache);
    }

    cache: Record<string, Task[]>;
    vault: Vault;

    constructor(vault: Vault, cache: Record<string, Task[]>) {
        this.vault = vault;
        this.cache = cache;
    }

    /** Get the tasks associated with a file path. */
    public get(file: string): Task[] | null {
        let result = this.cache[file];
        if (result === undefined) return null;
        else return result;
    }

    /** Return a map of all files -> tasks in that file. */
    public all(): Record<string, Task[]> {
        // TODO: Defensive copy.
        return this.cache;
    }

    async reloadFile(file: TFile) {
        let tasks = await Tasks.findTasksInFile(this.vault, file);
        if (tasks.length == 0) {
            delete this.cache[file.path];
        } else {
            this.cache[file.path] = tasks;
        }
    }
}