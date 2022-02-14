/** Serialized / API facing data types for Dataview objects. */

import { Link, Literal } from "data-model/value";
import { DateTime } from "luxon";

export interface SMarkdownPage {
    file: {
        path: string;
        folder: string;
        name: string;
        link: Link;
        outlinks: Link[];
        inlinks: Link[];
        etags: string[];
        tags: string[];
        aliases: string[];
        lists: SListItem[];
        tasks: STask[];
        ctime: DateTime;
        cday: DateTime;
        mtime: DateTime;
        mday: DateTime;
        size: number;
        ext: string;
        starred: boolean;

        day?: DateTime;
    };

    /** Additional fields added by field data. */
    [key: string]: any;
}

////////////////////////
// <-- List Items --> //
////////////////////////

/** A serialized list item. */
export type SListItem = SListEntry | STask;

/** Shared data between list items. */
export interface SListItemBase {
    symbol: string;
    link: Link;
    section: Link;
    path: string;

    line: number;
    lineCount: number;
    list: number;
    blockId?: string;
    parent?: number;
    children: SListItem[];

    text: string;
    annotated?: boolean;

    /** @deprecated use 'children' instead. */
    subtasks: SListItem[];
    /** @deprecated use 'task' instead. */
    real: boolean;
    /** @deprecated use 'section' instead. */
    header: Link;

    /** Additional fields added by annotations. */
    [key: string]: any;
}

/** A serialized list item as seen by users; this is not a task. */
export interface SListEntry extends SListItemBase {
    task: false;
}

/** A serialized task. */
export interface STask extends SListItemBase {
    task: true;
    status: string;
    completed: boolean;
    fullyCompleted: boolean;

    created?: Literal;
    due?: Literal;
    completion?: Literal;
}
