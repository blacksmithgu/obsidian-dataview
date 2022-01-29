import { FullIndex } from "data-index";
import { LiteralValue } from "index";
import { App } from "obsidian";
import { executeList } from "query/engine";
import { ListQuery, Query } from "query/query";
import { DataviewSettings } from "settings";
import { renderErrorPre, renderList, renderValue } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { asyncTryOrPropogate } from "util/normalize";

/** Renders a list dataview for the given query. */
export class DataviewListRenderer extends DataviewRefreshableRenderer {
    constructor(
        public query: Query,
        public container: HTMLElement,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings,
        public app: App
    ) {
        super(container);
    }

    async render() {
        this.container.innerHTML = "";
        let maybeResult = await asyncTryOrPropogate(() =>
            executeList(this.query, this.index, this.origin, this.settings)
        );
        if (!maybeResult.successful) {
            renderErrorPre(this.container, "Dataview: " + maybeResult.error);
            return;
        } else if (maybeResult.value.data.length == 0 && this.settings.warnOnEmptyResult) {
            renderErrorPre(this.container, "Dataview: Query returned 0 results.");
            return;
        }

        let showId = (this.query.header as ListQuery).showId;
        let showValue = !!(this.query.header as ListQuery).format;

        let result = maybeResult.value;
        let rendered: LiteralValue[] = [];
        for (let row of result.data) {
            if (showValue && showId) {
                let span = document.createElement("span");
                await renderValue(row.primary, span, this.origin, this, this.settings, false, "list");
                span.appendText(": ");
                await renderValue(row.value || null, span, this.origin, this, this.settings, true, "list");

                rendered.push(span);
            } else if (showId) {
                rendered.push(row.primary);
            } else if (showValue) {
                rendered.push(row.value || null);
            }
        }

        await renderList(this.container, rendered, this, this.origin, this.settings);
    }
}
