import * as monaco from "monaco-editor/editor";
import Typo from "typo-js";
import enAff from "typo-js/dictionaries/en_US/en_US.aff?raw";
import enDic from "typo-js/dictionaries/en_US/en_US.dic?raw";

import deAff from "./dictionaries/de_DE.aff?raw";
import deDic from "./dictionaries/de_DE.dic?raw";

// Spellcheck markers use their own owner so they never clobber the LaTeX
// compile diagnostics written by EditorPane.
const SPELLCHECK_OWNER = "latex-spellcheck";
const SPELLCHECK_SOURCE = "Spellcheck";
const SPELLCHECK_CODE = "spelling";
const ADD_WORD_COMMAND = "latex-live.spellcheck.addWord";

// A word is accepted when any of these dictionaries knows it. That way mixed
// German/English documents work without having to pick one language up front.
const dictionaries: Typo[] = [];

// Words that are always accepted: LaTeX jargon and words the user adds during
// the current session. The set is intentionally kept in memory only.
const acceptedWords = new Set<string>([
    "latex",
    "tex",
    "tikz",
    "pgf",
    "pgfplots",
    "tikzpicture",
    "bibtex",
    "biber",
    "xelatex",
    "pdflatex",
    "lualatex",
    "latexmk",
    "ctan",
]);

const LETTER = /^\p{L}$/u;
const ASCII_WORD_CHAR = /^[a-zA-Z@]$/;
const WHITESPACE = /^\s$/;

// In these environments the content is math, not prose.
const MATH_ENVIRONMENTS = new Set([
    "math",
    "displaymath",
    "equation",
    "equation*",
    "eqnarray",
    "eqnarray*",
    "align",
    "align*",
    "alignat",
    "alignat*",
    "xalignat",
    "xalignat*",
    "flalign",
    "flalign*",
    "gather",
    "gather*",
    "multline",
    "multline*",
    "split",
    "gathered",
    "aligned",
    "alignedat",
    "cases",
    "array",
    "matrix",
    "pmatrix",
    "bmatrix",
    "vmatrix",
    "Vmatrix",
    "Bmatrix",
    "smallmatrix",
]);

// The arguments of these commands are identifiers/paths, not prose.
const IDENTIFIER_COMMANDS = new Set([
    "label",
    "ref",
    "eqref",
    "pageref",
    "autoref",
    "cref",
    "Cref",
    "cite",
    "citep",
    "citet",
    "citeauthor",
    "citeyear",
    "nocite",
    "url",
    "path",
    "href",
    "includegraphics",
    "usepackage",
    "documentclass",
    "input",
    "include",
    "bibliography",
    "bibliographystyle",
    "addbibresource",
    "newcommand",
    "renewcommand",
    "providecommand",
    "def",
    "let",
    "setlength",
    "addtolength",
    "setcounter",
    "addtocounter",
    "hypersetup",
    "geometry",
    "DeclareMathOperator",
    "newenvironment",
    "newtheorem",
    "index",
    "glossary",
    "graphicspath",
    "PassOptionsToPackage",
    "lstinputlisting",
    "verbatiminput",
]);

interface WordToken {
    word: string;
    start: number;
    end: number;
}

/**
 * Lazily parse the dictionaries once. Parsing a Hunspell dictionary is a few
 * hundred milliseconds, so it is deferred until the first spellcheck.
 */
function getDictionaries(): Typo[] {
    if (dictionaries.length === 0) {
        dictionaries.push(
            new Typo("en_US", enAff, enDic),
            new Typo("de_DE", deAff, deDic),
        );
    }
    return dictionaries;
}

function readCommand(text: string, index: number): {name: string; end: number} {
    let cursor = index + 1;
    if (cursor < text.length && ASCII_WORD_CHAR.test(text[cursor])) {
        while (cursor < text.length && ASCII_WORD_CHAR.test(text[cursor])) {
            cursor++;
        }
        return {name: text.slice(index + 1, cursor), end: cursor};
    }
    return {name: text[cursor] ?? "", end: Math.min(cursor + 1, text.length)};
}

function readBracedName(
    text: string,
    index: number,
): {name: string; end: number} | null {
    let cursor = index;
    while (cursor < text.length && WHITESPACE.test(text[cursor])) {
        cursor++;
    }
    if (text[cursor] !== "{") {
        return null;
    }
    const start = ++cursor;
    while (cursor < text.length && text[cursor] !== "}") {
        cursor++;
    }
    if (cursor >= text.length) {
        return null;
    }
    return {name: text.slice(start, cursor), end: cursor + 1};
}

function skipGroup(text: string, index: number, open: string, close: string) {
    let depth = 0;
    for (let cursor = index; cursor < text.length; cursor++) {
        if (text[cursor] === open) {
            depth++;
        } else if (text[cursor] === close && --depth === 0) {
            return cursor + 1;
        }
    }
    return text.length;
}

function readWord(text: string, index: number): WordToken {
    const start = index;
    while (index < text.length) {
        const current = text[index];
        if (LETTER.test(current)) {
            index++;
            continue;
        }
        if (
            (current === "'" || current === "’")
            && index + 1 < text.length
            && LETTER.test(text[index + 1])
        ) {
            index++;
            continue;
        }
        break;
    }
    return {word: text.slice(start, index), start, end: index};
}

/**
 * Skip words that are part of a URL or email address rather than prose.
 */
function isLinkFragment(text: string, start: number, end: number): boolean {
    const word = text.slice(start, end);
    const before = text.slice(Math.max(0, start - 64), start);
    const after = text.slice(end, end + 16);
    return (
        /(?:https?:\/\/|www\.)[^\s]*$/i.test(before)
        || /@[^\s]*$/.test(before)
        || /^\.?[a-z]{2,}(?:\.[a-z]{2,})*(?:\/|$)/i.test(after)
        || (/^https?$/i.test(word) && after.startsWith("://"))
        || (/^www$/i.test(word) && after.startsWith("."))
    );
}

/**
 * Extract prose words from LaTeX source, including comments, while skipping
 * math and command names so that only text a human would read is spellchecked.
 */
function findWords(text: string): WordToken[] {
    const words: WordToken[] = [];
    let index = 0;
    let inComment = false;
    let dollarMath: 0 | 1 | 2 = 0;
    let delimiterMath: "(" | "[" | null = null;
    let mathEnvironment: string | null = null;
    let mathEnvironmentDepth = 0;

    while (index < text.length) {
        const char = text[index];

        if (char === "\n") {
            inComment = false;
            index++;
            continue;
        }
        if (inComment) {
            if (LETTER.test(char)) {
                const token = readWord(text, index);
                if (!isLinkFragment(text, token.start, token.end)) {
                    words.push(token);
                }
                index = token.end;
                continue;
            }
            index++;
            continue;
        }

        if (mathEnvironment !== null) {
            if (char === "\\") {
                const {name, end} = readCommand(text, index);
                if (name === "begin" || name === "end") {
                    const environment = readBracedName(text, end);
                    if (environment) {
                        if (
                            name === "begin"
                            && environment.name === mathEnvironment
                        ) {
                            mathEnvironmentDepth++;
                        }
                        if (
                            name === "end"
                            && environment.name === mathEnvironment
                        ) {
                            mathEnvironmentDepth--;
                            if (mathEnvironmentDepth === 0) {
                                mathEnvironment = null;
                            }
                        }
                        index = environment.end;
                        continue;
                    }
                }
                index = end;
                continue;
            }
            index++;
            continue;
        }

        if (delimiterMath !== null) {
            if (char === "\\") {
                const {name, end} = readCommand(text, index);
                if (
                    (delimiterMath === "(" && name === ")")
                    || (delimiterMath === "[" && name === "]")
                ) {
                    delimiterMath = null;
                }
                index = end;
                continue;
            }
            index++;
            continue;
        }

        if (dollarMath !== 0) {
            if (char === "\\" && text[index + 1] === "$") {
                index += 2;
                continue;
            }
            if (char === "$") {
                if (dollarMath === 2 && text[index + 1] === "$") {
                    dollarMath = 0;
                    index += 2;
                    continue;
                }
                if (dollarMath === 1) {
                    dollarMath = 0;
                    index++;
                    continue;
                }
            }
            index++;
            continue;
        }

        if (char === "%") {
            inComment = true;
            index++;
            continue;
        }

        if (char === "$") {
            if (text[index + 1] === "$") {
                dollarMath = 2;
                index += 2;
            } else {
                dollarMath = 1;
                index++;
            }
            continue;
        }

        if (char === "\\") {
            const {name, end} = readCommand(text, index);
            if (name === "(" || name === "[") {
                delimiterMath = name;
                index = end;
                continue;
            }
            if (name === "begin") {
                const environment = readBracedName(text, end);
                if (environment) {
                    if (MATH_ENVIRONMENTS.has(environment.name)) {
                        mathEnvironment = environment.name;
                        mathEnvironmentDepth = 1;
                    }
                    index = environment.end;
                    continue;
                }
            }
            if (name === "end") {
                const environment = readBracedName(text, end);
                if (environment) {
                    index = environment.end;
                    continue;
                }
            }
            if (IDENTIFIER_COMMANDS.has(name)) {
                let cursor = end;
                while (text[cursor] === "[") {
                    cursor = skipGroup(text, cursor, "[", "]");
                }
                index =
                    text[cursor] === "{"
                        ? skipGroup(text, cursor, "{", "}")
                        : cursor;
                continue;
            }
            // Escaped characters ("\\%", "\\&", ...) and ordinary command
            // names are not words.
            index = end;
            continue;
        }

        if (LETTER.test(char)) {
            const token = readWord(text, index);
            if (!isLinkFragment(text, token.start, token.end)) {
                words.push(token);
            }
            index = token.end;
            continue;
        }

        index++;
    }

    return words;
}

const correctnessCache = new Map<string, boolean>();

function isCorrect(word: string): boolean {
    const lower = word.toLowerCase();
    if (acceptedWords.has(lower)) {
        return true;
    }
    const cached = correctnessCache.get(word);
    if (cached !== undefined) {
        return cached;
    }
    const correct = getDictionaries().some(dictionary =>
        dictionary.check(word),
    );
    correctnessCache.set(word, correct);
    return correct;
}

function toRange(marker: monaco.editor.IMarkerData): monaco.IRange {
    return {
        startLineNumber: marker.startLineNumber,
        startColumn: marker.startColumn,
        endLineNumber: marker.endLineNumber,
        endColumn: marker.endColumn,
    };
}

function overlaps(
    marker: monaco.editor.IMarkerData,
    range: monaco.IRange,
): boolean {
    return !(
        marker.endLineNumber < range.startLineNumber
        || marker.startLineNumber > range.endLineNumber
        || (marker.endLineNumber === range.startLineNumber
            && marker.endColumn < range.startColumn)
        || (marker.startLineNumber === range.endLineNumber
            && marker.startColumn > range.endColumn)
    );
}

const rescanListeners = new Set<() => void>();
let supportRegistered = false;

function notifyRescan() {
    for (const listener of rescanListeners) {
        listener();
    }
}

/**
 * Register the quick-fix provider and its command once, not per editor.
 */
function ensureSupport() {
    if (supportRegistered) {
        return;
    }
    supportRegistered = true;

    monaco.editor.registerCommand(
        ADD_WORD_COMMAND,
        (_accessor: unknown, word: string) => {
            acceptedWords.add(word.toLowerCase());
            notifyRescan();
        },
    );

    monaco.languages.registerCodeActionProvider(["latex", "plaintext"], {
        provideCodeActions(model, range) {
            // Monaco does not populate markers in the code action context, so
            // read this model's spellcheck markers directly.
            const markers = monaco.editor
                .getModelMarkers({owner: SPELLCHECK_OWNER, resource: model.uri})
                .filter(
                    marker =>
                        marker.source === SPELLCHECK_SOURCE
                        && marker.code === SPELLCHECK_CODE
                        && overlaps(marker, range),
                );
            if (markers.length === 0) {
                return {actions: [], dispose() {}};
            }

            // Monaco re-requests code actions on every marker change and
            // cursor move, so keep this provider cheap. Generating spelling
            // suggestions is intentionally not done here: Hunspell's
            // suggestion search can take seconds on long German words.
            const marker =
                markers.find(
                    candidate =>
                        candidate.startLineNumber === range.startLineNumber
                        && range.startColumn >= candidate.startColumn
                        && range.startColumn <= candidate.endColumn,
                ) ?? markers[0];
            const wordRange = toRange(marker);
            const word = model.getValueInRange(wordRange);
            if (word.length === 0) {
                return {actions: [], dispose() {}};
            }

            const actions: monaco.languages.CodeAction[] = [];
            actions.push({
                title: `Add “${word}” to session dictionary`,
                kind: "quickfix",
                diagnostics: [marker],
                command: {
                    id: ADD_WORD_COMMAND,
                    title: `Add “${word}” to session dictionary`,
                    arguments: [word],
                },
            });
            return {actions, dispose() {}};
        },
    });
}

export interface SpellcheckHandle {
    /**
     * Rescan the current model. Called after a document save.
     */
    rescan(): void;
    dispose(): void;
}

/**
 * Spellcheck the models shown by an editor. Scanning is driven explicitly by
 * the caller (after a document save), never by keystrokes: Hunspell's
 * dictionary checks and marker updates are far too heavy to run during typing.
 */
export function attachSpellcheck(
    editor: monaco.editor.IStandaloneCodeEditor,
): SpellcheckHandle {
    ensureSupport();

    const scan = (model: monaco.editor.ITextModel | null) => {
        if (!model || model.isDisposed()) {
            return;
        }

        const markers: monaco.editor.IMarkerData[] = [];
        for (const {word, start, end} of findWords(model.getValue())) {
            // Single letters and short all-caps tokens are almost always
            // initials, acronyms or math symbols rather than misspellings.
            if (
                word.length < 3
                || (word === word.toUpperCase() && word.length <= 4)
                || isCorrect(word)
            ) {
                continue;
            }

            const startPosition = model.getPositionAt(start);
            const endPosition = model.getPositionAt(end);
            markers.push({
                severity: monaco.MarkerSeverity.Info,
                message: `Possible spelling mistake: ${word}`,
                source: SPELLCHECK_SOURCE,
                code: SPELLCHECK_CODE,
                startLineNumber: startPosition.lineNumber,
                startColumn: startPosition.column,
                endLineNumber: endPosition.lineNumber,
                endColumn: endPosition.column,
            });
        }
        monaco.editor.setModelMarkers(model, SPELLCHECK_OWNER, markers);
    };

    const rescan = () => {
        scan(editor.getModel());
    };
    rescanListeners.add(rescan);

    return {
        rescan,
        dispose() {
            rescanListeners.delete(rescan);
            const model = editor.getModel();
            if (model && !model.isDisposed()) {
                monaco.editor.setModelMarkers(model, SPELLCHECK_OWNER, []);
            }
        },
    };
}
