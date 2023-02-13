/** importer for canvas nodes */

// import { CanvasMetadata } from "data-model/canvas";
import { CanvasCard, CanvasMetadataIndex } from "data-model/canvas";
import { FileStats /* parseYaml */ } from "obsidian";
import { parsePage } from "./markdown-file";


export function parseCanvasCard(path: string, id: string, contents: string, stat: FileStats, mindex: CanvasMetadataIndex) {
    // @ts-expect-error SHUT UP MEG
    const metadata = mindex[path]?.caches[id]

    let data = JSON.parse(contents)
    // @ts-ignore
    // data.nodes = data.nodes
    let current = data.nodes[data.nodes.findIndex((a: any) => a.id === id)]
    const parsedPage = parsePage(path, current.text, stat, metadata)

    return new CanvasCard(current, path, stat, parsedPage)
}
