import {languages} from "monaco-editor/editor";

/**
 * Register a Monarch-based LaTeX language with Monaco.
 *
 * Monaco does not ship a LaTeX grammar, so we provide a reasonably complete one
 * here: comments, control sequences, environments, math modes, verbatim blocks,
 * and bracket handling.
 */
export function registerLatexLanguage(): void {
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

    languages.setMonarchTokensProvider("latex", {
        defaultToken: "",
        tokenPostfix: ".latex",

        brackets: [
            {open: "{", close: "}", token: "delimiter.curly"},
            {open: "[", close: "]", token: "delimiter.square"},
            {open: "(", close: ")", token: "delimiter.parenthesis"},
        ],

        tokenizer: {
            root: [
                [/%/, {token: "comment", next: "@comment"}],

                // Verbatim-like environments must be handled before the
                // generic \begin{...} rule.
                [
                    /\\begin\{(verbatim\*?|lstlisting|minted)\}/,
                    {token: "keyword", next: "@verbatim"},
                ],

                [
                    /(\\begin|\\end)(\{)([^}]*)(\})/,
                    ["keyword", "delimiter.curly", "type", "delimiter.curly"],
                ],

                [
                    /\\verb\*?(\|)([^|]*)(\|)/,
                    ["keyword", "string", "string", "string"],
                ],

                // Math delimiters must precede the generic control-symbol rule.
                [/\\\[/, {token: "keyword", next: "@displayMathBracket"}],
                [/\\\(/, {token: "keyword", next: "@mathParen"}],
                [/\$\$/, {token: "keyword", next: "@displayMath"}],
                [/\$/, {token: "keyword", next: "@math"}],

                [/(\\[a-zA-Z@]+)(\*?)/, ["keyword", "keyword"]],
                [/\\./, "keyword"],

                [/[{}[\]()]/, "@brackets"],
                [/\d+(?:\.\d+)?/, "number"],
                [/[&_^#~]/, "operator"],
            ],

            comment: [[/.*$/, "comment", "@pop"]],

            verbatim: [
                [
                    /\\end\{(verbatim\*?|lstlisting|minted)\}/,
                    {token: "keyword", next: "@pop"},
                ],
                [/./, "string"],
            ],

            math: [
                [/%/, {token: "comment", next: "@comment"}],
                [/\$/, {token: "keyword", next: "@pop"}],
                [/(\\[a-zA-Z@]+)(\*?)/, ["keyword", "keyword"]],
                [/\\./, "keyword"],
                [/[{}[\]()]/, "@brackets"],
                [/\d+(?:\.\d+)?/, "number"],
                [/[a-zA-Z]+/, "variable"],
                [/[=+\-*/<>]/, "operator"],
            ],

            displayMath: [
                [/%/, {token: "comment", next: "@comment"}],
                [/\$\$/, {token: "keyword", next: "@pop"}],
                [/(\\[a-zA-Z@]+)(\*?)/, ["keyword", "keyword"]],
                [/\\./, "keyword"],
                [/[{}[\]()]/, "@brackets"],
                [/\d+(?:\.\d+)?/, "number"],
                [/[a-zA-Z]+/, "variable"],
                [/[=+\-*/<>]/, "operator"],
            ],

            displayMathBracket: [
                [/%/, {token: "comment", next: "@comment"}],
                [/\\\]/, {token: "keyword", next: "@pop"}],
                [/(\\[a-zA-Z@]+)(\*?)/, ["keyword", "keyword"]],
                [/\\./, "keyword"],
                [/[{}[\]()]/, "@brackets"],
                [/\d+(?:\.\d+)?/, "number"],
                [/[a-zA-Z]+/, "variable"],
                [/[=+\-*/<>]/, "operator"],
            ],

            mathParen: [
                [/%/, {token: "comment", next: "@comment"}],
                [/\\\)/, {token: "keyword", next: "@pop"}],
                [/(\\[a-zA-Z@]+)(\*?)/, ["keyword", "keyword"]],
                [/\\./, "keyword"],
                [/[{}[\]()]/, "@brackets"],
                [/\d+(?:\.\d+)?/, "number"],
                [/[a-zA-Z]+/, "variable"],
                [/[=+\-*/<>]/, "operator"],
            ],
        },
    });

    registerCompletions();
}

const COMMANDS = [
    "\\documentclass",
    "\\usepackage",
    "\\begin",
    "\\end",
    "\\title",
    "\\author",
    "\\date",
    "\\maketitle",
    "\\tableofcontents",
    "\\part",
    "\\chapter",
    "\\section",
    "\\subsection",
    "\\subsubsection",
    "\\paragraph",
    "\\label",
    "\\ref",
    "\\eqref",
    "\\cite",
    "\\bibliography",
    "\\bibliographystyle",
    "\\textbf",
    "\\textit",
    "\\underline",
    "\\emph",
    "\\texttt",
    "\\footnote",
    "\\item",
    "\\caption",
    "\\centering",
    "\\includegraphics",
    "\\frac",
    "\\sqrt",
    "\\sum",
    "\\prod",
    "\\int",
    "\\lim",
    "\\infty",
    "\\alpha",
    "\\beta",
    "\\gamma",
    "\\delta",
    "\\epsilon",
    "\\theta",
    "\\lambda",
    "\\mu",
    "\\pi",
    "\\sigma",
    "\\phi",
    "\\omega",
    "\\times",
    "\\cdot",
    "\\leq",
    "\\geq",
    "\\neq",
    "\\approx",
    "\\rightarrow",
    "\\left",
    "\\right",
    "\\newline",
    "\\newpage",
    "\\clearpage",
    "\\hspace",
    "\\vspace",
    "\\input",
    "\\include",
];

const ENVIRONMENTS = [
    "document",
    "itemize",
    "enumerate",
    "description",
    "figure",
    "table",
    "tabular",
    "center",
    "flushleft",
    "flushright",
    "quote",
    "quotation",
    "verbatim",
    "equation",
    "equation*",
    "align",
    "align*",
    "gather",
    "gather*",
    "multline",
    "multline*",
    "theorem",
    "lemma",
    "proof",
    "abstract",
];

function registerCompletions(): void {
    languages.registerCompletionItemProvider("latex", {
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position);
            let startColumn = word.startColumn;

            // The word pattern does not include the leading backslash, so
            // extend the replacement range over it when present.
            const lineBefore = model
                .getLineContent(position.lineNumber)
                .slice(0, startColumn - 1);
            if (lineBefore.endsWith("\\")) {
                startColumn -= 1;
            }

            const range = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn,
                endColumn: word.endColumn,
            };

            const commands = COMMANDS.map(label => ({
                label,
                kind: languages.CompletionItemKind.Function,
                detail: "LaTeX command",
                insertText: label,
                range,
            }));

            const environments = ENVIRONMENTS.map(environment => ({
                label: `\\begin{${environment}}`,
                kind: languages.CompletionItemKind.Snippet,
                detail: "LaTeX environment",
                insertText: `\\begin{${environment}}\n\t$0\n\\end{${environment}}`,
                insertTextRules:
                    languages.CompletionItemInsertTextRule.InsertAsSnippet,
                range,
            }));

            return {suggestions: [...commands, ...environments]};
        },
    });
}
