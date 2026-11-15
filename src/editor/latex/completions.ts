import {languages} from "monaco-editor/editor";

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

/**
 * Register the `\command` and `\begin{environment}` completion provider.
 */
export function registerLatexCompletions(): void {
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
