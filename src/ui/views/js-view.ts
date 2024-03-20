import { asyncEvalInContext, DataviewInlineApi } from "api/inline-api";
import { renderErrorPre, renderValue } from "ui/render";
import { DataviewRefreshableRenderer } from "ui/refreshable-view";
import { DataviewApi } from "api/plugin-api";

export class DataviewJSRenderer extends DataviewRefreshableRenderer {
    static PREAMBLE: string = "const dataview = this;const dv = this;";

    constructor(public api: DataviewApi, public script: string, public container: HTMLElement, public origin: string) {
        super(container, api.index, api.app, api.settings);
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
                new DataviewInlineApi(this.api, this, this.container, this.origin)
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
        public api: DataviewApi,
        public script: string,
        public container: HTMLElement,
        public target: HTMLElement,
        public origin: string
    ) {
        super(container, api.index, api.app, api.settings);
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
                new DataviewInlineApi(this.api, this, temp, this.origin)
            );
            this.target.replaceWith(temp);
            this.target = temp;
            if (result === undefined) return;

            renderValue(this.api.app, result, temp, this.origin, this, this.settings, false);
        } catch (e) {
            this.errorbox = this.container.createEl("div");
            renderErrorPre(this.errorbox, "Dataview (for inline JS query '" + this.script + "'): " + e);
        }
    }
}
