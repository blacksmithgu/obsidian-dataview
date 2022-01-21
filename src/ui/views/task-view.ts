import { FullIndex } from "data";
import { Groupings, Task, Link } from "data/value";
import { App, Component, Vault } from "obsidian";
import { executeTask } from "query/engine";
import { Query } from "query/query";
import { DataviewSettings } from "settings";
import { renderErrorPre } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { asyncTryOrPropogate } from "util/normalize";
import * as Tasks from "ui/tasks";

export class DataviewTaskRenderer extends DataviewRefreshableRenderer {
    taskBindings?: Component;

    constructor(
        public query: Query,
        public container: HTMLElement,
        public index: FullIndex,
        public origin: string,
        public vault: Vault,
        public settings: DataviewSettings,
        public app: App
    ) {
        super(container);
    }

    async render() {
        if (this.taskBindings) this.removeChild(this.taskBindings);
        this.container.innerHTML = "";
        let result = await asyncTryOrPropogate(() => executeTask(this.query, this.origin, this.index, this.settings));
        if (!result.successful) {
            renderErrorPre(this.container, "Dataview: " + result.error);
        } else if (this.settings.warnOnEmptyResult && Groupings.numElements(result.value.tasks) == 0) {
            renderErrorPre(this.container, "Dataview: Query returned 0 results.");
        } else {
            // If there is no grouping going on, group by the file path by default.
            let tasks = result.value.tasks;
            if (tasks.type == "base") {
                let byFile = new Map<string, Task[]>();
                for (let task of tasks.value as Task[]) {
                    if (!byFile.has(task.path)) byFile.set(task.path, []);
                    byFile.get(task.path)?.push(task);
                }

                tasks = Groupings.grouped(
                    Array.from(byFile.entries()).map(([path, tasks]) => {
                        return { key: Link.file(path), value: Groupings.base(tasks) };
                    })
                );
            }

            this.taskBindings = new Component();
            this.addChild(this.taskBindings);

            await Tasks.renderTasks(this.container, tasks, this.origin, this.taskBindings, this.vault, this.settings);
        }
    }
}
