import { Link } from "data-model/value";
import { DateTime } from "luxon";
import { SListItem, STask } from "./markdown";

export interface SCard {
    etags: string[];
    tags: string[];
    lists: SListItem[];
    tasks: STask[];
    [key: string]: any;
}

export interface SCanvas {
    file: {
        path: string;
        folder: string;
        name: string;
        link: Link;
        outlinks: Link[];
        inlinks: Link[];
        ctime: DateTime;
        cday: DateTime;
        mtime: DateTime;
        mday: DateTime;
        size: number;
        ext: string;
        starred: boolean;
        day?: DateTime;
        cards: SCard[];
    };

    /** Additional fields added by field data. */
    [key: string]: any;
}
