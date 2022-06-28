import { extractInlineFields, parseInlineValue } from "data-import/inline-field";
import { Literal } from "data-model/value";
import { MarkdownPostProcessorContext, MarkdownRenderChild } from "obsidian";
import { h, render } from "preact";
import { DataviewContext, DataviewInit, Lit } from "ui/markdown";
import { canonicalizeVarName } from "util/normalize";

/** Replaces raw textual inline fields in text containers with pretty HTML equivalents. */
export async function replaceInlineFields(ctx: MarkdownPostProcessorContext, init: DataviewInit): Promise<void> {
    let inlineFields = extractInlineFields(init.container.innerHTML);
    if (inlineFields.length == 0) return;

    let component = new MarkdownRenderChild(init.container);
    ctx.addChild(component);

    // Iterate through the raw HTML and replace inline field matches with corresponding rendered values.
    const values: Literal[] = [];
    let result = init.container.innerHTML;
    for (let x = inlineFields.length - 1; x >= 0; x--) {
        let field = inlineFields[x];
        let renderContainer = document.createElement("span");
        renderContainer.addClasses(["dataview", "inline-field"]);

        // Block inline fields render the key, parenthesis ones do not.
        if (field.wrapping == "[") {
            const key = renderContainer.createSpan({
                cls: ["dataview", "inline-field-key"],
                attr: {
                    "data-dv-key": field.key,
                    "data-dv-norm-key": canonicalizeVarName(field.key),
                },
            });

            // Explicitly set the inner HTML to respect any key formatting that we should carry over.
            key.innerHTML = field.key;

            renderContainer.createSpan({
                cls: ["dataview", "inline-field-value"],
                attr: { id: "dataview-inline-field-" + x },
            });
        } else {
            renderContainer.createSpan({
                cls: ["dataview", "inline-field-standalone-value"],
                attr: { id: "dataview-inline-field-" + x },
            });
        }

        values.push(parseInlineValue(field.value));
        result = result.slice(0, field.start) + renderContainer.outerHTML + result.slice(field.end);
    }

    // Use a <template> block to render this HTML properly to nodes.
    const template = document.createElement("template");
    template.innerHTML = result;

    // Replace the container children with the new rendered children.
    // TODO: Replace this with a dom-to-dom diff to reduce the actual amount of updates.
    init.container.replaceChildren(...template.content.childNodes);

    for (let index = 0; index < values.length; index++) {
        const box = init.container.querySelector("#dataview-inline-field-" + index);
        if (!box) continue;

        const context = Object.assign({}, init, { container: box, component: component });
        render(
            <DataviewContext.Provider value={context}>
                <Lit value={values[index]} inline={true} sourcePath={ctx.sourcePath} />
            </DataviewContext.Provider>,
            box
        );
    }
}
