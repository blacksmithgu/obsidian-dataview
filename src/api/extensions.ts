import { STask } from "data-model/serialized/markdown";

/** A general function for deciding how to check a task given it's current state. */
export type TaskStatusSelector = (task: STask) => Promise<string>;

/**
 * A dataview extension; allows for registering new functions, altering views, and altering some more
 * advanced dataview behavior.
 **/
export class Extension {
    /** All registered task status selectors for this extension. */
    public taskStatusSelectors: Record<string, TaskStatusSelector>;

    public constructor(public plugin: string) {
        this.taskStatusSelectors = {};
    }

    /** Register a task status selector under the given name. */
    public taskStatusSelector(name: string, selector: TaskStatusSelector): Extension {
        this.taskStatusSelectors[name] = selector;
        return this;
    }
}
