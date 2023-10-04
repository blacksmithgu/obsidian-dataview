import { EditorState, RangeSet, RangeSetBuilder, RangeValue, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { InlineField, extractInlineFields } from "data-import/inline-field";
import { App, Component, MarkdownRenderer, editorInfoField } from "obsidian";
import { canonicalizeVarName } from "util/normalize";


class InlineFieldValue extends RangeValue {

    constructor(public field: InlineField) {
        super();
    }

    eq(other: InlineFieldValue): boolean {
        return JSON.stringify(this.field) == JSON.stringify(other.field);
    }
}

function buildInlineFields(state: EditorState): RangeSet<InlineFieldValue> {
    const builder = new RangeSetBuilder<InlineFieldValue>();

    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
        const line = state.doc.line(lineNumber);
        const inlineFields = extractInlineFields(line.text);
        for (const field of inlineFields) {
            builder.add(line.from + field.start, line.from + field.end, new InlineFieldValue(field))
        }
    }
    return builder.finish();
}


export const inlineFieldsField = StateField.define<RangeSet<InlineFieldValue>>({
    create: buildInlineFields,
    update(oldFields, tr) {
        return tr.docChanged ? buildInlineFields(tr.state) : oldFields;
    }
});

export const replaceInlineFieldsInLivePreview = (app: App) => ViewPlugin.fromClass(
    class implements PluginValue {
        decorations: DecorationSet;
        overlappingIndices: number[];

        constructor(view: EditorView) {
            this.decorations = this.buildDecoration(view);
            this.overlappingIndices = this.getOverlappingIndices(view.state);
        }

        update(update: ViewUpdate): void {
            const oldIndices = this.overlappingIndices;
            const newIndices = this.getOverlappingIndices(update.state);

            let overlapChanged = 
                update.startState.field(inlineFieldsField).size != update.state.field(inlineFieldsField).size
                || JSON.stringify(oldIndices) != JSON.stringify(newIndices)
            
            this.overlappingIndices = newIndices;

            if (update.docChanged || update.viewportChanged || overlapChanged) {
                this.decorations = this.buildDecoration(update.view);
            }
        }

        buildDecoration(view: EditorView): DecorationSet {
            const markdownView = view.state.field(editorInfoField);
            if (!(markdownView instanceof Component)) {
                // For a canvas, editorInfoField is not MarkdownView, which inherits from the Component class
                return Decoration.none;
            }

            const file = markdownView.file;
            if (!file) return Decoration.none;

            const info = view.state.field(inlineFieldsField);

            const builder = new RangeSetBuilder<Decoration>();
            const selection = view.state.selection.main;

            let x = 0;
            for (const { from, to } of view.visibleRanges) {
                info.between(from, to, (start, end, { field }) => {
                    if (start > selection.to || end < selection.from) {
                        builder.add(
                            start,
                            end,
                            Decoration.replace({
                                widget: new InlineFieldWidget(app, field, x++, file.path, markdownView),
                            })
                        );
                    }
                });
            }
            return builder.finish();
        }

        getOverlappingIndices(state: EditorState): number[] {
            const selection = state.selection.main;
            const cursor = state.field(inlineFieldsField).iter();
            const indices: number[] = [];
            let i = 0;
            while (cursor.value) {
                if (cursor.from <= selection.to && cursor.to >= selection.from) {
                    indices.push(i);
                }
                cursor.next();
                i++;
            }
            return indices;
        }
    }, {
    decorations: instance => instance.decorations,
});


class InlineFieldWidget extends WidgetType {
    constructor(public app: App, public field: InlineField, public id: number, public sourcePath: string, public parentComponent: Component) {
        super();
    }

    toDOM() {
        const renderContainer = createSpan({
            cls: ["dataview", "inline-field"],
        });

        // Block inline fields render the key, parenthesis ones do not.
        if (this.field.wrapping == "[") {
            const key = renderContainer.createSpan({
                cls: ["dataview", "inline-field-key"],
                attr: {
                    "data-dv-key": this.field.key,
                    "data-dv-norm-key": canonicalizeVarName(this.field.key),
                },
            });

            // Explicitly set the inner HTML to respect any key formatting that we should carry over.
            this.renderMarkdown(key, this.field.key);

            const value = renderContainer.createSpan({
                cls: ["dataview", "inline-field-value"],
                attr: { id: "dataview-inline-field-" + this.id },
            });
            this.renderMarkdown(value, this.field.value);
        } else {
            const value = renderContainer.createSpan({
                cls: ["dataview", "inline-field-standalone-value"],
                attr: { id: "dataview-inline-field-" + this.id },
            });
            this.renderMarkdown(value, this.field.value);
        }

        return renderContainer;
    }

    async renderMarkdown(el: HTMLElement, source: string) {
        const children = await renderMarkdown(this.app, source, this.sourcePath, this.parentComponent);
        if (children)
            el.replaceChildren(...children);
    }
}

/**
 * Easy-to-use version of MarkdownRenderer.render.
 */
export async function renderMarkdown(app: App, markdown: string, sourcePath: string, component: Component): Promise<NodeList | null> {
    const el = createSpan();
    await MarkdownRenderer.render(app, markdown, el, sourcePath, component);
    for (const child of el.children) {
        if (child.tagName == "P") {
            return child.childNodes;
        }
    }
    return null
}
