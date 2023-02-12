// import { parsePage } from "data-import/markdown-file";
import { CachedMetadata, FileStats } from "obsidian";
import { PageMetadata } from "./markdown";
// import { Link } from "./value";

export interface BaseCanvas {

    x?: number;
    y?: number;
    width?: number;
    height?: number;
    type?: "text";
}

export class CanvasCard extends PageMetadata {
    base: BaseCanvas = {}
    id: string;

    parentPath: string;

    text: string;

    public constructor (data: any, path: string, fstat: FileStats,pmInit?: Partial<PageMetadata>) {
        super(path, pmInit);
        console.log("cancard", data)
        this.id = data.id;
        this.base = {}
        this.base.x = data.x;
        this.base.y = data.y;
        this.base.width = data.width;
        this.base.height = data.height;
        this.base.type = data.type;
        this.parentPath = path;
        this.text = data.text;
    }
}

export class CanvasMetadata {
    path: string;

    originalText: string;

    cards: CanvasCard[];

    public constructor(path: string, original: string, cards: CanvasCard[]) {
        console.log("cancon", cards)
        this.cards = cards;
        this.originalText = original;
        this.path = path;
    }

}

export type CanvasMetadataIndex = {
    [k: string]: {
        [l:string]: CachedMetadata
    }
}
