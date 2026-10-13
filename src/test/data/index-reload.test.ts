import { FullIndex, IndexMap, ValueCaseInsensitiveIndexMap } from "data-index/index";
import { PageMetadata } from "data-model/markdown";
import { Link } from "data-model/value";
import { DateTime } from "luxon";
import { TFile } from "obsidian";

/** Build a FullIndex with just enough collaborators stubbed for reload() and finish() to run. */
function makeIndex(opts: { resolve?: (link: string) => string | null; imported?: Partial<PageMetadata> } = {}) {
    const index = Object.create(FullIndex.prototype) as any;
    index.initialized = true;
    index.revision = 0;
    index.onChange = jest.fn();
    index.pages = new Map<string, PageMetadata>();
    index.tags = new ValueCaseInsensitiveIndexMap();
    index.etags = new ValueCaseInsensitiveIndexMap();
    index.links = new IndexMap();
    index.metadataCache = {
        trigger: jest.fn(),
        getFirstLinkpathDest: jest.fn((link: string) => {
            const resolved = opts.resolve ? opts.resolve(link) : null;
            return resolved ? { path: resolved } : null;
        }),
    };
    index.importer = { reload: jest.fn(async () => opts.imported ?? {}) };
    index.persister = { storeFile: jest.fn(async () => {}), loadFile: jest.fn(async () => null) };
    return index as FullIndex & { importer: { reload: jest.Mock }; persister: { storeFile: jest.Mock } };
}

function makeFile(path: string, mtime: number, size: number): TFile {
    const file = new TFile();
    file.path = path;
    file.stat = { ctime: 1, mtime, size };
    return file;
}

function makePage(path: string, mtime: number, size: number, links: Link[] = []): PageMetadata {
    return new PageMetadata(path, { mtime: DateTime.fromMillis(mtime), ctime: DateTime.fromMillis(1), size, links });
}

describe("FullIndex.reload for an already indexed file", () => {
    test("does not re-read or re-store a file that has not changed", async () => {
        const index = makeIndex();
        index.pages.set("a.md", makePage("a.md", 1000, 10));

        const result = await index.reload(makeFile("a.md", 1000, 10));

        expect(result).toEqual({ cached: false, skipped: false });
        expect(index.importer.reload).not.toHaveBeenCalled();
        expect(index.persister.storeFile).not.toHaveBeenCalled();
        expect(index.pages.has("a.md")).toBe(true);
    });

    test("re-resolves links of an unchanged file, for example when the link target was created later", async () => {
        const index = makeIndex({ resolve: link => (link === "Note" ? "Folder/Note.md" : null) });
        index.pages.set("a.md", makePage("a.md", 1000, 10, [Link.file("Note")]));

        await index.reload(makeFile("a.md", 1000, 10));

        expect(index.importer.reload).not.toHaveBeenCalled();
        expect(index.pages.get("a.md")!.links.map(l => l.path)).toEqual(["Folder/Note.md"]);
        expect(Array.from(index.links.map.get("a.md") ?? [])).toEqual(["Folder/Note.md"]);
    });

    test("notifies listeners that the page was updated", async () => {
        const index = makeIndex();
        index.pages.set("a.md", makePage("a.md", 1000, 10));

        await index.reload(makeFile("a.md", 1000, 10));

        expect(index.metadataCache.trigger).toHaveBeenCalledWith(
            "dataview:metadata-change",
            "update",
            expect.anything()
        );
    });

    test("re-imports a file whose mtime changed", async () => {
        const index = makeIndex({ imported: { path: "a.md", mtime: DateTime.fromMillis(2000), size: 10 } });
        index.pages.set("a.md", makePage("a.md", 1000, 10));

        await index.reload(makeFile("a.md", 2000, 10));

        expect(index.importer.reload).toHaveBeenCalledTimes(1);
        expect(index.persister.storeFile).toHaveBeenCalledTimes(1);
        expect(index.pages.get("a.md")!.mtime.toMillis()).toBe(2000);
    });

    test("re-imports a file whose size changed even if the mtime did not", async () => {
        const index = makeIndex({ imported: { path: "a.md", mtime: DateTime.fromMillis(1000), size: 11 } });
        index.pages.set("a.md", makePage("a.md", 1000, 10));

        await index.reload(makeFile("a.md", 1000, 11));

        expect(index.importer.reload).toHaveBeenCalledTimes(1);
        expect(index.pages.get("a.md")!.size).toBe(11);
    });
});

describe("FullIndex.reload for a file that is not indexed yet", () => {
    test("imports it once the index is initialized", async () => {
        const index = makeIndex({ imported: { path: "new.md", mtime: DateTime.fromMillis(5), size: 3 } });

        await index.reload(makeFile("new.md", 5, 3));

        expect(index.importer.reload).toHaveBeenCalledTimes(1);
        expect(index.pages.has("new.md")).toBe(true);
    });

    test("ignores non-markdown files", async () => {
        const index = makeIndex();

        const result = await index.reload(makeFile("image.png", 5, 3));

        expect(result).toEqual({ cached: false, skipped: true });
        expect(index.importer.reload).not.toHaveBeenCalled();
    });
});
