/** importer for canvas nodes */

import { CanvasMetadata } from "data-model/canvas";
import { FileStats } from "obsidian";
import { parsePage } from "./markdown-file";


export function parseCanvasNode(path: string, contents: string, stats: FileStats): CanvasMetadata {
    const parsedPage = parsePage(path, contents, stats, {});

    const canvas = new CanvasMetadata(path, parsedPage);

    return canvas;

}
