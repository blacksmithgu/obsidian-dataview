import { Link } from "data-model/value";

export const IMAGE_EXTENSIONS = Object.freeze(
    new Set([
        ".tif",
        ".tiff",
        ".gif",
        ".png",
        ".apng",
        ".avif",
        ".jpg",
        ".jpeg",
        ".jfif",
        ".pjepg",
        ".pjp",
        ".svg",
        ".webp",
        ".bmp",
        ".ico",
        ".cur",
    ])
);

/** Determines if the given link points to an embedded image. */
export function isImageEmbed(link: Link): boolean {
    if (!link.path.contains(".")) return false;

    let extension = link.path.substring(link.path.lastIndexOf("."));
    return link.type == "file" && link.embed && IMAGE_EXTENSIONS.has(extension);
}

/** Extract text of the form 'WxH' or 'W' from the display of a link. */
export function extractImageDimensions(link: Link): [number, number] | [number] | undefined {
    if (!link.display) return undefined;

    let match = /^(\d+)x(\d+)$/iu.exec(link.display);
    if (match) return [parseInt(match[1]), parseInt(match[2])];

    let match2 = /^(\d+)/.exec(link.display);
    if (match2) return [parseInt(match2[1])];

    // No match.
    return undefined;
}
