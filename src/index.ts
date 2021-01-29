/** Stores various indices on all files in the vault to make dataview generation fast. */
import { MetadataCache, Vault, TFile } from 'obsidian';
import { Task } from './tasks';
import * as Tasks from './tasks';

/** Index which efficiently allows querying by tags / subtags. */
export class TagIndex {
    /** Maps tags -> set of files containing that exact tag. */
    map: Map<string, Set<string>>;
    /** Cached inverse map; maps file -> tags it was last known to contain. */
    invMap: Map<string, Set<string>>;

    vault: Vault;
    cache: MetadataCache;

    static async generate(vault: Vault, cache: MetadataCache): Promise<TagIndex> {
        return null;
    }

    constructor() {
        this.map = new Map<string, Set<string>>();
        this.invMap = new Map<string, Set<string>>();
    }
}

/** Index which efficiently allows querying which files have given metadata. */
export class MetadataIndex {

}

/** Caches tasks for each file to avoid repeated re-loading. */
export class TaskCache {
    /** How often the reload queue is checked for reloads. */
    static RELOAD_INTERVAL = 1_000;

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

    // Handle for the interval which does the reloading.
    reloadHandle: number;
    // Files which are currently in queue to be reloaded.
    reloadQueue: TFile[];
    // Set of paths being reloaded, used for debouncing.
    reloadSet: Set<string>;

    constructor(vault: Vault, cache: Record<string, Task[]>) {
        this.vault = vault;
        this.cache = cache;

        // TODO: Maybe only use one data structure, unsure how this works w/ concurrency.
        this.reloadQueue = [];
        this.reloadSet = new Set<string>();
        this.reloadHandle = window.setInterval(() => this.reloadInternal(), TaskCache.RELOAD_INTERVAL);

        vault.on("modify", async file => {
            if (file instanceof TFile) {
                this.queueReload(file);
            }
        });
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
            let tasks = await Tasks.findTasksInFile(this.vault, file);
            if (tasks.length == 0) {
                delete this.cache[file.path];
            } else {
                this.cache[file.path] = tasks;
            }
        }
    }
}