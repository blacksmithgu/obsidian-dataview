/** Tests for preserving user scroll position across Dataview re-renders (obsidian-dataview#2208). */
import { App, Vault } from "obsidian";
import { h } from "preact";
import { DEFAULT_SETTINGS } from "settings";
import { ReactRenderer, useIndexBackedState } from "ui/markdown";
import { FullIndex } from "data-index";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { DataviewJSRenderer } from "ui/views/js-view";
import { DataviewApi } from "api/plugin-api";
import { asyncEvalInContext } from "api/inline-api";
import {
    beginHeightPreserve,
    captureViewScroll,
    restoreViewScroll,
    restoreViewScrollNow,
    scheduleSettledRestore,
    CapturedScroll,
} from "util/scroll";

jest.mock("api/inline-api", () => ({
    asyncEvalInContext: jest.fn(),
    DataviewInlineApi: class {},
}));

// Jest's jsdom environment resolves preact's "browser" export condition to the ESM build,
// which the CJS runtime cannot parse. Pin the CJS builds (relative paths bypass package exports).
jest.mock("preact", () => require("../../../node_modules/preact/dist/preact.js"));
jest.mock("preact/hooks", () => require("../../../node_modules/preact/hooks/dist/hooks.js"));
jest.mock("preact/compat", () => require("../../../node_modules/preact/compat/dist/compat.js"));

/** Resolves on the next animation frame, so rAF-deferred writes have been applied. */
function nextFrame(): Promise<void> {
    return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
}

describe("captureViewScroll", () => {
    let outer: HTMLElement;
    let mid: HTMLElement;
    let leaf: HTMLElement;

    beforeEach(() => {
        outer = document.createElement("div");
        mid = document.createElement("div");
        leaf = document.createElement("div");
        outer.appendChild(mid);
        mid.appendChild(leaf);
        document.body.appendChild(outer);
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("finds the nearest scrolled ancestor", () => {
        mid.scrollTop = 500;
        outer.scrollTop = 100;

        let captured = captureViewScroll(leaf);
        expect(captured).toEqual({ el: mid, top: 500 });
    });

    test("returns null when no ancestor is scrolled", () => {
        expect(captureViewScroll(leaf)).toBeNull();
    });

    test("falls back to the .view-content element when the walk finds nothing", () => {
        // The container itself is the view content (e.g. the inline render container);
        // closest() includes the element itself, so the fallback recovers it.
        leaf.className = "view-content";
        leaf.scrollTop = 42;

        let captured = captureViewScroll(leaf);
        expect(captured).toEqual({ el: leaf, top: 42 });
    });
});

describe("restoreViewScroll", () => {
    let owner: HTMLElement;

    beforeEach(() => {
        owner = document.createElement("div");
        document.body.appendChild(owner);
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("restores the captured top after a requestAnimationFrame", async () => {
        owner.scrollTop = 0;
        let captured: CapturedScroll = { el: owner, top: 250 };

        restoreViewScroll(captured);
        expect(owner.scrollTop).toBe(0); // not yet: the write is rAF-deferred

        await nextFrame();
        expect(owner.scrollTop).toBe(250);
    });

    test("is a no-op for a null capture", async () => {
        restoreViewScroll(null);
        await nextFrame();
        expect(owner.scrollTop).toBe(0);
    });

    test("is a no-op when the captured top is zero", async () => {
        owner.scrollTop = 99; // stale value; a top-0 capture must not clobber anything
        restoreViewScroll({ el: owner, top: 0 });
        await nextFrame();
        expect(owner.scrollTop).toBe(99);
    });

    test("restores two independent views to their own owners", async () => {
        let ownerB = document.createElement("div");
        let leafA = document.createElement("div");
        let leafB = document.createElement("div");
        owner.appendChild(leafA);
        ownerB.appendChild(leafB);
        document.body.appendChild(ownerB);

        owner.scrollTop = 100;
        ownerB.scrollTop = 200;
        let capturedA = captureViewScroll(leafA);
        let capturedB = captureViewScroll(leafB);
        expect(capturedA).toEqual({ el: owner, top: 100 });
        expect(capturedB).toEqual({ el: ownerB, top: 200 });

        owner.scrollTop = 0;
        ownerB.scrollTop = 0;
        restoreViewScroll(capturedA);
        restoreViewScroll(capturedB);
        await nextFrame();

        expect(owner.scrollTop).toBe(100);
        expect(ownerB.scrollTop).toBe(200);
    });
});

describe("DataviewRefreshableRenderer scroll preservation", () => {
    function setup() {
        let viewContent = document.createElement("div");
        viewContent.className = "view-content";
        document.body.appendChild(viewContent);
        let container = document.createElement("div");
        viewContent.appendChild(container);
        let workspace = Object.assign(new Vault(), { getLeavesOfType: () => [] });
        let app = { workspace } as unknown as App;
        let index = { revision: 1 } as FullIndex;
        return { viewContent, container, workspace, app, index, settings: DEFAULT_SETTINGS };
    }

    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    test("preserves the view scroll position across an async re-render", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();

        class TestRenderer extends DataviewRefreshableRenderer {
            renders = 0;
            async render() {
                // Mimic DataviewJSRenderer: clear, then rebuild asynchronously.
                this.container.innerHTML = "";
                this.renders++;
                await Promise.resolve();
                this.container.appendChild(document.createElement("div"));
            }
        }

        let renderer = new TestRenderer(container, index, app, settings);
        renderer.onload();
        expect(renderer.renders).toBe(1);

        // The user has scrolled the leaf view, then the index updates.
        viewContent.scrollTop = 800;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");

        // The browser synchronously clamps scrollTop to 0 while the content is collapsed.
        viewContent.scrollTop = 0;
        await Promise.resolve();
        await Promise.resolve();
        expect(renderer.renders).toBe(2);
        expect(viewContent.scrollTop).toBe(0); // content rebuilt, but the restore is still deferred

        await nextFrame();
        await nextFrame();
        expect(viewContent.scrollTop).toBe(800); // written at T1 (double rAF)
    });

    test("leaves the scroll position alone when the view was not scrolled", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();

        class TestRenderer extends DataviewRefreshableRenderer {
            async render() {
                this.container.innerHTML = "";
                await Promise.resolve();
            }
        }

        let renderer = new TestRenderer(container, index, app, settings);
        renderer.onload();

        viewContent.scrollTop = 0;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");
        await Promise.resolve();
        await Promise.resolve();
        await nextFrame();

        expect(viewContent.scrollTop).toBe(0);
    });

    test("preserves scroll for DataviewJSRenderer refreshes", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();
        let jsSettings = { ...settings, enableDataviewJs: true };
        let api = { index, app, settings: jsSettings } as unknown as DataviewApi;

        let renderer = new DataviewJSRenderer(api, 'dv.view("text", "hello")', container, "test.md");
        renderer.onload();
        expect(asyncEvalInContext).toHaveBeenCalledTimes(1);

        viewContent.scrollTop = 500;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");
        viewContent.scrollTop = 0;
        await Promise.resolve();
        await Promise.resolve();
        expect(asyncEvalInContext).toHaveBeenCalledTimes(2);
        expect(viewContent.scrollTop).toBe(0);

        await nextFrame();
        await nextFrame();
        expect(viewContent.scrollTop).toBe(500); // written at T1 (double rAF)
    });

    test("double refresh in flight restores to the user's latest position", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();

        class RacyRenderer extends DataviewRefreshableRenderer {
            async render() {
                this.container.innerHTML = "";
                for (let i = 0; i < 3; i++) await Promise.resolve();
                this.container.appendChild(document.createElement("div"));
            }
        }

        let renderer = new RacyRenderer(container, index, app, settings);
        renderer.onload();
        await new Promise<void>(resolve => setTimeout(resolve, 0));

        // First refresh: user scrolled to 300.
        viewContent.scrollTop = 300;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");

        // Second refresh fires while render #1 is still in flight: user has moved to 700.
        viewContent.scrollTop = 700;
        index.revision = 3;
        workspace.trigger("dataview:refresh-views");

        // The browser clamps the scroll while the content is collapsed.
        viewContent.scrollTop = 0;
        await new Promise<void>(resolve => setTimeout(resolve, 0));

        // The second schedule supersedes the first (same container); both settle at T1
        // (double rAF after their render resolves); the fresher capture wins.
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        expect(viewContent.scrollTop).toBe(700);
    });
});

describe("useIndexBackedState (DQL) scroll preservation", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    test("preserves the scroll position across a DQL refresh", async () => {
        let viewContent = document.createElement("div");
        viewContent.className = "view-content";
        document.body.appendChild(viewContent);
        let container = document.createElement("div");
        viewContent.appendChild(container);
        let index = { revision: 1 } as FullIndex;
        let vault = new Vault();
        let app = {
            workspace: {
                on: vault.on.bind(vault),
                trigger: vault.trigger.bind(vault),
                offref: () => {},
                getLeavesOfType: () => [],
            },
        } as unknown as App;

        let computed = 0;
        function DqlView() {
            let value = useIndexBackedState<string>(container, app, DEFAULT_SETTINGS, index, "", async () => {
                await Promise.resolve();
                computed++;
                return "v" + index.revision;
            });
            return h("span", { class: "dql" }, value);
        }

        let renderer = new ReactRenderer({ app, index, settings: DEFAULT_SETTINGS, container }, h(DqlView, {}));
        renderer.onload();
        // Let preact effects register the refresh handlers and the initial compute settle.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        expect(computed).toBe(1);
        expect(container.querySelector(".dql")?.textContent).toBe("v1");

        // The user scrolls the leaf view, then the index updates.
        viewContent.scrollTop = 900;
        index.revision = 2;
        app.workspace.trigger("dataview:refresh-views");

        // The browser synchronously clamps scrollTop to 0 while the content is collapsed.
        viewContent.scrollTop = 0;
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        expect(computed).toBe(2);
        expect(container.querySelector(".dql")?.textContent).toBe("v2");
        expect(viewContent.scrollTop).toBe(0); // content rebuilt; the restore is still frame-deferred

        await nextFrame();
        await nextFrame();
        expect(viewContent.scrollTop).toBe(900); // written at T1 (double rAF)

        renderer.onunload();
    });
});

describe("beginHeightPreserve", () => {
    let container: HTMLElement;

    function withHeight(el: HTMLElement, height: number): void {
        Object.defineProperty(el, "offsetHeight", { value: height, configurable: true });
    }

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("sets min-height to the current height, and release restores the previous value", () => {
        withHeight(container, 240);

        let guard = beginHeightPreserve(container);
        expect(guard.height).toBe(240);
        expect(container.style.minHeight).toBe("240px");

        guard.release();
        expect(container.style.minHeight).toBe("");
    });

    test("release restores a pre-existing min-height rather than clearing it", () => {
        withHeight(container, 240);
        container.style.minHeight = "120px";

        let guard = beginHeightPreserve(container);
        expect(container.style.minHeight).toBe("240px");

        guard.release();
        expect(container.style.minHeight).toBe("120px");
    });

    test("is a no-op when the container has no height", () => {
        // jsdom performs no layout, so offsetHeight is 0 and there is nothing to preserve.
        expect(container.offsetHeight).toBe(0);

        let guard = beginHeightPreserve(container);
        expect(guard.height).toBe(0);
        expect(container.style.minHeight).toBe("");

        guard.release();
        expect(container.style.minHeight).toBe("");
    });

    test("refcounts overlapping begins so the guard survives the first release", () => {
        withHeight(container, 300);

        let first = beginHeightPreserve(container);
        let second = beginHeightPreserve(container);
        expect(container.style.minHeight).toBe("300px");

        first.release();
        expect(container.style.minHeight).toBe("300px"); // still held by `second`

        second.release();
        expect(container.style.minHeight).toBe("");
    });
});

describe("restoreViewScroll with a height guard", () => {
    let owner: HTMLElement;

    beforeEach(() => {
        owner = document.createElement("div");
        document.body.appendChild(owner);
    });

    afterEach(() => {
        document.body.innerHTML = "";
    });

    test("writes the captured pixel when the height delta is under 4px", async () => {
        owner.scrollTop = 0;
        let container = document.createElement("div");
        document.body.appendChild(container);
        Object.defineProperty(container, "offsetHeight", { value: 302, configurable: true });

        restoreViewScroll({ el: owner, top: 150 }, 300, container);
        await nextFrame();
        expect(owner.scrollTop).toBe(150);
    });

    test("skips the pixel write when the height delta is at least 4px", async () => {
        owner.scrollTop = 42; // whatever the content anchoring left the view at
        let container = document.createElement("div");
        document.body.appendChild(container);
        Object.defineProperty(container, "offsetHeight", { value: 304, configurable: true });

        restoreViewScroll({ el: owner, top: 150 }, 300, container);
        await nextFrame();
        expect(owner.scrollTop).toBe(42); // a stale pixel offset must not jump the view
    });

    test("takes the pixel path when the container is omitted", async () => {
        owner.scrollTop = 0;

        restoreViewScroll({ el: owner, top: 80 }, 300, undefined);
        await nextFrame();
        expect(owner.scrollTop).toBe(80);
    });

    test("writes the captured pixel immediately via restoreViewScrollNow", () => {
        owner.scrollTop = 0;

        restoreViewScrollNow({ el: owner, top: 150 }, 300, 300);
        expect(owner.scrollTop).toBe(150);
    });
});

describe("restoreViewScroll write-time height read (#2208 commit 3)", () => {
    let owner: HTMLElement;
    let container: HTMLElement;
    let height: number;
    let heightReads = 0;
    let pending: FrameRequestCallback[] = [];
    let realRAF: typeof window.requestAnimationFrame;

    beforeEach(() => {
        owner = document.createElement("div");
        container = document.createElement("div");
        document.body.appendChild(owner);
        document.body.appendChild(container);
        height = 77; // the pre-commit shell height a .then()-time reader would see
        heightReads = 0;
        pending = [];
        realRAF = window.requestAnimationFrame;
        // Controllable fake container: the height changes between scheduling and the rAF tick.
        Object.defineProperty(container, "offsetHeight", {
            get: () => {
                heightReads++;
                return height;
            },
            configurable: true,
        });
    });

    afterEach(() => {
        window.requestAnimationFrame = realRAF;
        document.body.innerHTML = "";
    });

    function holdRaf(): void {
        window.requestAnimationFrame = (cb: FrameRequestCallback) => {
            pending.push(cb);
            return pending.length;
        };
    }

    function fireRaf(): void {
        for (const cb of pending.splice(0)) cb(16);
    }

    test("measures the height at WRITE TIME: stale 77px at schedule, 1019 at frame -> pixel write", () => {
        holdRaf();
        owner.scrollTop = 0;
        height = 77;

        restoreViewScroll({ el: owner, top: 434 }, 1019, container);

        // Nothing may be measured at schedule time; the decision happens inside the frame.
        expect(heightReads).toBe(0);
        expect(owner.scrollTop).toBe(0);

        // The rebuilt content commits and lays out before the frame: the write-time read sees 1019.
        height = 1019;
        fireRaf();

        expect(heightReads).toBeGreaterThanOrEqual(1); // the read happened at write time
        expect(owner.scrollTop).toBe(434); // |1019 - 1019| < 4 -> the pixel write ran
    });

    test("skips the write when the WRITE-TIME height differs from the capture by >= 4px", () => {
        holdRaf();
        owner.scrollTop = 0;
        height = 77;

        restoreViewScroll({ el: owner, top: 434 }, 1019, container);

        height = 500; // the rebuilt content is a genuinely different size
        fireRaf();

        expect(owner.scrollTop).toBe(0); // |500 - 1019| >= 4 -> the pixel write was skipped
    });
});

describe("scheduleSettledRestore (DOM-only settle window, #2208)", () => {
    let owner: HTMLElement;
    let container: HTMLElement;
    let captured: CapturedScroll;
    let containerHeight: number;

    /** The scroll listeners the settle windows attached to the owner (in schedule order). */
    let scrollHandlers: EventListener[];

    /** Drives the scroll-event decision with a fake platform event payload. */
    function fire(handler: EventListener, isTrusted: boolean): void {
        // jsdom marks Event.isTrusted non-configurable (and always false), so build a bare
        // Event-shaped payload: only the isTrusted flag is observable by the window.
        let e = Object.create(Event.prototype);
        e.isTrusted = isTrusted;
        handler(e);
    }

    /** Advances to T1 (the double rAF after scheduling). */
    function toT1(): void {
        jest.advanceTimersByTime(64);
    }

    beforeEach(() => {
        jest.useFakeTimers();
        owner = document.createElement("div");
        container = document.createElement("div");
        owner.appendChild(container);
        document.body.appendChild(owner);
        containerHeight = 240;
        Object.defineProperty(container, "offsetHeight", {
            get: () => containerHeight,
            configurable: true,
        });
        owner.scrollTop = 0; // the browser clamped the scroll while the content was collapsed
        captured = { el: owner, top: 500 };
        // Capture the scroll listeners at registration time (typed, no addEventListener spy
        // casts): the window's decision is driven by calling them directly with fake
        // `{ isTrusted }` payloads, since jsdom events are always untrusted.
        scrollHandlers = [];
        let origAdd = owner.addEventListener;
        owner.addEventListener = (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void => {
            if (type === "scroll" && typeof listener === "function") scrollHandlers.push(listener);
            origAdd.call(owner, type, listener, options);
        };
    });

    afterEach(() => {
        jest.useRealTimers();
        document.body.innerHTML = "";
    });

    test("T1: raw pixel write, guard released before the write, window opens on the owner", () => {
        let guard = beginHeightPreserve(container);
        expect(container.style.minHeight).toBe("240px");

        scheduleSettledRestore(captured, container, guard);
        expect(owner.scrollTop).toBe(0); // not before T1
        expect(scrollHandlers.length).toBe(0);

        toT1();

        expect(container.style.minHeight).toBe(""); // guard released at T1, before the height read
        expect(owner.scrollTop).toBe(500); // the raw pixel write of captured.top
        expect(scrollHandlers.length).toBe(1); // the re-assert window is watching the owner
    });

    test("T1: write-time height delta >= 4px -> the write is skipped and no window opens", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);

        containerHeight = 400; // the rebuilt content is a genuinely different size
        toT1();

        expect(container.style.minHeight).toBe(""); // the guard is still released at T1
        expect(owner.scrollTop).toBe(0); // the content anchoring is authoritative
        expect(scrollHandlers.length).toBe(0);
    });

    test("untrusted off-target scroll -> re-assert once, target re-measured after the write", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);
        toT1();
        expect(owner.scrollTop).toBe(500);

        owner.scrollTop = 999; // a late programmatic overwrite (the keep-caret-visible class)
        fire(scrollHandlers[0], false);

        expect(owner.scrollTop).toBe(500); // re-written to the captured top
    });

    test("untrusted on-target scroll (<= 4px) -> no re-assert", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);
        toT1();

        owner.scrollTop = 503; // within tolerance of the target
        fire(scrollHandlers[0], false);
        expect(owner.scrollTop).toBe(503); // the captured-top write did not run
    });

    test("trusted scroll -> window cancelled (never fight the user)", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);
        toT1();

        fire(scrollHandlers[0], true);
        owner.scrollTop = 999;
        fire(scrollHandlers[0], false); // the window is closed: no re-assert
        expect(owner.scrollTop).toBe(999);
    });

    test("cap: at most 3 re-asserts, the 4th off-target event is ignored", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);
        toT1();

        for (let i = 0; i < 3; i++) {
            owner.scrollTop = 999;
            fire(scrollHandlers[0], false);
            expect(owner.scrollTop).toBe(500);
        }
        owner.scrollTop = 999;
        fire(scrollHandlers[0], false);
        expect(owner.scrollTop).toBe(999); // the cap: no 4th re-assert
    });

    test("2s expiry closes the window", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);
        toT1();

        jest.advanceTimersByTime(2000);
        owner.scrollTop = 999;
        fire(scrollHandlers[0], false);
        expect(owner.scrollTop).toBe(999);
    });

    test("supersede: a newer schedule on the same container cancels the earlier window", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);
        toT1();
        expect(owner.scrollTop).toBe(500);
        let firstHandler = scrollHandlers[0];

        let captured2 = { el: owner, top: 600 };
        let guard2 = beginHeightPreserve(container);
        scheduleSettledRestore(captured2, container, guard2);
        toT1();
        expect(owner.scrollTop).toBe(600); // the fresher capture won

        // The first window is dead: its handler must no longer re-assert.
        owner.scrollTop = 999;
        fire(firstHandler, false);
        expect(owner.scrollTop).toBe(999);
        fire(scrollHandlers[1], false);
        expect(owner.scrollTop).toBe(600); // only the newest window re-asserts
    });

    test("supersede before T1: the superseded window's guard is released (no min-height leak)", () => {
        let guard1 = beginHeightPreserve(container); // guard 1
        scheduleSettledRestore(captured, container, guard1);

        // The newer refresh fires before T1: guard 2 is refcounted on the same element.
        let guard2 = beginHeightPreserve(container);
        expect(container.style.minHeight).toBe("240px");
        let captured2 = { el: owner, top: 600 };
        scheduleSettledRestore(captured2, container, guard2); // supersedes window 1 -> releases guard 1
        expect(container.style.minHeight).toBe("240px"); // guard 2 still holds

        toT1();
        expect(container.style.minHeight).toBe(""); // released at the newest window's T1
        expect(owner.scrollTop).toBe(600);
        expect(scrollHandlers.length).toBe(1); // only the newest window opened
    });

    test("container detach -> cancel", () => {
        let guard = beginHeightPreserve(container);
        scheduleSettledRestore(captured, container, guard);
        toT1();

        container.remove();
        owner.scrollTop = 999;
        fire(scrollHandlers[0], false);
        expect(owner.scrollTop).toBe(999); // the window cancelled on detach
    });

    test("no capture (null): guard released at T1, no window", () => {
        let guard = beginHeightPreserve(container);
        expect(container.style.minHeight).toBe("240px");

        scheduleSettledRestore(null, container, guard);
        toT1();

        expect(container.style.minHeight).toBe("");
        expect(scrollHandlers.length).toBe(0);
    });
});

describe("DataviewRefreshableRenderer height guard", () => {
    function setup() {
        let viewContent = document.createElement("div");
        viewContent.className = "view-content";
        document.body.appendChild(viewContent);
        let container = document.createElement("div");
        viewContent.appendChild(container);
        let workspace = Object.assign(new Vault(), { getLeavesOfType: () => [] });
        let app = { workspace } as unknown as App;
        let index = { revision: 1 } as FullIndex;
        return { viewContent, container, workspace, app, index, settings: DEFAULT_SETTINGS };
    }

    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    test("applies the guard before the renderer clears the container, and releases it on resolve", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();
        Object.defineProperty(container, "offsetHeight", { value: 240, configurable: true });

        let minHeightAtClear: string | null = null;
        class GuardProbeRenderer extends DataviewRefreshableRenderer {
            async render() {
                minHeightAtClear = this.container.style.minHeight; // recorded BEFORE the clear
                this.container.innerHTML = "";
                await Promise.resolve();
                this.container.appendChild(document.createElement("div"));
            }
        }

        let renderer = new GuardProbeRenderer(container, index, app, settings);
        renderer.onload();
        expect(container.style.minHeight).toBe(""); // the initial onload render is unguarded

        viewContent.scrollTop = 300;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");

        expect(minHeightAtClear).toBe("240px"); // the guard was held BEFORE the content was cleared

        // The browser synchronously clamps scrollTop to 0 while the content is collapsed.
        viewContent.scrollTop = 0;
        await Promise.resolve();
        await Promise.resolve();
        expect(container.style.minHeight).toBe("240px"); // still held until T1

        await nextFrame();
        await nextFrame();
        expect(container.style.minHeight).toBe(""); // released at T1, before the write
        expect(viewContent.scrollTop).toBe(300); // same height -> the pixel path ran
    });

    test("releases the guard and restores the scroll when the DataviewJS eval throws", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();
        Object.defineProperty(container, "offsetHeight", { value: 240, configurable: true });

        // Obsidian patches these onto HTMLElement; jsdom does not, so provide stand-ins
        // for the renderErrorPre path.
        (container as unknown as Record<string, unknown>).createEl = (tag: string, attrs?: { cls?: string[] }) => {
            let el = document.createElement(tag);
            if (attrs?.cls) el.className = attrs.cls.join(" ");
            container.appendChild(el);
            return el;
        };
        if (typeof HTMLElement.prototype.appendText !== "function") {
            HTMLElement.prototype.appendText = function (this: HTMLElement, text: string) {
                this.appendChild(document.createTextNode(text));
                return this;
            };
        }

        let jsSettings = { ...settings, enableDataviewJs: true };
        let api = { index, app, settings: jsSettings } as unknown as DataviewApi;

        (asyncEvalInContext as jest.Mock).mockClear();
        let renderer = new DataviewJSRenderer(api, "throw new Error('boom')", container, "test.md");
        renderer.onload();
        expect(asyncEvalInContext).toHaveBeenCalledTimes(1);

        (asyncEvalInContext as jest.Mock).mockRejectedValueOnce(new Error("boom"));
        viewContent.scrollTop = 500;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");

        // render() swallows the eval error (renders the error pre) and resolves; the guard
        // is held until T1 and released on that path too.
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
        expect(container.innerHTML).toContain("Evaluation Error");
        expect(container.style.minHeight).toBe("240px"); // still held until T1
        expect(asyncEvalInContext).toHaveBeenCalledTimes(2);

        await nextFrame();
        await nextFrame();
        expect(container.style.minHeight).toBe(""); // released at T1
        expect(viewContent.scrollTop).toBe(500);
    });

    test("holds the guard until the last in-flight refresh releases it", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();
        Object.defineProperty(container, "offsetHeight", { value: 240, configurable: true });

        class RacyRenderer extends DataviewRefreshableRenderer {
            async render() {
                this.container.innerHTML = "";
                for (let i = 0; i < 3; i++) await new Promise<void>(resolve => setTimeout(resolve, 0));
                this.container.appendChild(document.createElement("div"));
            }
        }

        let renderer = new RacyRenderer(container, index, app, settings);
        renderer.onload();
        expect(container.style.minHeight).toBe("");

        // First refresh: user scrolled to 300.
        viewContent.scrollTop = 300;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");

        // Second refresh fires while render #1 is still in flight: user has moved to 700.
        viewContent.scrollTop = 700;
        index.revision = 3;
        workspace.trigger("dataview:refresh-views");

        // Both refreshes are in flight; the guard is refcounted and stays applied.
        expect(container.style.minHeight).toBe("240px");

        // Both windows settle at T1 (double rAF after each render resolves); the second
        // supersedes the first, and the guard is released only after the LAST one releases.
        await new Promise<void>(resolve => setTimeout(resolve, 50));
        expect(container.style.minHeight).toBe(""); // released only after the LAST refresh

        expect(viewContent.scrollTop).toBe(700); // the fresher capture won
    });

    test("skips the stale pixel write when the rebuilt content changes height", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();
        let containerHeight = 240;
        Object.defineProperty(container, "offsetHeight", { get: () => containerHeight, configurable: true });

        class GrowingRenderer extends DataviewRefreshableRenderer {
            async render() {
                this.container.innerHTML = "";
                await Promise.resolve();
                containerHeight = 400; // the rebuilt content is 160px taller
                this.container.appendChild(document.createElement("div"));
            }
        }

        let renderer = new GrowingRenderer(container, index, app, settings);
        renderer.onload();

        viewContent.scrollTop = 300;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");

        // The browser clamps the scroll while the content is collapsed.
        viewContent.scrollTop = 0;
        await Promise.resolve();
        await Promise.resolve();
        expect(container.style.minHeight).toBe("240px"); // guard held until T1

        await nextFrame();
        await nextFrame();
        expect(container.style.minHeight).toBe(""); // released at T1
        // The height changed by more than 4px, so the content anchoring is authoritative and
        // the captured pixel offset must NOT be written.
        expect(viewContent.scrollTop).toBe(0);
    });

    test("a stale .then-time read (1019 -> 77 transient -> 1019 by frame) no longer skips the restore", async () => {
        let { viewContent, container, workspace, app, index, settings } = setup();
        let containerHeight = 1019;
        let minHeightAtReads: string[] = [];
        Object.defineProperty(container, "offsetHeight", {
            get: () => {
                minHeightAtReads.push(container.style.minHeight);
                return containerHeight;
            },
            configurable: true,
        });

        class TestRenderer extends DataviewRefreshableRenderer {
            renders = 0;
            async render() {
                this.container.innerHTML = "";
                if (this.renders > 0) containerHeight = 77; // the pre-commit shell, seen by a .then()-time reader
                this.renders++;
                await Promise.resolve();
                this.container.appendChild(document.createElement("div"));
            }
        }

        let renderer = new TestRenderer(container, index, app, settings);
        renderer.onload();

        // Field data (clean run): capture 434, guard holds 1019, the .then() reader saw 77.
        viewContent.scrollTop = 434;
        index.revision = 2;
        workspace.trigger("dataview:refresh-views");

        // The browser clamps the scroll while the content is collapsed.
        viewContent.scrollTop = 0;
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        expect(viewContent.scrollTop).toBe(0);

        // By the frame, the rebuilt content has committed and laid out.
        containerHeight = 1019;
        await nextFrame();
        await nextFrame();

        expect(viewContent.scrollTop).toBe(434); // |1019 - 1019| < 4 -> the pixel write ran
        expect(minHeightAtReads[minHeightAtReads.length - 1]).toBe(""); // the write-time read sees the guard released
    });
});

describe("useIndexBackedState (DQL) height guard", () => {
    afterEach(() => {
        document.body.innerHTML = "";
        jest.restoreAllMocks();
    });

    test("releases the height guard before the write-time height read (DQL path)", async () => {
        let viewContent = document.createElement("div");
        viewContent.className = "view-content";
        document.body.appendChild(viewContent);
        let container = document.createElement("div");
        viewContent.appendChild(container);
        let minHeightAtReads: string[] = [];
        Object.defineProperty(container, "offsetHeight", {
            get: () => {
                minHeightAtReads.push(container.style.minHeight);
                return 240;
            },
            configurable: true,
        });
        let index = { revision: 1 } as FullIndex;
        let vault = new Vault();
        let app = {
            workspace: {
                on: vault.on.bind(vault),
                trigger: vault.trigger.bind(vault),
                offref: () => {},
                getLeavesOfType: () => [],
            },
        } as unknown as App;

        let minHeightDuringCompute: string | null = null;
        let computed = 0;
        function DqlView() {
            let value = useIndexBackedState<string>(container, app, DEFAULT_SETTINGS, index, "", async () => {
                minHeightDuringCompute = container.style.minHeight; // the guard must be active
                await Promise.resolve();
                computed++;
                return "v" + index.revision;
            });
            return h("span", { class: "dql" }, value);
        }

        let renderer = new ReactRenderer({ app, index, settings: DEFAULT_SETTINGS, container }, h(DqlView, {}));
        renderer.onload();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        expect(computed).toBe(1);

        // The user scrolls the leaf view, then the index updates.
        viewContent.scrollTop = 900;
        index.revision = 2;
        app.workspace.trigger("dataview:refresh-views");

        viewContent.scrollTop = 0;
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        expect(computed).toBe(2);
        expect(minHeightDuringCompute).toBe("240px"); // the guard was held during the compute

        await nextFrame();
        await nextFrame();
        expect(viewContent.scrollTop).toBe(900); // same height -> the pixel path ran (T1)
        // The write-time height read (the last read) must see the guard ALREADY released.
        expect(minHeightAtReads[minHeightAtReads.length - 1]).toBe("");

        renderer.onunload();
    });

    test("releases the guard when the DQL compute rejects: min-height back to the previous value, error propagates, no window", async () => {
        let viewContent = document.createElement("div");
        viewContent.className = "view-content";
        document.body.appendChild(viewContent);
        let container = document.createElement("div");
        viewContent.appendChild(container);
        Object.defineProperty(container, "offsetHeight", { value: 240, configurable: true });
        // A pre-existing min-height: the release must restore THIS value, not clear the style.
        container.style.minHeight = "120px";
        let index = { revision: 1 } as FullIndex;
        let listeners: Record<string, Array<(e?: unknown) => unknown>> = {};
        let lastRefresh: unknown = null;
        let app = {
            workspace: {
                on: (name: string, callback: (e?: unknown) => unknown) => {
                    (listeners[name] ??= []).push(callback);
                    return {};
                },
                // Captures the refresh operation's promise, so the test can observe the
                // rejection (a swallowed error would leave no rejected promise behind).
                trigger: (name: string) => {
                    for (const callback of listeners[name] ?? []) lastRefresh = callback();
                    return true;
                },
                offref: () => {},
                getLeavesOfType: () => [],
            },
        } as unknown as App;

        // The scroll listeners a settle window would attach to the scroll owner.
        let scrollHandlers: EventListener[] = [];
        let origAdd = viewContent.addEventListener;
        viewContent.addEventListener = (
            type: string,
            listener: EventListenerOrEventListenerObject | null,
            options?: boolean | AddEventListenerOptions
        ): void => {
            if (type === "scroll" && typeof listener === "function") scrollHandlers.push(listener);
            origAdd.call(viewContent, type, listener, options);
        };

        let minHeightDuringCompute: string | null = null;
        function DqlView() {
            let value = useIndexBackedState<string>(container, app, DEFAULT_SETTINGS, index, "", async () => {
                if (index.revision > 1) {
                    minHeightDuringCompute = container.style.minHeight; // the guard must be active
                    throw new Error("boom");
                }
                await Promise.resolve();
                return "v" + index.revision;
            });
            return h("span", { class: "dql" }, value);
        }

        let renderer = new ReactRenderer({ app, index, settings: DEFAULT_SETTINGS, container }, h(DqlView, {}));
        renderer.onload();
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        expect(container.querySelector(".dql")?.textContent).toBe("v1");

        // The user scrolls the leaf view, then the index updates: this refresh's compute rejects.
        viewContent.scrollTop = 900;
        index.revision = 2;
        app.workspace.trigger("dataview:refresh-views");

        // Attach the rejection handler SYNCHRONOUSLY: the chain must reject with the original
        // error, and handling it here keeps the rejection from going unhandled.
        let seenError: unknown = null;
        let resolvedUnexpectedly = false;
        (lastRefresh as Promise<unknown>).then(
            () => {
                resolvedUnexpectedly = true;
            },
            (e: unknown) => {
                seenError = e;
            }
        );

        await new Promise<void>(resolve => setTimeout(resolve, 0));
        expect(resolvedUnexpectedly).toBe(false); // the error was not swallowed
        expect(seenError).toBeInstanceOf(Error);
        expect((seenError as Error).message).toBe("boom"); // the ORIGINAL error propagated
        expect(minHeightDuringCompute).toBe("240px"); // the guard was held during the compute
        expect(container.style.minHeight).toBe("120px"); // released: back to the PREVIOUS value
        expect(container.querySelector(".dql")?.textContent).toBe("v1"); // the state was not updated

        await nextFrame();
        await nextFrame();
        expect(scrollHandlers.length).toBe(0); // no re-assert window was opened

        renderer.onunload();
    });
});
