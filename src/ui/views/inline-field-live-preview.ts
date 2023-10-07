import { App, Component, MarkdownRenderer, editorInfoField, editorLivePreviewField } from "obsidian";
import { EditorState, RangeSet, RangeSetBuilder, RangeValue, StateEffect, StateField } from "@codemirror/state";
import {
    Decoration,
    DecorationSet,
    EditorView,
    PluginValue,
    ViewPlugin,
    ViewUpdate,
    WidgetType,
} from "@codemirror/view";
import { InlineField, extractInlineFields, parseInlineValue } from "data-import/inline-field";
import { canonicalizeVarName } from "util/normalize";
import { renderValue } from "ui/render";
import { DataviewSettings } from "settings";

class InlineFieldValue extends RangeValue {
    constructor(public field: InlineField) {
        super();
    }
}

function buildInlineFields(state: EditorState): RangeSet<InlineFieldValue> {
    const builder = new RangeSetBuilder<InlineFieldValue>();

    for (let lineNumber = 1; lineNumber <= state.doc.lines; lineNumber++) {
        const line = state.doc.line(lineNumber);
        const inlineFields = extractInlineFields(line.text);
        for (const field of inlineFields) {
            builder.add(line.from + field.start, line.from + field.end, new InlineFieldValue(field));
        }
    }
    return builder.finish();
}

/** A state field that stores the inline fields and their positions as a range set. */
export const inlineFieldsField = StateField.define<RangeSet<InlineFieldValue>>({
    create: buildInlineFields,
    update(oldFields, tr) {
        return tr.docChanged ? buildInlineFields(tr.state) : oldFields;
    },
});

/** Create a view plugin that renders inline fields in live preview just as in the reading view. */
export const replaceInlineFieldsInLivePreview = (app: App, settings: DataviewSettings) =>
    ViewPlugin.fromClass(
        class implements PluginValue {
            decorations: DecorationSet;
            overlappingIndices: number[];

            constructor(view: EditorView) {
                this.decorations = this.buildDecoration(view);
                this.overlappingIndices = this.getOverlappingIndices(view.state);
            }

            update(update: ViewUpdate): void {
                // To reduce the total number of updating the decorations, we only update if
                // the state of overlapping (i.e. which inline field is overlapping with the cursor) has changed
                // except when the document has changed or the viewport has changed.

                const oldIndices = this.overlappingIndices;
                const newIndices = this.getOverlappingIndices(update.state);

                const overlapChanged =
                    update.startState.field(inlineFieldsField).size != update.state.field(inlineFieldsField).size ||
                    JSON.stringify(oldIndices) != JSON.stringify(newIndices);

                this.overlappingIndices = newIndices;

                const layoutChanged = update.transactions.some(transaction =>
                    transaction.effects.some(effect => effect.is(workspaceLayoutChangeEffect))
                );

                if (update.state.field(editorLivePreviewField)) {
                    if (update.docChanged || update.viewportChanged || layoutChanged || overlapChanged) {
                        this.decorations = this.buildDecoration(update.view);
                    }
                } else {
                    this.decorations = Decoration.none;
                }
            }

            buildDecoration(view: EditorView): DecorationSet {
                // Disable in the source mode
                if (!view.state.field(editorLivePreviewField)) return Decoration.none;

                const markdownView = view.state.field(editorInfoField);
                if (!(markdownView instanceof Component)) {
                    // For a canvas card not assosiated with a note in the vault,
                    // editorInfoField is not MarkdownView, which inherits from the Component class.
                    // A component object is required to pass to MarkdownRenderer.render.
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
                        // If the inline field is not overlapping with the cursor, we replace it with a widget.
                        if (start > selection.to || end < selection.from) {
                            builder.add(
                                start,
                                end,
                                Decoration.replace({
                                    widget: new InlineFieldWidget(app, field, x++, file.path, markdownView, settings),
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
        },
        {
            decorations: instance => instance.decorations,
        }
    );

/** A widget which inline fields are replaced with. */
class InlineFieldWidget extends WidgetType {
    constructor(
        public app: App,
        public field: InlineField,
        public id: number,
        public sourcePath: string,
        public parentComponent: Component,
        public settings: DataviewSettings
    ) {
        super();
    }

    toDOM() {
        // A large part of this method was taken from replaceInlineFields() in src/ui/views/inline-field.tsx.
        // It will be better to extract the common part as a function...

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
            renderValue(
                parseInlineValue(this.field.value),
                value,
                this.sourcePath,
                this.parentComponent,
                this.settings,
                false
            );
        } else {
            const value = renderContainer.createSpan({
                cls: ["dataview", "inline-field-standalone-value"],
                attr: { id: "dataview-inline-field-" + this.id },
            });
            renderValue(
                parseInlineValue(this.field.value),
                value,
                this.sourcePath,
                this.parentComponent,
                this.settings,
                false
            );
        }

        return renderContainer;
    }

    async renderMarkdown(el: HTMLElement, source: string) {
        const children = await renderMarkdown(this.app, source, this.sourcePath, this.parentComponent);
        if (children) el.replaceChildren(...children);
    }
}

/** Easy-to-use version of MarkdownRenderer.render. Returns only the child nodes intead of a container block. */
export async function renderMarkdown(
    app: App,
    markdown: string,
    sourcePath: string,
    component: Component
): Promise<NodeList | null> {
    const el = createSpan();
    await MarkdownRenderer.render(app, markdown, el, sourcePath, component);
    for (const child of el.children) {
        if (child.tagName == "P") {
            return child.childNodes;
        }
    }
    return null;
}

/**
 * A state effect that represents the workspace's layout change.
 * Mainly intended to detect when the user switches between live preview and source mode.
 */
export const workspaceLayoutChangeEffect = StateEffect.define<null>();
