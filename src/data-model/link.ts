import { getFileTitle, normalizeHeaderForLink } from "util/normalize";

/**
 * Obsidian-style links to arbitary files, sections, and specially annotated blocks. Links have advanced functionality
 * in views (where they are rendered as clickable/embeddable links), and in the expression language (where they can
 * be used to look up the relevant metadata).
 */
export class Link {
    /** The file path this link points to. */
    public path: string;
    /** The display name associated with the link. */
    public display?: string;
    /** The block ID or header this link points to within a file, if relevant. */
    public subpath?: string;
    /** Internal value used to disambiguate between headers in a file with the exact same name. */
    public index?: number;
    /** Is this link an embedded link (!)? */
    public embed: boolean;
    /** The type of this link, which determines what 'subpath' refers to, if anything. */
    public type: "file" | "header" | "block";

    /** Create a link to a specific file. */
    public static file(path: string, embed: boolean = false, display?: string) {
        return new Link({
            path,
            embed,
            display,
            subpath: undefined,
            type: "file",
        });
    }

    /** Create a link to a specific file and header in that file. */
    public static header(path: string, header: string, embed?: boolean, display?: string) {
        // Headers need to be normalized to alpha-numeric & with extra spacing removed.
        return new Link({
            path,
            embed,
            display,
            subpath: normalizeHeaderForLink(header),
            type: "header",
        });
    }

    public static section(path: string, title: string, index?: number, embed?: boolean, display?: string) {
        return new Link({});
    }

    /** Create a link to a specific file and block in that file. */
    public static block(path: string, blockId: string, embed?: boolean, display?: string) {
        return new Link({
            path,
            embed,
            display,
            subpath: blockId,
            type: "block",
        });
    }

    public constructor(fields: Partial<Link>) {
        Object.assign(this, fields);
    }

    /** Checks for link equality (i.e., that the links are pointing to the same exact location). */
    public equals(other: Link): boolean {
        return (
            this.path == other.path &&
            this.type == other.type &&
            this.subpath == other.subpath &&
            (this.index == other.index || (!this.index && other.index == 0) || (!other.index && this.index == 0))
        );
    }

    public toString(): string {
        return this.markdown();
    }

    /** Return a new link which points to the same location but with a new display value. */
    public withDisplay(display?: string) {
        return new Link(Object.assign({}, this, { display }));
    }

    /** Convert a file link into a link to a specific header. */
    public withHeader(header: string) {
        return Link.header(this.path, header, this.embed, this.display);
    }

    /** Convert any link into a link to its file. */
    public toFile() {
        return Link.file(this.path, this.embed, this.display);
    }

    /** Convert this link into an embedded link. */
    public toEmbed(): Link {
        if (this.embed) return this;
        else {
            let link = new Link(this);
            link.embed = true;
            return link;
        }
    }

    /** Convert this link to markdown so it can be rendered. */
    public markdown(): string {
        let result = (this.embed ? "!" : "") + "[[" + this.path;

        if (this.type == "header") result += "#" + this.subpath;
        else if (this.type == "block") result += "#^" + this.subpath;

        if (this.display) result += "|" + this.display;
        else {
            result += "|" + getFileTitle(this.path);
            if (this.type == "header" || this.type == "block") result += " > " + this.subpath;
        }

        result += "]]";
        return result;
    }

    /** The stripped name of the file this link points into. */
    public fileName(): string {
        return getFileTitle(this.path).replace(".md", "");
    }
}
