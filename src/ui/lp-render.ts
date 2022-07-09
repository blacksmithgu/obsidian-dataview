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


import {EditorView, ViewUpdate, Decoration, ViewPlugin, DecorationSet, WidgetType} from "@codemirror/view";
import { EditorSelection, Range } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import {DataviewSettings} from "../settings";
import { FullIndex } from "../data-index";
import {/*Component,*/ editorLivePreviewField, TFile} from "obsidian";
//import {asyncEvalInContext, DataviewInlineApi} from "../api/inline-api";
import {DataviewApi} from "../api/plugin-api";
import {renderMinimalDate, renderMinimalDuration, tryOrPropogate} from "../util/normalize";
import {parseField} from "../expression/parse";
import {executeInline} from "../query/engine";
import {currentLocale} from "../util/locale";
import {Literal, Values} from "../data-model/value";

function selectionAndRangeOverlap(selection: EditorSelection, rangeFrom:
    number, rangeTo: number) {

    for (const range of selection.ranges) {
        if ((range.from <= rangeTo) && (range.to) >= rangeFrom) {
            return true;
        }
    }

    return false;
}


// also returns text between inline code, so there always needs to be a check whether the correct prefix is used.
function getInlineCodeBounds(view: EditorView, pos?: number): {start: number, end: number} | null {
    const text = view.state.doc.toString()
    if (typeof pos === "undefined") {
        pos = view.state.selection.main.from;
    }
    let left = text.lastIndexOf('`', pos)
    const right = text.indexOf('`', pos)
    // no backtick before or after the current backtick
    if (left === -1 || right === -1) return null;
    const leftNewline = text.lastIndexOf('\n', pos)
    const rightNewline = text.indexOf('\n', pos)

    // start or end of document w/o new lines
    if (leftNewline === -1 || rightNewline === -1) {
        return {start: left , end: right+1}
    }

    if (leftNewline > left || rightNewline < right) return null;

    return {start: left , end: right+1}
}




class InlineWidget extends WidgetType {
    constructor(readonly markdown: string | Literal, readonly settings: DataviewSettings, readonly currentFile: TFile) {
        super();
    }
    eq(other: InlineWidget): boolean {
        return other.markdown === this.markdown;
    }

    toDOM(view: EditorView): HTMLElement {
        const value = this.markdown;
        let result: string  = "";
        if (value) {
            // only support strings
            if (Values.isDate(value)) {
                result = renderMinimalDate(value, this.settings, currentLocale());
            } else if (Values.isDuration(value)) {
                result = renderMinimalDuration(value);
            } else if (Values.isString(value)) {
                result = value;
            } else if (Values.isFunction(value)) {
                result = "<function>";
            } else {
                result = "Not supported in LP or unrecognized.";
            }
        }
        const el = createSpan({
            text: result,
            cls: ['dataview', 'dataview-inline']
        })
        return el;
    }

    ignoreEvent(event: Event): boolean {
        return false;
    }
}


function inlineRender(view: EditorView, index: FullIndex, dvSettings: DataviewSettings, api: DataviewApi) {

    const widgets: Range<Decoration>[] = [];
    const selection = view.state.selection;
    const regex = new RegExp("formatting_formatting-code.*?_inline-code");

    //@ts-ignore
    for (const { from, to } of view.visibleRanges) {

        syntaxTree(view.state).iterate({ from, to, enter: ({node}) => {
            // settings and index aren't initialised yet
            if (!dvSettings || !index) return;
            const type = node.type;
            //const from = node.from;
            const to = node.to;
            if (!regex.test(type.name)) {return}
            const bounds = getInlineCodeBounds(view, to);
            if (!bounds) return;

            // at this point bounds contains the position we want to replace and
            // result contains the text with which we want to replace it
            const start = bounds.start;
            const end = bounds.end;
            if (selectionAndRangeOverlap(selection, start, end)) return;

            const text = view.state.doc.sliceString(start + 1, end -1);
            let code: string;
            // the `this` isn't correct here, it's just for testing
            const PREAMBLE: string = "const dataview = comp;const dv=comp;";
            let result: string | Literal = "";
            const currentFile = app.workspace.getActiveFile();
            if (!currentFile) return;
            if (dvSettings.inlineQueryPrefix.length > 0 && text.startsWith(dvSettings.inlineQueryPrefix)) {
                code = text.substring(dvSettings.inlineQueryPrefix.length).trim()
                const field = tryOrPropogate(() => parseField(code));
                if (!field.successful) {
                    result = `Dataview (inline field '${code}'): ${field.error}`;
                } else {
                    const fieldValue = field.value;
                    const intermediateResult = tryOrPropogate(() => executeInline(fieldValue, currentFile.path, index, dvSettings));
                    if (!intermediateResult.successful) {
                        result = `Dataview (for inline query '${fieldValue}'): ${intermediateResult.error}`;
                    } else {
                        const { value } = intermediateResult;
                        result = value;
                    }
                }
            } else if (dvSettings.inlineJsQueryPrefix.length > 0 && text.startsWith(dvSettings.inlineJsQueryPrefix)) {
                if (dvSettings.enableInlineDataviewJs) {
                    code = text.substring(dvSettings.inlineJsQueryPrefix.length).trim()
                    try {
                        // how do I set the `this` context properly?
                        const comp = {
                            api: api,
                            current: () => currentFile,
                            settings: dvSettings,
                            index: index
                        }
                        if (code.includes("await")) {
                            // await doesn't seem to work with it because the WidgetPlugin expects it to be synchronous
                            // so this should be removed and instead an error message shown
                            (evalWoContext("(async () => { " + PREAMBLE + code + " })()") as Promise<any>).then((value: any) => result = value)
                        } else {
                            result = evalWoContext(PREAMBLE + code);
                        }

                        function evalWoContext(script: string): any {
                            return function () {return eval(script)}.call(comp);
                        }
                    } catch (e) {
                        result = `Dataview (for inline JS query '${code}'): ${e}`;
                    }
                } else {
                    result = "(disabled; enable in settings)";
                }

            } else {
                return;
            }

            widgets.push(
                Decoration.replace({
                    widget: new InlineWidget(result, dvSettings, currentFile),
                    inclusive: false,
                    block: false,
                }).range(start, end)
            );

            }

        });
    }

    return Decoration.set(widgets, true)
}



export function inlinePlugin(index: FullIndex, settings: DataviewSettings, api: DataviewApi) {
    return ViewPlugin.fromClass(class {
        decorations: DecorationSet

        constructor(view: EditorView) {
            this.decorations = inlineRender(view, index, settings, api)
        }

        update(update: ViewUpdate) {
            //@ts-ignore
            if (!update.state.field(editorLivePreviewField)) {
                this.decorations = Decoration.none;
                return;
            }
            if (update.docChanged || update.viewportChanged || update.selectionSet)
                this.decorations = inlineRender(update.view, index, settings, api)
        }
    }, {decorations: v => v.decorations,});
}
