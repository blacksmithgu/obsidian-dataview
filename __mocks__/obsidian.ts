import EventEmitter from "events";

/** Basic obsidian abstraction for any file or folder in a vault. */
export abstract class TAbstractFile {
    /**
     * @public
     */
    vault: Vault;
    /**
     * @public
     */
    path: string;
    /**
     * @public
     */
    name: string;
    /**
     * @public
     */
    parent: TFolder;
}

/** Tracks file created/modified time as well as file system size. */
export interface FileStats {
    /** @public */
    ctime: number;
    /** @public */
    mtime: number;
    /** @public */
    size: number;
}

/** A regular file in the vault. */
export class TFile extends TAbstractFile {
    stat: FileStats;
    basename: string;
    extension: string;
}

/** A folder in the vault. */
export class TFolder extends TAbstractFile {
    children: TAbstractFile[];

    isRoot(): boolean {
        return false;
    }
}

export class Vault extends EventEmitter {
    getFiles() {
        return [];
    }
    trigger(name: string, ...data: any[]): void {
        this.emit(name, ...data);
    }
}

export class Component {
    registerEvent() {}
    register() {}
}

/** Stand-in for Obsidian's `MarkdownRenderChild`; retains the element whose DOM it manages. */
export abstract class MarkdownRenderChild extends Component {
    constructor(public containerEl: HTMLElement) {
        super();
    }
}

/** Minimal stand-in for Obsidian's markdown renderer (only used asynchronously by the UI). */
export const MarkdownRenderer = {
    renderMarkdown(_content: string, _el: HTMLElement, _sourcePath: string, _ctx: Component): Promise<void> {
        return Promise.resolve();
    },
};

// Obsidian patches these onto HTMLElement; jsdom does not, so provide harmless stand-ins.
// (They are declared on the HTMLElement interface in obsidian.d.ts, so no casts are needed.)
if (typeof HTMLElement.prototype.isShown !== "function") {
    HTMLElement.prototype.isShown = () => true;
}
if (typeof HTMLElement.prototype.onNodeInserted !== "function") {
    HTMLElement.prototype.onNodeInserted = () => () => {};
}
