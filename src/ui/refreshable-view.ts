import { FullIndex } from "data-index";
import { App, MarkdownRenderChild } from "obsidian";
import { DataviewSettings } from "settings";
import { beginHeightPreserve, captureViewScroll, scheduleSettledRestore } from "util/scroll";

/** Generic code for embedded Dataviews. */
export abstract class DataviewRefreshableRenderer extends MarkdownRenderChild {
    private lastReload: number;

    public constructor(
        public container: HTMLElement,
        public index: FullIndex,
        public app: App,
        public settings: DataviewSettings
    ) {
        super(container);
        this.lastReload = 0;
    }

    abstract render(): Promise<void>;

    onload() {
        this.render();
        this.lastReload = this.index.revision;
        // Refresh after index changes stop.
        this.registerEvent(this.app.workspace.on("dataview:refresh-views", this.maybeRefresh));
        // ...or when the DOM is shown (sidebar expands, tab selected, nodes scrolled into view).
        this.register(this.container.onNodeInserted(this.maybeRefresh));
    }

    maybeRefresh = () => {
        // If the index revision has changed recently, then queue a reload.
        // But only if we're mounted in the DOM and auto-refreshing is active.
        if (this.lastReload != this.index.revision && this.container.isShown() && this.settings.refreshEnabled) {
            this.lastReload = this.index.revision;
            // Preserve the user's scroll position across the async re-render (obsidian-dataview#2208).
            // Capture the scroll owner's position, then hold the container's height BEFORE
            // render() clears it, so the browser cannot clamp the view's scroll while the
            // content is collapsed. scheduleSettledRestore receives this refresh's guard
            // explicitly and releases it at T1 (double rAF after the commit), before the
            // write-time height check and the pixel write. .finally() runs on reject too: a
            // failed render still gets the guard released (via the window's T1 cancel) and,
            // when something was captured, the pixel restored.
            let captured = captureViewScroll(this.containerEl);
            let guard = beginHeightPreserve(this.containerEl);
            this.render().finally(() => scheduleSettledRestore(captured, this.containerEl, guard));
        }
    };
}
