import type * as monaco from "monaco-editor/editor";
import {Show} from "solid-js";

import type {CompileDiagnostic} from "../lib/compile";
import type {EditorFile} from "../lib/createFileSession";
import {isTextFile} from "../lib/fileKinds";
import type {DirEntry} from "../lib/workspace";
import {EditorEmptyState} from "./EditorEmptyState";
import {EditorPane} from "./EditorPane";
import {FilePlaceholder} from "./FilePlaceholder";
import {LoadingOverlay} from "./LoadingOverlay";

interface EditorAreaProps {
    hasWorkspace: boolean;
    selection: DirEntry | null;
    file: EditorFile | null;
    diagnostics: CompileDiagnostic[];
    spellcheckTrigger: number;
    loadingFile: boolean;
    onChange: (text: string) => void;
    onSave: () => void;
    onBlur: () => void;
    onCompile: () => void;
    onReady: (editor: monaco.editor.IStandaloneCodeEditor) => void;
}

/**
 * The source pane: the editor for text files, a placeholder for other files and
 * an empty state otherwise.
 */
export function EditorArea(props: EditorAreaProps) {
    const isEditableSelected = () => {
        const entry = props.selection;
        return entry !== null && !entry.isDir && isTextFile(entry.path);
    };

    return (
        <section class="relative flex min-w-0 flex-1 flex-col bg-surface-100">
            <Show
                when={isEditableSelected()}
                fallback={
                    <Show
                        when={props.selection}
                        fallback={
                            <EditorEmptyState
                                hasWorkspace={props.hasWorkspace}
                            />
                        }
                    >
                        {entry => <FilePlaceholder entry={entry()} />}
                    </Show>
                }
            >
                <EditorPane
                    file={props.file}
                    diagnostics={props.diagnostics}
                    spellcheckTrigger={props.spellcheckTrigger}
                    onChange={props.onChange}
                    onSave={props.onSave}
                    onBlur={props.onBlur}
                    onCompile={props.onCompile}
                    onReady={props.onReady}
                />
            </Show>

            <Show when={props.loadingFile}>
                <LoadingOverlay label="Opening file…" />
            </Show>
        </section>
    );
}
