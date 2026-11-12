import * as monaco from "monaco-editor/editor";
import {onMount} from "solid-js";

export default () => {
    let editor: monaco.editor.IStandaloneCodeEditor | undefined;

    return (
        <>
            <div
                class="max-h-screen"
                ref={div => {
                    onMount(() => {
                        const tm = monaco.editor.createModel(
                            `class Test {}`,
                            "typescript",
                            monaco.Uri.parse("file:///main.ts"),
                        );

                        editor = monaco.editor.create(div, {
                            model: tm,
                            language: "typescript",
                            theme: "vs-dark",
                            automaticLayout: true,
                        });
                    });
                }}
            ></div>
            <div>Right side</div>
        </>
    );
};
