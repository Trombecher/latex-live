// Editor contributions. The lightweight `monaco-editor/editor` entry point
// does not include these, but they are what make the editor feel like an
// editor (find, suggestions, bracket matching, comments, etc.).
import "monaco-editor/editor/browser/coreCommands";
import "monaco-editor/editor/contrib/bracketMatching/browser/bracketMatching";
import "monaco-editor/editor/contrib/clipboard/browser/clipboard";
import "monaco-editor/editor/contrib/comment/browser/comment";
import "monaco-editor/editor/contrib/contextmenu/browser/contextmenu";
import "monaco-editor/editor/contrib/cursorUndo/browser/cursorUndo";
import "monaco-editor/editor/contrib/find/browser/findController";
import "monaco-editor/editor/contrib/folding/browser/folding";
import "monaco-editor/editor/contrib/hover/browser/hoverContribution";
import "monaco-editor/editor/contrib/linesOperations/browser/linesOperations";
import "monaco-editor/editor/contrib/multicursor/browser/multicursor";
import "monaco-editor/editor/contrib/snippet/browser/snippetController2";
import "monaco-editor/editor/contrib/suggest/browser/suggestController";
import "monaco-editor/editor/contrib/wordOperations/browser/wordOperations";
import {editor} from "monaco-editor/editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";

import {registerLatexLanguage} from "./latex-language";

let initialized = false;

const DARK_THEME_QUERY = "(prefers-color-scheme: dark)";

/**
 * The Monaco theme matching the current color scheme.
 */
export function monacoThemeName(): string {
    return window.matchMedia(DARK_THEME_QUERY).matches
        ? "latex-dark"
        : "latex-light";
}

/**
 * Calls `onChange` whenever the OS color scheme changes. Returns an unsubscribe
 * function.
 */
export function watchColorScheme(onChange: () => void): () => void {
    const query = window.matchMedia(DARK_THEME_QUERY);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
}

/**
 * Configure Monaco once: worker, LaTeX language, and themes.
 */
export function setupMonaco(): void {
    if (initialized) {
        return;
    }
    initialized = true;

    self.MonacoEnvironment = {getWorker: () => new EditorWorker()};

    registerLatexLanguage();

    editor.defineTheme("latex-light", {
        base: "vs",
        inherit: true,
        rules: [
            {token: "comment.latex", foreground: "008000", fontStyle: "italic"},
            {token: "keyword.latex", foreground: "AF00DB"},
            {token: "type.latex", foreground: "267F99"},
            {token: "string.latex", foreground: "A31515"},
            {token: "number.latex", foreground: "098658"},
            {token: "variable.latex", foreground: "001080"},
            {token: "operator.latex", foreground: "000000"},
            {token: "delimiter.curly.latex", foreground: "B8860B"},
            {token: "delimiter.square.latex", foreground: "800080"},
            {token: "delimiter.parenthesis.latex", foreground: "800080"},
        ],
        colors: {"editor.background": "#f5f5f5"},
    });

    editor.defineTheme("latex-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [
            {token: "comment.latex", foreground: "6A9955", fontStyle: "italic"},
            {token: "keyword.latex", foreground: "C586C0"},
            {token: "type.latex", foreground: "4EC9B0"},
            {token: "string.latex", foreground: "CE9178"},
            {token: "number.latex", foreground: "B5CEA8"},
            {token: "variable.latex", foreground: "9CDCFE"},
            {token: "operator.latex", foreground: "D4D4D4"},
            {token: "delimiter.curly.latex", foreground: "FFD700"},
            {token: "delimiter.square.latex", foreground: "DA70D6"},
            {token: "delimiter.parenthesis.latex", foreground: "DA70D6"},
        ],
        colors: {"editor.background": "#171717"},
    });
}
