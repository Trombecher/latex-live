import {languages} from "monaco-editor/editor";

/**
 * Register the `latex` language id with Monaco and configure its editing
 * behaviour: comments, brackets, auto-closing pairs and the word pattern.
 */
export function registerLatexLanguageConfiguration(): void {
    languages.register({
        id: "latex",
        extensions: [".tex", ".latex"],
        aliases: ["LaTeX", "latex", "TeX", "tex"],
    });

    languages.setLanguageConfiguration("latex", {
        comments: {lineComment: "%"},
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"],
        ],
        autoClosingPairs: [
            {open: "{", close: "}"},
            {open: "[", close: "]"},
            {open: "(", close: ")"},
            {open: "$", close: "$"},
            {open: "`", close: "'"},
        ],
        surroundingPairs: [
            {open: "{", close: "}"},
            {open: "[", close: "]"},
            {open: "(", close: ")"},
            {open: "$", close: "$"},
            {open: "`", close: "'"},
        ],
        wordPattern: /\\[a-zA-Z@]+|[a-zA-Z0-9_]+/,
    });
}
