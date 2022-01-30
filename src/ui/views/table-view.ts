import { FullIndex } from "data-index";
import { Literal } from "data-model/value";
import { App } from "obsidian";
import { executeTable } from "query/engine";
import { Query, TableQuery } from "query/query";
import { DataviewSettings } from "settings";
import { renderErrorPre, renderTable } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { asyncTryOrPropogate } from "util/normalize";

export class DataviewTableRenderer extends DataviewRefreshableRenderer {
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
            executeTable(this.query, this.index, this.origin, this.settings)
        );
        if (!maybeResult.successful) {
            renderErrorPre(this.container, "Dataview: " + maybeResult.error);
            return;
        }

        let result = maybeResult.value;

        if ((this.query.header as TableQuery).showId) {
            let dataWithNames: Literal[][] = [];
            for (let entry of result.data) {
                dataWithNames.push([entry.id].concat(entry.values));
            }
            let name =
                result.idMeaning.type === "group"
                    ? this.settings.tableGroupColumnName
                    : this.settings.tableIdColumnName;

            await renderTable(
                this.container,
                [name].concat(result.names),
                dataWithNames,
                this,
                this.origin,
                this.settings
            );
        } else {
            await renderTable(
                this.container,
                result.names,
                result.data.map(v => v.values),
                this,
                this.origin,
                this.settings
            );
        }

        // Render after the empty table, so the table header still renders.
        if (result.data.length == 0 && this.settings.warnOnEmptyResult) {
            renderErrorPre(this.container, "Dataview: Query returned 0 results.");
        }
    }
}
