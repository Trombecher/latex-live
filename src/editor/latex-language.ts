import {registerLatexCompletions} from "./latex/completions";
import {registerLatexLanguageConfiguration} from "./latex/languageConfiguration";
import {registerLatexMonarchTokens} from "./latex/monarchGrammar";

/**
 * Register a Monarch-based LaTeX language with Monaco.
 *
 * Monaco does not ship a LaTeX grammar, so we provide a reasonably complete one
 * here: comments, control sequences, environments, math modes, verbatim blocks,
 * and bracket handling.
 */
export function registerLatexLanguage(): void {
    registerLatexLanguageConfiguration();
    registerLatexMonarchTokens();
    registerLatexCompletions();
}
