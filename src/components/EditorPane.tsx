import * as monaco from "monaco-editor/editor";
import {createEffect, onCleanup, onMount} from "solid-js";

import {
    monacoThemeName,
    setupMonaco,
    watchColorScheme,
} from "../editor/monaco-setup";
import type {CompileDiagnostic} from "../lib/compile";
import {isTexFile} from "../lib/files";

const MARKER_OWNER = "latex-compile";

export interface EditorFile {
    path: string;
    text: string;
}

interface EditorPaneProps {
    file: EditorFile | null;
    diagnostics: CompileDiagnostic[];
    onChange: (value: string) => void;
    onSave: () => void;
    onBlur: () => void;
    onCompile: () => void;
    onReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

export function EditorPane(props: EditorPaneProps) {
    let host: HTMLDivElement | undefined;

    onMount(() => {
        if (!host) {
            return;
        }

        setupMonaco();

        let model: monaco.editor.ITextModel | null = null;

        const editor = monaco.editor.create(host, {
            model: null,
            theme: monacoThemeName(),
            automaticLayout: true,
            fontSize: 18,
            fontLigatures: true,
            lineHeight: 1.6,
            fontFamily:
                "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
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

        const applyFile = (file: EditorFile | null) => {
            editor.setModel(null);
            model?.dispose();
            model = null;

            if (!file) {
                return;
            }

            model = monaco.editor.createModel(
                file.text,
                isTexFile(file.path) ? "latex" : "plaintext",
                monaco.Uri.parse(`file:///workspace/${encodeURI(file.path)}`),
            );

            editor.setModel(model);
            editor.setPosition({lineNumber: 1, column: 1});
            editor.setScrollTop(0);
            editor.focus();
        };

        const changeSubscription = editor.onDidChangeModelContent(() => {
            props.onChange(editor.getValue());
        });

        const applyDiagnostics = () => {
            const target = model;
            if (!target) {
                return;
            }

            const filePath = props.file?.path ?? "";
            const lineCount = target.getLineCount();
            const markers = props.diagnostics
                .filter(diagnostic => diagnostic.file === filePath)
                .map(diagnostic => {
                    const lineNumber = Math.min(
                        Math.max(1, diagnostic.line),
                        lineCount,
                    );

                    return {
                        severity:
                            diagnostic.severity === "warning"
                                ? monaco.MarkerSeverity.Warning
                                : monaco.MarkerSeverity.Error,
                        message: diagnostic.message,
                        startLineNumber: lineNumber,
                        startColumn: 1,
                        endLineNumber: lineNumber,
                        endColumn: target.getLineMaxColumn(lineNumber),
                        source: "LaTeX",
                    };
                })
                .sort((a, b) => a.startLineNumber - b.startLineNumber);

            monaco.editor.setModelMarkers(target, MARKER_OWNER, markers);
        };

        const blurSubscription = editor.onDidBlurEditorWidget(() => {
            props.onBlur();
        });

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
            props.onSave(),
        );

        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () =>
            props.onCompile(),
        );

        const unsubscribeColorScheme = watchColorScheme(() => {
            monaco.editor.setTheme(monacoThemeName());
        });

        props.onReady(editor);

        createEffect(() => {
            applyFile(props.file);
        });

        createEffect(() => {
            applyDiagnostics();
        });

        onCleanup(() => {
            unsubscribeColorScheme();
            changeSubscription.dispose();
            blurSubscription.dispose();
            editor.setModel(null);
            model?.dispose();
            editor.dispose();
        });
    });

    return (
        <div
            ref={element => {
                host = element;
            }}
            class="size-full min-h-0"
        />
    );
}
