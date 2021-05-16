/** AST implementation for queries over data sources. */

/** The source of files for a query. */
export type Source = TagSource | FolderSource | LinkSource | EmptySource | NegatedSource | BinaryOpSource;
export type SourceOp = '&' | '|';

/** A tag as a source of data. */
export interface TagSource {
    type: 'tag';
    /** The tag to source from. */
    tag: string;
}

/** A folder prefix as a source of data. */
export interface FolderSource {
    type: 'folder';
    /** The folder prefix to source from. */
    folder: string;
}

/** Either incoming or outgoing links to a given file. */
export interface LinkSource {
    type: 'link';
    /** The file to look for links to/from.  */
    file: string;
    /**
     * The direction to look - if incoming, then all files linking to the target file. If outgoing, then all files
     * which the file links to.
     */
    direction: 'incoming' | 'outgoing';
}

/** A source which is everything EXCEPT the files returned by the given source. */
export interface NegatedSource {
    type: 'negate';
    /** The source to negate. */
    child: Source;
}

/** A source which yields nothing. */
export interface EmptySource {
    type: 'empty';
}

/** A source made by combining subsources with a logical operators. */
export interface BinaryOpSource {
    type: 'binaryop';
    op: SourceOp;
    left: Source;
    right: Source;
}

/** Utility functions for creating and manipulating sources. */
export namespace Sources {
    export function tag(tag: string): TagSource {
        return { type: 'tag', tag };
    }

    export function folder(prefix: string): FolderSource {
        return { type: 'folder', folder: prefix };
    }

    export function link(file: string, incoming: boolean): LinkSource {
        return { type: 'link', file, direction: incoming ? 'incoming' : 'outgoing' };
    }

    export function binaryOp(left: Source, op: SourceOp, right: Source): Source {
        return { type: 'binaryop', left, op, right };
    }

    export function negate(child: Source): NegatedSource {
        return { type: 'negate', child };
    }

    export function empty(): EmptySource {
        return { type: 'empty' };
    }
}
