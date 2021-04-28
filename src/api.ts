/** Fancy wrappers for the JavaScript API, used both by external plugins AND by the dataview javascript view. */

import { App, Component } from "obsidian";
import { FullIndex } from "src/index";
import { renderList, renderTable } from "./render";

export class DataviewApi {
    /**
     * The raw dataview indices, which track file <-> metadata relations. Use these if the intuitive API does not support
     * your use case.
     */
    public index: FullIndex;

    /** The component that handles the lifetime of this view. Use it if you are adding custom event handlers/components. */
    public component: Component;

    /** The path to the current file this script is running in. */
    public currentFilePath: string;
    
    /**
     * The container which holds the output of this view. You can directly append fields to this, if you wish, though 
     * the rendering API is likely to be easier for straight-forward purposes.
    */
    public container: HTMLElement;

    /** Directly access the Obsidian app object, such as for reaching out to other plugins. */
    public app: App;

    constructor(index: FullIndex, component: Component, container: HTMLElement, app: App, currentFilePath: string) {
        this.index = index;
        this.component = component;
        this.container = container;
        this.app = app;
        this.currentFilePath = currentFilePath;
    }

    /////////////////////////
    // Rendering Functions //
    /////////////////////////

    public header(level: number, text: string) {
        console.log(this.container);
        switch (level) {
            case 1: this.container.createEl('h1', { text }); break;
            case 2: this.container.createEl('h2', { text }); break;
            case 3: this.container.createEl('h3', { text }); break;
            case 4: this.container.createEl('h4', { text }); break;
            case 5: this.container.createEl('h5', { text }); break;
            case 6: this.container.createEl('h6', { text }); break;
            default: throw new Error(`Invalid header level ${level}`);
        }
    }

    public list(values: any[]) {
        renderList(this.container, values, this.component, this.currentFilePath, "\-");
    }

    public rawTable(headers: string[], values: any[][]) {
        renderTable(this.container, headers, values, this.component, this.currentFilePath, "\-");
    }
}

/** Evaluate a script where 'this' for the script is set to the given context. Allows you to define global variables. */
export function evalInContext(script: string, context: any): any {
    return function() { return eval(script); }.call(context);
}

/** Make a full API context which a script can be evaluted in. */
export function makeApiContext(index: FullIndex, component: Component, app: App, container: HTMLElement, originFile: string): DataviewApi {
    return new DataviewApi(index, component, container, app, originFile);
}