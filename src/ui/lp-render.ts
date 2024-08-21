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
import { syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import { DataviewSettings } from "../settings";
import { FullIndex } from "../data-index";
import { App, Component, editorInfoField, editorLivePreviewField, TFile } from "obsidian";
import { DataviewApi } from "../api/plugin-api";
import { tryOrPropagate } from "../util/normalize";
import { parseField } from "../expression/parse";
import { executeInline } from "../query/engine";
import { Literal } from "../data-model/value";
import { DataviewInlineApi } from "../api/inline-api";
import { renderValue } from "./render";
import { SyntaxNode } from "@lezer/common";

export function selectionAndRangeOverlap(selection: EditorSelection, rangeFrom: number, rangeTo: number) {
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
        if (event.type === "mousedown") {
            const currentPos = this.view.posAtCoords({ x: (event as MouseEvent).x, y: (event as MouseEvent).y });
            if ((event as MouseEvent).shiftKey) {
                // Set the cursor after the element so that it doesn't select starting from the last cursor position.
                if (currentPos) {
                    const { editor } = this.view.state.field(editorInfoField);
                    if (editor) {
                        editor.setCursor(editor.offsetToPos(currentPos));
                    }
                }
                return false;
            }
        }
        return true;
    }
}

function getCssClasses(props: Set<string>): string[] {
    const classes: string[] = [];
    if (props.has("strong")) {
        classes.push("cm-strong");
    }
    if (props.has("em")) {
        classes.push("cm-em");
    }
    if (props.has("highlight")) {
        classes.push("cm-highlight");
    }
    if (props.has("strikethrough")) {
        classes.push("cm-strikethrough");
    }
    if (props.has("comment")) {
        classes.push("cm-comment");
    }
    return classes;
}

export function inlinePlugin(app: App, index: FullIndex, settings: DataviewSettings, api: DataviewApi) {
    return ViewPlugin.fromClass(
        class {
            decorations: DecorationSet;
            component: Component;

            constructor(view: EditorView) {
                this.component = new Component();
                this.component.load();
                this.decorations = this.inlineRender(view) ?? Decoration.none;
            }

            update(update: ViewUpdate) {
                // only activate in LP and not source mode
                if (!update.state.field(editorLivePreviewField)) {
                    this.decorations = Decoration.none;
                    return;
                }
                if (update.docChanged) {
                    this.decorations = this.decorations.map(update.changes);
                    this.updateTree(update.view);
                } else if (update.selectionSet) {
                    this.updateTree(update.view);
                } else if (update.viewportChanged /*|| update.selectionSet*/) {
                    this.decorations = this.inlineRender(update.view) ?? Decoration.none;
                }
            }

            updateTree(view: EditorView) {
                for (const { from, to } of view.visibleRanges) {
                    syntaxTree(view.state).iterate({
                        from,
                        to,
                        enter: ({ node }) => {
                            const { render, isQuery } = this.renderNode(view, node);
                            if (!render && isQuery) {
                                this.removeDeco(node);
                                return;
                            } else if (!render) {
                                return;
                            } else if (render) {
                                this.addDeco(node, view);
                            }
                        },
                    });
                }
            }

            removeDeco(node: SyntaxNode) {
                this.decorations.between(node.from - 1, node.to + 1, (from, to, value) => {
                    this.decorations = this.decorations.update({
                        filterFrom: from,
                        filterTo: to,
                        filter: (from, to, value) => false,
                    });
                });
            }

            addDeco(node: SyntaxNode, view: EditorView) {
                const from = node.from - 1;
                const to = node.to + 1;
                let exists = false;
                this.decorations.between(from, to, (from, to, value) => {
                    exists = true;
                });
                if (!exists) {
                    /**
                     * In a note embedded in a Canvas, app.workspace.getActiveFile() returns
                     * the canvas file, not the note file. On the other hand,
                     * view.state.field(editorInfoField).file returns the note file itself,
                     * which is more suitable here.
                     */
                    const currentFile = view.state.field(editorInfoField).file;
                    if (!currentFile) return;
                    const newDeco = this.renderWidget(node, view, currentFile)?.value;
                    if (newDeco) {
                        this.decorations = this.decorations.update({
                            add: [{ from: from, to: to, value: newDeco }],
                        });
                    }
                }
            }

            // checks whether a node should get rendered/unrendered
            renderNode(view: EditorView, node: SyntaxNode) {
                const type = node.type;
                // current node is inline code
                const tokenProps = type.prop<String>(tokenClassNodeProp);
                const props = new Set(tokenProps?.split(" "));
                if (props.has("inline-code") && !props.has("formatting")) {
                    // contains the position of inline code
                    const start = node.from;
                    const end = node.to;
                    // don't continue if current cursor position and inline code node (including formatting
                    // symbols) overlap
                    const selection = view.state.selection;
                    if (selectionAndRangeOverlap(selection, start - 1, end + 1)) {
                        if (this.isInlineQuery(view, start, end)) {
                            return { render: false, isQuery: true };
                        } else {
                            return { render: false, isQuery: false };
                        }
                    } else if (this.isInlineQuery(view, start, end)) {
                        return { render: true, isQuery: true };
                    }
                }
                return { render: false, isQuery: false };
            }

            isInlineQuery(view: EditorView, start: number, end: number) {
                const text = view.state.doc.sliceString(start, end);
                const isInlineQuery =
                    text.startsWith(settings.inlineQueryPrefix) || text.startsWith(settings.inlineJsQueryPrefix);
                return isInlineQuery;
            }

            inlineRender(view: EditorView) {
                // still doesn't work as expected for tables and callouts
                if (!index.initialized) return;
                const currentFile = view.state.field(editorInfoField).file;
                if (!currentFile) return;

                const widgets: Range<Decoration>[] = [];
                /* before:
                 *     em for italics
                 *     highlight for highlight
                 * after:
                 *     strong for bold
                 *     strikethrough for strikethrough
                 */

                for (const { from, to } of view.visibleRanges) {
                    syntaxTree(view.state).iterate({
                        from,
                        to,
                        enter: ({ node }) => {
                            if (!this.renderNode(view, node).render) return;
                            const widget = this.renderWidget(node, view, currentFile);
                            if (widget) {
                                widgets.push(widget);
                            }
                        },
                    });
                }

                return Decoration.set(widgets, true);
            }

            renderWidget(node: SyntaxNode, view: EditorView, currentFile: TFile) {
                const type = node.type;
                // contains the position of inline code
                const start = node.from;
                const end = node.to;
                // safety net against unclosed inline code
                if (view.state.doc.sliceString(end, end + 1) === "\n") {
                    return;
                }
                const text = view.state.doc.sliceString(start, end);
                let code: string = "";
                let result: Literal = "";
                const PREAMBLE: string = "const dataview=this;const dv=this;";
                const el = createSpan({
                    cls: ["dataview", "dataview-inline"],
                });
                /* If the query result is predefined text (e.g. in the case of errors), set innerText to it.
                 * Otherwise, pass on an empty element and fill it in later.
                 * This is necessary because {@link InlineWidget.toDOM} is synchronous but some rendering
                 * asynchronous.
                 */
                if (text.startsWith(settings.inlineQueryPrefix)) {
                    if (settings.enableInlineDataview) {
                        code = text.substring(settings.inlineQueryPrefix.length).trim();
                        const field = tryOrPropagate(() => parseField(code));
                        if (!field.successful) {
                            result = `Dataview (inline field '${code}'): ${field.error}`;
                            el.innerText = result;
                        } else {
                            const fieldValue = field.value;
                            const intermediateResult = tryOrPropagate(() =>
                                executeInline(fieldValue, currentFile.path, index, settings)
                            );
                            if (!intermediateResult.successful) {
                                result = `Dataview (for inline query '${fieldValue}'): ${intermediateResult.error}`;
                                el.innerText = result;
                            } else {
                                const { value } = intermediateResult;
                                result = value;
                                renderValue(app, result, el, currentFile.path, this.component, settings);
                            }
                        }
                    } else {
                        result = "(disabled; enable in settings)";
                        el.innerText = result;
                    }
                } else if (text.startsWith(settings.inlineJsQueryPrefix)) {
                    if (settings.enableInlineDataviewJs) {
                        code = text.substring(settings.inlineJsQueryPrefix.length).trim();
                        try {
                            // for setting the correct context for dv/dataview
                            const myEl = createDiv();
                            const dvInlineApi = new DataviewInlineApi(api, this.component, myEl, currentFile.path);
                            if (code.includes("await")) {
                                (evalInContext("(async () => { " + PREAMBLE + code + " })()") as Promise<any>).then(
                                    (result: any) => {
                                        renderValue(app, result, el, currentFile.path, this.component, settings);
                                    }
                                );
                            } else {
                                result = evalInContext(PREAMBLE + code);
                                renderValue(app, result, el, currentFile.path, this.component, settings);
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

                const tokenProps = type.prop<String>(tokenClassNodeProp);
                const props = new Set(tokenProps?.split(" "));
                const classes = getCssClasses(props);

                return Decoration.replace({
                    widget: new InlineWidget(classes, code, el, view),
                    inclusive: false,
                    block: false,
                }).range(start - 1, end + 1);
            }

            destroy() {
                this.component.unload();
            }
        },
        { decorations: v => v.decorations }
    );
}
