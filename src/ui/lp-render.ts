/*
 * inspired and adapted from https://github.com/artisticat1/obsidian-latex-suite/blob/main/src/conceal.ts
 *
 * The original work is MIT-licensed.
 *
 * MIT License
 *
 * Copyright (c) 2022 artisticat1
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * */

import { Decoration, DecorationSet, EditorView, ViewPlugin, ViewUpdate, WidgetType } from "@codemirror/view";
import { EditorSelection, Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import { DataviewSettings } from "../settings";
import { FullIndex } from "../data-index";
import { Component, editorEditorField, editorLivePreviewField, editorViewField } from "obsidian";
import { DataviewApi } from "../api/plugin-api";
import { tryOrPropogate } from "../util/normalize";
import { parseField } from "../expression/parse";
import { executeInline } from "../query/engine";
import { Literal } from "../data-model/value";
import { DataviewInlineApi } from "../api/inline-api";
import { renderValue } from "./render";

function selectionAndRangeOverlap(selection: EditorSelection, rangeFrom: number, rangeTo: number) {
    for (const range of selection.ranges) {
        if (range.from <= rangeTo && range.to >= rangeFrom) {
            return true;
        }
    }

    return false;
}

class InlineWidget extends WidgetType {
    constructor(
        readonly cssClasses: string[],
        readonly rawQuery: string,
        private el: HTMLElement,
        private view: EditorView
    ) {
        super();
    }

    // Widgets only get updated when the raw query changes/the element gets focus and loses it
    // to prevent redraws when the editor updates.
    eq(other: InlineWidget): boolean {
        if (other.rawQuery === this.rawQuery) {
            // change CSS classes without redrawing the element
            for (let value of other.cssClasses) {
                if (!this.cssClasses.includes(value)) {
                    this.el.removeClass(value);
                } else {
                    this.el.addClass(value);
                }
            }
            return true;
        }
        return false;
    }

    // Add CSS classes and return HTML element.
    // In "complex" cases it will get filled with the correct text/child elements later.
    toDOM(view: EditorView): HTMLElement {
        this.el.addClasses(this.cssClasses);
        return this.el;
    }

    /* Make queries only editable when shift is pressed (or navigated inside with the keyboard
     * or the mouse is placed at the end, but that is always possible regardless of this method).
     * Mostly useful for links, and makes results selectable.
     * If the widgets should always be expandable, make this always return false.
     */
    ignoreEvent(event: MouseEvent | Event): boolean {
        // instanceof check does not work in pop-out windows, so check it like this
        if (event.type === 'mousedown') {
            const currentPos = this.view.posAtCoords({ x: (event as MouseEvent).x, y: (event as MouseEvent).y });
            if ((event as MouseEvent).shiftKey) {
                // Set the cursor after the element so that it doesn't select starting from the last cursor position.
                if (currentPos) {
                    //@ts-ignore
                    const { editor } = this.view.state.field(editorEditorField).state.field(editorViewField);
                    editor.setCursor(editor.offsetToPos(currentPos));
                }
                return false;
            }
        }
        return true;
    }
}

function getCssClasses(nodeName: string): string[] {
    const classes: string[] = [];
    if (nodeName.includes("strong")) {
        classes.push("cm-strong");
    }
    if (nodeName.includes("em")) {
        classes.push("cm-em");
    }
    if (nodeName.includes("highlight")) {
        classes.push("cm-highlight");
    }
    if (nodeName.includes("strikethrough")) {
        classes.push("cm-strikethrough");
    }
    if (nodeName.includes("comment")) {
        classes.push("cm-comment");
    }
    return classes;
}

function inlineRender(view: EditorView, index: FullIndex, dvSettings: DataviewSettings, api: DataviewApi) {
    // still doesn't work as expected for tables and callouts
    if (!index.initialized) return;
    const currentFile = app.workspace.getActiveFile();
    if (!currentFile) return;

    const widgets: Range<Decoration>[] = [];
    const selection = view.state.selection;
    /* before:
     *     em for italics
     *     highlight for highlight
     * after:
     *     strong for bold
     *     strikethrough for strikethrough
     */
    const regex = new RegExp(".*?_?inline-code_?.*");
    const PREAMBLE: string = "const dataview=this;const dv=this;";

    for (const { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
            from,
            to,
            enter: ({ node }) => {
                const type = node.type;
                // markdown formatting symbols
                if (type.name.includes("formatting")) return;
                // current node is not inline code
                if (!regex.test(type.name)) return;

                // contains the position of inline code
                const start = node.from;
                const end = node.to;
                // don't continue if current cursor position and inline code node (including formatting
                // symbols) overlap
                if (selectionAndRangeOverlap(selection, start - 1, end + 1)) return;

                const text = view.state.doc.sliceString(start, end);
                let code: string = "";
                let result: Literal = "";
                const el = createSpan({
                    cls: ["dataview", "dataview-inline"],
                });
                /* If the query result is predefined text (e.g. in the case of errors), set innerText to it.
                 * Otherwise, pass on an empty element and fill it in later.
                 * This is necessary because {@link InlineWidget.toDOM} is synchronous but some rendering
                 * asynchronous.
                 */
                if (dvSettings.inlineQueryPrefix.length > 0 && text.startsWith(dvSettings.inlineQueryPrefix)) {
                    code = text.substring(dvSettings.inlineQueryPrefix.length).trim();
                    const field = tryOrPropogate(() => parseField(code));
                    if (!field.successful) {
                        result = `Dataview (inline field '${code}'): ${field.error}`;
                        el.innerText = result;
                    } else {
                        const fieldValue = field.value;
                        const intermediateResult = tryOrPropogate(() =>
                            executeInline(fieldValue, currentFile.path, index, dvSettings)
                        );
                        if (!intermediateResult.successful) {
                            result = `Dataview (for inline query '${fieldValue}'): ${intermediateResult.error}`;
                            el.innerText = result;
                        } else {
                            const { value } = intermediateResult;
                            result = value;
                            renderValue(result, el, currentFile.path, null as unknown as Component, dvSettings);
                        }
                    }
                } else if (
                    dvSettings.inlineJsQueryPrefix.length > 0 &&
                    text.startsWith(dvSettings.inlineJsQueryPrefix)
                ) {
                    if (dvSettings.enableInlineDataviewJs) {
                        code = text.substring(dvSettings.inlineJsQueryPrefix.length).trim();
                        try {
                            // for setting the correct context for dv/dataview
                            const myEl = createDiv();
                            const dvInlineApi = new DataviewInlineApi(
                                api,
                                null as unknown as Component,
                                myEl,
                                currentFile.path
                            );
                            if (code.includes("await")) {
                                (evalInContext("(async () => { " + PREAMBLE + code + " })()") as Promise<any>).then(
                                    (result: any) => {
                                        renderValue(
                                            result,
                                            el,
                                            currentFile.path,
                                            null as unknown as Component,
                                            dvSettings
                                        );
                                    }
                                );
                            } else {
                                result = evalInContext(PREAMBLE + code);
                                renderValue(result, el, currentFile.path, null as unknown as Component, dvSettings);
                            }

                            function evalInContext(script: string): any {
                                return function () {
                                    return eval(script);
                                }.call(dvInlineApi);
                            }
                        } catch (e) {
                            result = `Dataview (for inline JS query '${code}'): ${e}`;
                            el.innerText = result;
                        }
                    } else {
                        result = "(disabled; enable in settings)";
                        el.innerText = result;
                    }
                } else {
                    return;
                }

                const classes = getCssClasses(type.name);

                widgets.push(
                    Decoration.replace({
                        widget: new InlineWidget(classes, code, el, view),
                        inclusive: false,
                        block: false,
                    }).range(start - 1, end + 1)
                );
            },
        });
    }

    return Decoration.set(widgets, true);
}

export function inlinePlugin(index: FullIndex, settings: DataviewSettings, api: DataviewApi) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;

            constructor(view: EditorView) {
                this.decorations = inlineRender(view, index, settings, api) ?? Decoration.none;
            }

            update(update: ViewUpdate) {
                // only activate in LP and not source mode
                //@ts-ignore
                if (!update.state.field(editorLivePreviewField)) {
                    this.decorations = Decoration.none;
                    return;
                }
                if (update.docChanged || update.viewportChanged || update.selectionSet) {
                    this.decorations = inlineRender(update.view, index, settings, api) ?? Decoration.none;
                }
            }
        },
        { decorations: v => v.decorations }
    );
}
