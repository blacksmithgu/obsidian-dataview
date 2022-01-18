import { asyncEvalInContext, makeApiContext } from "api/inline-api";
import { FullIndex } from "data";
import { App } from "obsidian";
import { DataviewSettings } from "settings";
import { renderErrorPre, renderValue } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";

export class DataviewJSRenderer extends DataviewRefreshableRenderer {
    static PREAMBLE: string = "const dataview = this;const dv = this;";

    constructor(
        public script: string,
        public container: HTMLElement,
        public app: App,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings,
        public verNum: string
    ) {
        super(container);
    }

    async render() {
        this.container.innerHTML = "";
        if (!this.settings.enableDataviewJs) {
            this.containerEl.innerHTML = "";
            renderErrorPre(
                this.container,
                "Dataview JS queries are disabled. You can enable them in the Dataview settings."
            );
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            await asyncEvalInContext(
                DataviewJSRenderer.PREAMBLE + this.script,
                makeApiContext(this.index, this, this.app, this.settings, this.verNum, this.container, this.origin)
            );
        } catch (e) {
            this.containerEl.innerHTML = "";
            renderErrorPre(this.container, "Evaluation Error: " + e.stack);
        }
    }
}

/** Inline JS renderer accessible using '=$' by default. */
export class DataviewInlineJSRenderer extends DataviewRefreshableRenderer {
    static PREAMBLE: string = "const dataview = this;const dv=this;";

    // The box that the error is rendered in, if relevant.
    errorbox?: HTMLElement;

    constructor(
        public script: string,
        public container: HTMLElement,
        public target: HTMLElement,
        public app: App,
        public index: FullIndex,
        public origin: string,
        public settings: DataviewSettings,
        public verNum: string
    ) {
        super(container);
    }

    async render() {
        this.errorbox?.remove();
        if (!this.settings.enableDataviewJs || !this.settings.enableInlineDataviewJs) {
            let temp = document.createElement("span");
            temp.innerText = "(disabled; enable in settings)";
            this.target.replaceWith(temp);
            this.target = temp;
            return;
        }

        // Assume that the code is javascript, and try to eval it.
        try {
            let temp = document.createElement("span");
            let result = await asyncEvalInContext(
                DataviewInlineJSRenderer.PREAMBLE + this.script,
                makeApiContext(this.index, this, this.app, this.settings, this.verNum, temp, this.origin)
            );
            this.target.replaceWith(temp);
            this.target = temp;
            if (result === undefined) return;

            renderValue(result, temp, this.origin, this, this.settings, false);
        } catch (e) {
            this.errorbox = this.container.createEl("div");
            renderErrorPre(this.errorbox, "Dataview (for inline JS query '" + this.script + "'): " + e);
        }
    }
}
