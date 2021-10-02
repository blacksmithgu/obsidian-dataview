/** Controls and creates Dataview file importers, allowing for asynchronous loading and parsing of files. */

import { Transferable } from "data/transferable";
import DataviewImportWorker from "web-worker:./import-entry.ts";
import { MetadataCache, TFile, Vault } from "obsidian";

/** Multi-threaded file parser which debounces queues automatically. */
export class FileImporter {
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
    waitingCallbacks: Map<string, ((p: any) => void)[]>;
    /** Paths -> promises waiting on the successful reload of this file. */
    pastPromises: Map<string, ((p: any) => void)[]>;

    public constructor(public numWorkers: number, public vault: Vault, public metadataCache: MetadataCache) {
        this.workers = [];
        this.nextWorkerId = 0;

        this.reloadQueue = new Map();
        this.waitingCallbacks = new Map();
        this.pastPromises = new Map();

        for (let index = 0; index < numWorkers; index++) {
            let worker = new DataviewImportWorker({ name: "Dataview Indexer" });
            worker.onmessage = evt => {
                let callbacks = this.pastPromises.get(evt.data.path);
                let parsed = Transferable.value(evt.data.result);
                if (callbacks && callbacks.length > 0) {
                    for (let callback of callbacks) callback(parsed);
                }

                this.pastPromises.delete(evt.data.path);
            };

            this.workers.push(worker);
        }

        this.reloadHandler = window.setInterval(async () => {
            let queueCopy = Array.from(this.reloadQueue.values());
            this.reloadQueue.clear();

            for (let [key, value] of this.waitingCallbacks.entries()) {
                if (this.pastPromises.has(key))
                    this.pastPromises.set(key, this.pastPromises.get(key)?.concat(value) ?? []);
                else this.pastPromises.set(key, value);
            }
            this.waitingCallbacks.clear();

            for (let file of queueCopy) {
                let workerId = this.nextWorkerId;
                this.vault
                    .read(file)
                    .then(c =>
                        this.workers[workerId].postMessage({
                            path: file.path,
                            contents: c,
                            metadata: this.metadataCache.getFileCache(file),
                        })
                    );

                this.nextWorkerId = (this.nextWorkerId + 1) % this.numWorkers;
            }
        }, FileImporter.QUEUE_TIMEOUT);
    }

    public reload<T>(file: TFile): Promise<T> {
        this.reloadQueue.set(file.path, file);
        return new Promise((resolve, _reject) => {
            if (this.waitingCallbacks.has(file.path)) this.waitingCallbacks.get(file.path)?.push(resolve);
            else this.waitingCallbacks.set(file.path, [resolve]);
        });
    }
}
