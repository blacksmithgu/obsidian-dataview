// import { parsePage } from "data-import/markdown-file";
import { DateTime, FullIndex } from "index";
import { CachedMetadata, FileStats } from "obsidian";
import { getFileTitle, getParentFolder, stripTime } from "util/normalize";
import { ListSerializationCache, PageMetadata } from "./markdown";
import { SCanvas } from "./serialized/canvas";
import { SListItem, STask } from "./serialized/markdown";
import { Link, Values } from "./value";
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

export class CanvasMetadata implements Iterable<CanvasCard> {
    public path: string;
    public ctime: DateTime;
    public mtime: DateTime;
    public fields: any;

    public stats: FileStats

    public cards: CanvasCard[];

    public static genfrom(data: any) {

    }

    public constructor(path: string, cards: CanvasCard[], stat: FileStats, partdata?: any) {
        if(partdata) {
            Object.assign(this, partdata)
        }

        this.cards = cards;
        this.path = path;
        this.stats = stat;
        this.ctime = cards[0].ctime
        this.mtime = cards[0].mtime
    }

    public *[Symbol.iterator]() {
        yield* this.cards
    }

    public serialize(index: FullIndex, cache?: ListSerializationCache): SCanvas {

        let result: SCanvas = {
            file: {
                path: this.path,
                folder: getFileTitle(this.path),
                name: getParentFolder(this.path),
                link: Link.file(this.path),
                outlinks: this.cards.map(a => a.fileLinks()).flat(),
                inlinks: Array.from(index.links.getInverse(this.path)).map(l => Link.file(l)),
                ctime: this.ctime,
                cday: stripTime(this.ctime),
                mtime: this.mtime,
                mday: stripTime(this.mtime),
                size: this.stats.size,
                starred: index.starred.starred(this.path),
                ext: "canvas",
                cards: [...this].map(a =>{
                    let realCache = cache ?? new ListSerializationCache(a.lists);
                    return {
                        frontmatter: Values.deepCopy(a.frontmatter),
                        etags: Array.from(a.tags),
                        tags: Array.from(a.fullTags()),
                        lists: a.lists.map(l => realCache.get(l.line) as SListItem),
                        tasks: a.lists.filter(l => !!l.task).map(l => realCache.get(l.line) as STask),
                    }
                })
            }
        }
        return result
    }

}

export type CanvasMetadataIndex = {
    [k: string]: {
        [l:string]: CachedMetadata
    }
}
