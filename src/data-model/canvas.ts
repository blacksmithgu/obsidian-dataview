import { PageMetadata } from "./markdown";
// import { Link } from "./value";

export type nodeType = "text" | "file"

export class AbstractCanvasNode {
    public id: string;

    public x: number;
    public y: number;
    public width: number;
    public height: number;
    public type: nodeType;

    public constructor(data: any) {
        this.id = data.id;
        this.x = data.x;
        this.y = data.y;
        this.width = data.width;
        this.height = data.height;
        this.type = data.type;
    }
}

export class CanvasCard extends AbstractCanvasNode {
    public type: "text";

    public text: string;

    public constructor (data: any) {
        super(data);
        this.type = "text"
        this.text = data.text;
    }
}


export class CanvasMetadata extends PageMetadata {
    public cards: CanvasCard[];

    public path: string;

    public constructor(path: string, pminit?: Partial<PageMetadata>, cards?: CanvasCard[]) {
        super(path, pminit);
        this.cards = (cards || [])
    }

    public addCard(arg: CanvasCard | string): void {
        if(arg instanceof CanvasCard) {
            this.cards.push(arg)
        } else {
            let data: CanvasCard = new CanvasCard(JSON.parse(arg))
            this.cards.push(data)
        }
    }
}
