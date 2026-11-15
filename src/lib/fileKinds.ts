import {fileExtension} from "./paths";
import {TEXT_EXTENSIONS} from "./textExtensions";

export function isTexFile(path: string): boolean {
    const extension = fileExtension(path);
    return extension === "tex" || extension === "latex";
}

export function isTextFile(path: string): boolean {
    const extension = fileExtension(path);
    return extension === "" || TEXT_EXTENSIONS.has(extension);
}
