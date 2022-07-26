/** Serialized / API facing data types for Dataview objects. */

import { Link, Literal } from "data-model/value";
import { DateTime } from "luxon";
import { Pos } from "obsidian";

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
    /** The symbo used to start this list item, like '1.' or '1)' or '*'. */
    symbol: string;
    /** A link to the closest thing to this list item (a block, a section, or a file). */
    link: Link;
    /** The section that contains this list item. */
    section: Link;
    /** The path of the file that contains this item. */
    path: string;

    /** The line this item starts on. */
    line: number;
    /** The number of lines this item spans. */
    lineCount: number;
    /** The internal Obsidian tracker of the exact position of this line. */
    position: Pos;
    /** The line number of the list that this item is part of. */
    list: number;
    /** If present, the block ID for this item. */
    blockId?: string;
    /** The line number of the parent item to this list, if relevant. */
    parent?: number;
    /** The children elements of this list item. */
    children: SListItem[];
    /** Links contained inside this list item. */
    outlinks: Link[];

    /** The raw text of this item. */
    text: string;
    /**
     * If present, overrides 'text' when rendered in task views. You should not mutate 'text' since it is used to
     * validate a list item when editing it.
     */
    visual?: string;
    /** Whether this item has any metadata annotations on it. */
    annotated?: boolean;

    /** Any tags present in this task. */
    tags: string[];

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
    /** The status of this task, the text between the brackets ('[ ]'). Will be a space if the task is currently unchecked. */
    status: string;
    /** Indicates whether the task has any value other than empty space. */
    checked: boolean;
    /** Indicates whether the task explicitly has been marked "completed" ('x' or 'X'). */
    completed: boolean;
    /** Indicates whether the task and ALL subtasks have been completed. */
    fullyCompleted: boolean;

    /** If present, then the time that this task was created. */
    created?: Literal;
    /** If present, then the time that this task was due. */
    due?: Literal;
    /** If present, then the time that this task was completed. */
    completion?: Literal;
    /** If present, then the day that this task can be started. */
    start?: Literal;
    /** If present, then the day that work on this task is scheduled. */
    scheduled?: Literal;
}
