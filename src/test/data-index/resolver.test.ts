import { Result } from "api/result";
import { Sources } from "data-index/source";
import { resolveSource } from "data-index/resolver";
import { matchingSourcePaths } from "data-index/resolver";

describe("matchingSourcePaths - folder handling", () => {
    test("absolute folder nodeExists short-circuits and returns folder files", () => {
        const index: any = {
            prefix: {
                nodeExists: (p: string) => p === "absoluteFolder",
                resolveRelative: (p: string, _origin?: string) => `resolved/${p}`,
                get: (p: string) => new Set([`${p}/file1.md`, `${p}/file2.md`]),
                pathExists: (_: string) => false,
            },
            vault: { getMarkdownFiles: () => [] },
        };

        const res = matchingSourcePaths(Sources.folder("absoluteFolder"), index, "");
        expect(res.successful).toBeTruthy();
        if (res.successful) {
            expect(res.value.has("absoluteFolder/file1.md")).toBeTruthy();
            expect(res.value.has("absoluteFolder/file2.md")).toBeTruthy();
        }
    });

    test("relative folder resolves via resolveRelative and prefix.get is used", () => {
        const index: any = {
            prefix: {
                nodeExists: (p: string) => p === "root/rel/fold",
                resolveRelative: (p: string, origin?: string) => {
                    if (p === "rel/fold" && origin === "a/origin.md") return "root/rel/fold";
                    return p;
                },
                get: (p: string) => new Set([`${p}/only.md`]),
                pathExists: (_: string) => false,
            },
            vault: { getMarkdownFiles: () => [] },
        };

        const res = matchingSourcePaths(Sources.folder("rel/fold"), index, "a/origin.md");
        expect(res.successful).toBeTruthy();
        if (res.successful) {
            expect(res.value.has("root/rel/fold/only.md")).toBeTruthy();
        }
    });

    test("folder not a node but file.md exists -> returns single file with .md suffix", () => {
        const index: any = {
            prefix: {
                nodeExists: (_: string) => false,
                resolveRelative: (p: string, _origin?: string) => p,
                get: (_: string) => new Set<string>(),
                pathExists: (p: string) => p === "maybeFile.md",
            },
            vault: { getMarkdownFiles: () => [] },
        };

        const res = matchingSourcePaths(Sources.folder("maybeFile"), index, "");
        expect(res.successful).toBeTruthy();
        if (res.successful) {
            expect(Array.from(res.value)).toEqual(["maybeFile.md"]);
        }
    });

    test("relative path variations normalize and resolve to same folder node", () => {
        const index: any = {
            prefix: {
                nodeExists: (p: string) => p === "root/rel/fold",
                resolveRelative: (p: string, origin?: string) => {
                    // Simulate normalization: any path that contains 'rel' and 'fold'
                    // should resolve to the canonical node 'root/rel/fold' when
                    // origin is 'a/origin.md'. This keeps the test concise while
                    // exercising './', '././', 'rel/./' and '../rel/../rel/fold' forms.
                    if (p.includes("rel") && p.includes("fold") && origin === "a/origin.md")
                        return "root/rel/fold";
                    return p;
                },
                get: (p: string) => new Set([`${p}/only.md`]),
                pathExists: (_: string) => false,
            },
            vault: { getMarkdownFiles: () => [] },
        };

        const variants = [
            "rel/fold",
            "./rel/fold",
            "rel/./fold",
            "../rel/../rel/fold",
            "././rel/fold",
        ];

        for (const v of variants) {
            const res = matchingSourcePaths(Sources.folder(v), index, "a/origin.md");
            expect(res.successful).toBeTruthy();
            if (res.successful) {
                expect(res.value.has("root/rel/fold/only.md")).toBeTruthy();
            }
        }
    });

    test("unusual '...' path does not resolve", () => {
        const index: any = {
            prefix: {
                nodeExists: (_: string) => false,
                resolveRelative: (p: string, _origin?: string) => p,
                get: (_: string) => new Set<string>(),
                pathExists: (_: string) => false,
            },
            vault: { getMarkdownFiles: () => [] },
        };

        const res = matchingSourcePaths(Sources.folder(".../notfound"), index, "");
        expect(res.successful).toBeTruthy();
        if (res.successful) {
            expect(res.value.size).toBe(0);
        }
    });

    test("boundary: '/../' should not escape vault (no upward traversal)", () => {
        const index: any = {
            prefix: {
                nodeExists: (_: string) => false,
                // Simulate a resolveRelative that would try to escape upwards.
                resolveRelative: (p: string, _origin?: string) => {
                    if (p === "/../") return "../outside/";
                    return p;
                },
                get: (_: string) => new Set<string>(),
                pathExists: (_: string) => false,
            },
            vault: { getMarkdownFiles: () => [] },
        };

        const res = matchingSourcePaths(Sources.folder("/../"), index, "a/origin.md");
        // Resolver should not allow escaping above the root; nothing should match.
        expect(res.successful).toBeTruthy();
        if (res.successful) {
            expect(res.value.size).toBe(0);
        }
    });
});

describe("resolveSource - CSV handling", () => {
    test("csv path resolves and maps rows to {path}#i ids", async () => {
        const index: any = {
            prefix: { resolveRelative: (p: string) => p },
            csv: {
                get: async (p: string) => Result.success([{ a: 1 }, { a: 2 }]),
            },
            pages: new Map(),
            vault: { getMarkdownFiles: () => [] },
            links: { getInverse: (_: string) => new Set<string>() },
            metadataCache: { getFirstLinkpathDest: (_: string) => undefined, resolvedLinks: {} },
        };

        const res = await resolveSource(Sources.csv("data.csv"), index, "");
        expect(res.successful).toBeTruthy();
        if (res.successful) {
            expect(res.value.length).toBe(2);
            expect(res.value[0].id).toBe("data.csv#0");
            expect(res.value[1].id).toBe("data.csv#1");
            expect(res.value[0].data).toEqual({ a: 1 });
        }
    });

    test("csv get failure propagates as failure", async () => {
        const index: any = {
            prefix: { resolveRelative: (p: string) => p },
            csv: {
                get: async (_: string) => Result.failure("could not read csv"),
            },
            pages: new Map(),
            vault: { getMarkdownFiles: () => [] },
            links: { getInverse: (_: string) => new Set<string>() },
            metadataCache: { getFirstLinkpathDest: (_: string) => undefined, resolvedLinks: {} },
        };

        const res = await resolveSource(Sources.csv("bad.csv"), index, "");
        expect(res.successful).toBeFalsy();
        if (!res.successful) {
            expect(res.error).toBe("could not read csv");
        }
    });
});
