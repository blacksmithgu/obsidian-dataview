import { FullIndex, IndexMap, ValueCaseInsensitiveIndexMap } from "data-index/index";
import { PageMetadata } from "data-model/markdown";
import { parseFolderList } from "util/normalize";
import { DateTime } from "luxon";
import { TFile } from "obsidian";

/** Build a FullIndex with just enough collaborators stubbed for the exclusion logic to run. */
function makeIndex(initial: string[] = [], files: TFile[] = []) {
    const state = { excluded: initial };
    const index = Object.create(FullIndex.prototype) as any;
    index.initialized = true;
    index.revision = 0;
    index.excludedFolders = () => state.excluded;
    index.onChange = jest.fn();
    index.pages = new Map<string, PageMetadata>();
    index.tags = new ValueCaseInsensitiveIndexMap();
    index.etags = new ValueCaseInsensitiveIndexMap();
    index.links = new IndexMap();
    index.vault = { getMarkdownFiles: () => files };
    index.metadataCache = { trigger: jest.fn(), getFirstLinkpathDest: jest.fn(() => null) };
    index.importer = {
        reload: jest.fn(async (file: TFile) => ({
            path: file.path,
            mtime: DateTime.fromMillis(file.stat.mtime),
            size: file.stat.size,
        })),
    };
    index.persister = { storeFile: jest.fn(async () => {}), loadFile: jest.fn(async () => null) };
    return { index: index as FullIndex & { importer: { reload: jest.Mock } }, state };
}

function makeFile(path: string): TFile {
    const file = new TFile();
    file.path = path;
    file.stat = { ctime: 1, mtime: 1000, size: 10 };
    return file;
}

function indexPage(index: FullIndex, path: string) {
    const page = new PageMetadata(path, { mtime: DateTime.fromMillis(1000), ctime: DateTime.fromMillis(1), size: 10 });
    index.pages.set(path, page);
    index.tags.set(path, new Set(["#t"]));
    index.etags.set(path, new Set(["#t"]));
    index.links.set(path, new Set(["other.md"]));
}

describe("FullIndex.isExcluded", () => {
    test("matches files inside an excluded folder and its subfolders", () => {
        const { index } = makeIndex(["Archive"]);

        expect(index.isExcluded("Archive/a.md")).toBe(true);
        expect(index.isExcluded("Archive/2024/b.md")).toBe(true);
    });

    test("does not match siblings that merely share a prefix, or files elsewhere", () => {
        const { index } = makeIndex(["Archive"]);

        expect(index.isExcluded("Archive2/a.md")).toBe(false);
        expect(index.isExcluded("Notes/Archive/a.md")).toBe(false);
        expect(index.isExcluded("a.md")).toBe(false);
    });

    test("matches nested folder paths", () => {
        const { index } = makeIndex(["Readwise/Raw"]);

        expect(index.isExcluded("Readwise/Raw/x.md")).toBe(true);
        expect(index.isExcluded("Readwise/Articles/x.md")).toBe(false);
    });

    test("excludes nothing by default", () => {
        const { index } = makeIndex([]);

        expect(index.isExcluded("Archive/a.md")).toBe(false);
    });
});

describe("FullIndex.reload with excluded folders", () => {
    test("skips excluded files without reading them", async () => {
        const { index } = makeIndex(["Archive"]);

        const result = await index.reload(makeFile("Archive/a.md"));

        expect(result).toEqual({ cached: false, skipped: true });
        expect(index.importer.reload).not.toHaveBeenCalled();
        expect(index.pages.has("Archive/a.md")).toBe(false);
    });

    test("still indexes files outside excluded folders", async () => {
        const { index } = makeIndex(["Archive"]);

        await index.reload(makeFile("Notes/a.md"));

        expect(index.importer.reload).toHaveBeenCalledTimes(1);
        expect(index.pages.has("Notes/a.md")).toBe(true);
    });
});

describe("FullIndex.rename with excluded folders", () => {
    test("drops a file moved into an excluded folder from every index", () => {
        const { index } = makeIndex(["Archive"]);
        indexPage(index, "Notes/a.md");

        index.rename(makeFile("Archive/a.md"), "Notes/a.md");

        expect(index.pages.has("Notes/a.md")).toBe(false);
        expect(index.pages.has("Archive/a.md")).toBe(false);
        expect(index.tags.get("Notes/a.md").size).toBe(0);
        expect(index.etags.get("Notes/a.md").size).toBe(0);
        expect(index.links.get("Notes/a.md").size).toBe(0);
    });

    test("indexes a file moved out of an excluded folder", () => {
        const { index } = makeIndex(["Archive"]);
        const reload = jest.spyOn(index, "reload").mockResolvedValue({ cached: false, skipped: false });
        const moved = makeFile("Notes/a.md");

        index.rename(moved, "Archive/a.md");

        expect(reload).toHaveBeenCalledWith(moved);
    });

    test("re-keys a file moved between folders that are both indexed", () => {
        const { index } = makeIndex(["Archive"]);
        indexPage(index, "Notes/a.md");

        index.rename(makeFile("Projects/a.md"), "Notes/a.md");

        expect(index.pages.has("Notes/a.md")).toBe(false);
        expect(index.pages.get("Projects/a.md")!.path).toBe("Projects/a.md");
    });
});

describe("FullIndex.refreshExclusions", () => {
    test("drops indexed files from a newly excluded folder", async () => {
        const { index, state } = makeIndex([], [makeFile("Archive/a.md"), makeFile("Notes/b.md")]);
        indexPage(index, "Archive/a.md");
        indexPage(index, "Notes/b.md");

        state.excluded = ["Archive"];
        await index.refreshExclusions();

        expect(index.pages.has("Archive/a.md")).toBe(false);
        expect(index.links.get("Archive/a.md").size).toBe(0);
        expect(index.pages.has("Notes/b.md")).toBe(true);
    });

    test("indexes files from a folder that is no longer excluded", async () => {
        const { index, state } = makeIndex(["Archive"], [makeFile("Archive/a.md"), makeFile("Notes/b.md")]);
        indexPage(index, "Notes/b.md");

        state.excluded = [];
        await index.refreshExclusions();

        expect(index.importer.reload).toHaveBeenCalledTimes(1);
        expect(index.pages.has("Archive/a.md")).toBe(true);
    });

    test("does not index files that are still excluded", async () => {
        const { index } = makeIndex(["Archive"], [makeFile("Archive/a.md")]);

        await index.refreshExclusions();

        expect(index.importer.reload).not.toHaveBeenCalled();
        expect(index.pages.size).toBe(0);
    });
});

describe("parseFolderList", () => {
    test("splits lines, trims, strips surrounding slashes, and drops blanks and duplicates", () => {
        expect(parseFolderList("  Archive/ \n\n/Readwise/Raw\nArchive\n   ")).toEqual(["Archive", "Readwise/Raw"]);
    });

    test("returns an empty list for empty input", () => {
        expect(parseFolderList("")).toEqual([]);
    });
});
