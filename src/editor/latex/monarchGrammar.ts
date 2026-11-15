import {languages} from "monaco-editor/editor";

const VERBATIM_BEGIN = /\\begin\{(verbatim\*?|lstlisting|minted)\}/;
const VERBATIM_END = /\\end\{(verbatim\*?|lstlisting|minted)\}/;

const COMMON_MATH_RULES: languages.IMonarchLanguageRule[] = [
    [/(\\[a-zA-Z@]+)(\*?)/, ["keyword", "keyword"]],
    [/\\./, "keyword"],
    [/[{}[\]()]/, "@brackets"],
    [/\d+(?:\.\d+)?/, "number"],
    [/[a-zA-Z]+/, "variable"],
    [/[=+\-*/<>]/, "operator"],
];

/**
 * Rules shared by every math tokenizer state. `closer` ends the math mode and
 * pops back to `root`; comments stay active inside math.
 */
function mathState(closer: RegExp): languages.IMonarchLanguageRule[] {
    return [
        [/%/, {token: "comment", next: "@comment"}],
        [closer, {token: "keyword", next: "@pop"}],
        ...COMMON_MATH_RULES,
    ];
}

/**
 * Register the Monarch tokenizer used for syntax highlighting.
 */
export function registerLatexMonarchTokens(): void {
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
                [VERBATIM_BEGIN, {token: "keyword", next: "@verbatim"}],

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
                [VERBATIM_END, {token: "keyword", next: "@pop"}],
                [/./, "string"],
            ],

            math: mathState(/\$/),
            displayMath: mathState(/\$\$/),
            displayMathBracket: mathState(/\\\]/),
            mathParen: mathState(/\\\)/),
        },
    });
}
