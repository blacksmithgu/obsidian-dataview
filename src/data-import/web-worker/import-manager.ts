/** Controls and creates Dataview file importers, allowing for asynchronous loading and parsing of files. */

import { Transferable } from "data-model/transferable";
import DataviewImportWorker from "web-worker:./import-entry.ts";
import { Component, MetadataCache, TFile, Vault } from "obsidian";

/** Callback when a file is resolved. */
type FileCallback = (p: any) => void;

/** Multi-threaded file parser which debounces rapid file requests automatically. */
export class FileImporter extends Component {
    /* Background workers which do the actual file parsing. */
    workers: Worker[];
    /** Tracks which workers are actively parsing a file, to make sure we properly delegate results. */
    busy: boolean[];

    /** List of files which have been queued for a reload. */
    reloadQueue: TFile[];
    /** Fast-access set which holds the list of files queued to be reloaded; used for debouncing. */
    reloadSet: Set<string>;
    /** Paths -> promises for file reloads which have not yet been queued. */
    callbacks: Map<string, [FileCallback, FileCallback][]>;

    public constructor(public numWorkers: number, public vault: Vault, public metadataCache: MetadataCache) {
        super();
        this.workers = [];
        this.busy = [];

        this.reloadQueue = [];
        this.reloadSet = new Set();
        this.callbacks = new Map();

        for (let index = 0; index < numWorkers; index++) {
            let worker = new DataviewImportWorker({ name: "Dataview Indexer " + (index + 1) });

            worker.onmessage = evt => this.finish(evt.data.path, Transferable.value(evt.data.result), index);
            this.workers.push(worker);
            this.register(() => worker.terminate());
            this.busy.push(false);
        }
    }

    /**
     * Queue the given file for reloading. Multiple reload requests for the same file in a short time period will be de-bounced
     * and all be resolved by a single actual file reload.
     */
    public reload<T>(file: TFile): Promise<T> {
        let promise: Promise<T> = new Promise((resolve, reject) => {
            if (this.callbacks.has(file.path)) this.callbacks.get(file.path)?.push([resolve, reject]);
            else this.callbacks.set(file.path, [[resolve, reject]]);
        });

        // De-bounce repeated requests for the same file.
        if (this.reloadSet.has(file.path)) return promise;
        this.reloadSet.add(file.path);

        // Immediately run this task if there are available workers; otherwise, add it to the queue.
        let workerId = this.nextAvailableWorker();
        if (workerId !== undefined) {
            this.send(file, workerId);
        } else {
            this.reloadQueue.push(file);
        }

        return promise;
    }

    /** Finish the parsing of a file, potentially queueing a new file. */
    private finish(path: string, data: any, index: number) {
        // Cache the callbacks before we do book-keeping.
        let calls = ([] as [FileCallback, FileCallback][]).concat(this.callbacks.get(path) ?? []);

        // Book-keeping to clear metadata & allow the file to be re-loaded again.
        this.reloadSet.delete(path);
        this.callbacks.delete(path);

        // Notify the queue this file is available for new work.
        this.busy[index] = false;

        // Queue a new job onto this worker.
        let job = this.reloadQueue.shift();
        if (job !== undefined) this.send(job, index);

        // Resolve promises to let users know this file has finished.
        if ("$error" in data) {
            for (let [_, reject] of calls) reject(data["$error"]);
        } else {
            for (let [callback, _] of calls) callback(data);
        }
    }

    /** Send a new task to the given worker ID. */
    private send(file: TFile, workerId: number) {
        this.busy[workerId] = true;

        this.vault.cachedRead(file).then(c =>
            this.workers[workerId].postMessage({
                path: file.path,
                contents: c,
                stat: file.stat,
                metadata: this.metadataCache.getFileCache(file),
            })
        );
    }

    /** Find the next available, non-busy worker; return undefined if all workers are busy. */
    private nextAvailableWorker(): number | undefined {
        let index = this.busy.indexOf(false);
        return index == -1 ? undefined : index;
    }
}
