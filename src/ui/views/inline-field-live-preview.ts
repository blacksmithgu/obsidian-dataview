import { App, Component, TFile, editorInfoField, editorLivePreviewField } from "obsidian";
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
import { renderCompactMarkdown, renderValue } from "ui/render";
import { DataviewSettings } from "settings";
import { selectionAndRangeOverlap } from "ui/lp-render";

class InlineFieldValue extends RangeValue {
    constructor(public field: InlineField) {
        super();
    }

    eq(other: InlineFieldValue): boolean {
        return this.field.key == other.field.key && this.field.value == other.field.value;
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
            component: Component;

            constructor(view: EditorView) {
                this.component = new Component();
                this.component.load();
                this.decorations = this.buildDecorations(view);
            }

            destroy() {
                this.component.unload();
            }

            buildDecorations(view: EditorView): DecorationSet {
                // Disable in the source mode
                if (!view.state.field(editorLivePreviewField)) return Decoration.none;

                const file = view.state.field(editorInfoField).file;
                if (!file) return Decoration.none;

                const info = view.state.field(inlineFieldsField);
                const builder = new RangeSetBuilder<Decoration>();
                const selection = view.state.selection;

                for (const { from, to } of view.visibleRanges) {
                    info.between(from, to, (start, end, { field }) => {
                        // If the inline field is not overlapping with the cursor, we replace it with a widget.
                        if (selectionAndRangeOverlap(selection, start, end)) {
                            builder.add(
                                start,
                                end,
                                Decoration.replace({
                                    widget: new InlineFieldWidget(app, field, file.path, this.component, settings),
                                })
                            );
                        }
                    });
                }
                return builder.finish();
            }

            update(update: ViewUpdate) {
                // only activate in LP and not source mode
                if (!update.state.field(editorLivePreviewField)) {
                    this.decorations = Decoration.none;
                    return;
                }

                const layoutChanged = update.transactions.some(transaction =>
                    transaction.effects.some(effect => effect.is(workspaceLayoutChangeEffect))
                );

                if (update.docChanged) {
                    this.decorations = this.decorations.map(update.changes);
                    this.updateDecorations(update.view);
                } else if (update.selectionSet) {
                    this.updateDecorations(update.view);
                } else if (update.viewportChanged || layoutChanged) {
                    this.decorations = this.buildDecorations(update.view);
                }
            }

            updateDecorations(view: EditorView) {
                const file = view.state.field(editorInfoField).file;
                if (!file) {
                    this.decorations = Decoration.none;
                    return;
                }

                const inlineFields = view.state.field(inlineFieldsField);
                const selection = view.state.selection;

                for (const { from, to } of view.visibleRanges) {
                    inlineFields.between(from, to, (start, end, { field }) => {
                        const overlap = selectionAndRangeOverlap(selection, start, end);
                        if (overlap) {
                            this.removeDeco(start, end);
                            return;
                        } else {
                            this.addDeco(start, end, field, file);
                        }
                    });
                }
            }

            removeDeco(start: number, end: number) {
                this.decorations.between(start, end, (from, to) => {
                    this.decorations = this.decorations.update({
                        filterFrom: from,
                        filterTo: to,
                        filter: () => false,
                    });
                });
            }

            addDeco(start: number, end: number, field: InlineField, file: TFile) {
                let exists = false;
                this.decorations.between(start, end, () => {
                    exists = true;
                });
                if (!exists) {
                    this.decorations = this.decorations.update({
                        add: [
                            {
                                from: start,
                                to: end,
                                value: Decoration.replace({
                                    widget: new InlineFieldWidget(app, field, file.path, this.component, settings),
                                }),
                            },
                        ],
                    });
                }
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
        public sourcePath: string,
        public parentComponent: Component,
        public settings: DataviewSettings
    ) {
        super();
    }

    eq(other: InlineFieldWidget): boolean {
        return this.field.key == other.field.key && this.field.value == other.field.value;
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

            renderCompactMarkdown(this.field.key, key, this.sourcePath, this.parentComponent);

            const value = renderContainer.createSpan({
                cls: ["dataview", "inline-field-value"],
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
}

/**
 * A state effect that represents the workspace's layout change.
 * Mainly intended to detect when the user switches between live preview and source mode.
 */
export const workspaceLayoutChangeEffect = StateEffect.define<null>();
