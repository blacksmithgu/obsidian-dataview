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
