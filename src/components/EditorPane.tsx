import * as monaco from "monaco-editor/editor";
import {onCleanup, onMount} from "solid-js";

import {setupMonaco} from "../editor/monaco-setup";

const SAMPLE_DOCUMENT = `\\documentclass[11pt]{article}

\\usepackage{amsmath}
\\usepackage{amssymb}
\\usepackage{hyperref}

\\title{Hello, LaTeX Live}
\\author{Your Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\begin{abstract}
This document is compiled with Tectonic and rendered with pdf.js, entirely
inside the app. Edit the source on the left and press \\textbf{Compile}.
\\end{abstract}

\\section{Introduction}
LaTeX Live is a small editor for writing and previewing LaTeX documents. It
supports syntax highlighting for commands, environments, math, and comments.

\\section{Mathematics}
Inline math such as $E = mc^2$ and display math work as expected:

\\[
    \\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}
\\]

\\begin{align}
    (a + b)^2 &= a^2 + 2ab + b^2 \\\\
    \\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0}
\\end{align}

\\section{Lists}
\\begin{itemize}
    \\item Compile with the toolbar button.
    \\item Use \\texttt{Ctrl/Cmd + Enter} as a shortcut.
    \\item Fix errors and compile again.
\\end{itemize}

\\end{document}
`;

interface EditorPaneProps {
    onReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

export function EditorPane(props: EditorPaneProps) {
    let host: HTMLDivElement | undefined;

    onMount(() => {
        if (!host) {
            return;
        }

        setupMonaco();

        const model = monaco.editor.createModel(
            SAMPLE_DOCUMENT,
            "latex",
            monaco.Uri.parse("file:///main.tex"),
        );

        const editor = monaco.editor.create(host, {
            model,
            theme: "latex-dark",
            automaticLayout: true,
            fontSize: 14,
            fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            minimap: {enabled: false},
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 4,
            insertSpaces: true,
            padding: {top: 12, bottom: 12},
            renderLineHighlight: "all",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            suggest: {showWords: false},
        });

        props.onReady(editor);

        onCleanup(() => {
            editor.dispose();
            model.dispose();
        });
    });

    return (
        <div
            ref={element => {
                host = element;
            }}
            class="h-full min-h-0 w-full"
        />
    );
}
