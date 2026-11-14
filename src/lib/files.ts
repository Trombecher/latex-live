import type {DirEntry} from "./workspace";

/**
 * The final path segment.
 */
export function fileName(path: string): string {
    return path.split("/").pop() || path;
}

/**
 * Lowercase extension without the dot, or an empty string.
 */
export function fileExtension(path: string): string {
    const name = fileName(path);
    const dot = name.lastIndexOf(".");
    return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export function isTexFile(path: string): boolean {
    const extension = fileExtension(path);
    return extension === "tex" || extension === "latex";
}

/**
 * Extensions that the text editor can open. Files without an extension (such as
 * `Makefile` or `.gitignore`) are treated as text as well.
 */
const TEXT_EXTENSIONS = new Set([
    // LaTeX and its auxiliary files.
    "tex",
    "latex",
    "ltx",
    "bib",
    "bst",
    "cls",
    "sty",
    "dtx",
    "ins",
    "def",
    "clo",
    "fd",
    "enc",
    "cfg",
    "aux",
    "bbl",
    "bcf",
    "blg",
    "fls",
    "log",
    "lof",
    "lot",
    "out",
    "toc",
    "nav",
    "snm",
    "vrb",
    "idx",
    "ind",
    "ilg",
    "gls",
    "glo",
    "glg",
    "acn",
    "acr",
    "alg",
    "ist",
    "thm",
    "tikz",
    // Plain text and markup.
    "txt",
    "text",
    "md",
    "markdown",
    "mdx",
    "rst",
    "adoc",
    "asciidoc",
    "org",
    "texi",
    "texinfo",
    // Data and configuration.
    "json",
    "jsonc",
    "json5",
    "yaml",
    "yml",
    "toml",
    "ini",
    "conf",
    "config",
    "properties",
    "env",
    "lock",
    "csv",
    "tsv",
    "xml",
    "plist",
    // Web and source code.
    "html",
    "htm",
    "xhtml",
    "css",
    "scss",
    "sass",
    "less",
    "svg",
    "js",
    "jsx",
    "mjs",
    "cjs",
    "ts",
    "tsx",
    "mts",
    "cts",
    "vue",
    "svelte",
    "astro",
    "py",
    "pyi",
    "rb",
    "php",
    "pl",
    "pm",
    "lua",
    "r",
    "jl",
    "go",
    "rs",
    "c",
    "h",
    "cc",
    "cpp",
    "cxx",
    "hpp",
    "hh",
    "hxx",
    "cs",
    "java",
    "kt",
    "kts",
    "swift",
    "m",
    "mm",
    "scala",
    "groovy",
    "gradle",
    "clj",
    "cljs",
    "cljc",
    "edn",
    "ex",
    "exs",
    "erl",
    "hrl",
    "hs",
    "lhs",
    "ml",
    "mli",
    "fs",
    "fsi",
    "fsx",
    "vb",
    "asm",
    "s",
    "sh",
    "bash",
    "zsh",
    "fish",
    "ps1",
    "psm1",
    "bat",
    "cmd",
    "nu",
    "sql",
    "graphql",
    "gql",
    "proto",
    "thrift",
    "vim",
    "el",
    "lisp",
    "scm",
    "rkt",
    // Build tooling.
    "mk",
    "cmake",
    "ninja",
    "gitignore",
    "gitattributes",
    "gitmodules",
    "gitconfig",
    "editorconfig",
    "npmrc",
    "prettierrc",
    "eslintrc",
    "babelrc",
]);

export function isTextFile(path: string): boolean {
    const extension = fileExtension(path);
    return extension === "" || TEXT_EXTENSIONS.has(extension);
}

export function errorMessage(cause: unknown): string {
    return typeof cause === "string"
        ? cause
        : cause instanceof Error
          ? cause.message
          : String(cause);
}

export type {DirEntry};
