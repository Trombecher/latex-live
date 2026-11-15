//! LaTeX formatting via [`tex_fmt`].
//!
//! Formatting happens in the backend so that the saved file and the editor
//! always contain the same text. The formatted source is returned to the
//! frontend, which applies it to the open editor model.

use std::path::Path;

use tex_fmt::{args::Args, format::format_file, logging::Log};

/// Number of spaces per indentation level.
///
/// Kept in sync with the editor's `tabSize` so that auto-indent and formatted
/// output agree.
const TAB_SIZE: u8 = 4;

/// Format LaTeX source with tex-fmt's default settings.
///
/// The input's line-ending style is preserved, since tex-fmt emits the
/// platform's native line endings. If tex-fmt panics, the source is returned
/// unformatted so that saving still succeeds.
pub fn format_latex(source: &str) -> String {
    let formatted =
        std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| format_source(source)));

    formatted.unwrap_or_else(|_| source.to_owned())
}

/// Run tex-fmt over `source`.
fn format_source(source: &str) -> String {
    let args = Args {
        tabsize: TAB_SIZE,
        ..Args::default()
    };

    let mut logs = Vec::<Log>::new();
    let file = Path::new("input.tex");
    let formatted = format_file(source, file, &args, &mut logs).replace("\r\n", "\n");

    if source.contains("\r\n") {
        formatted.replace('\n', "\r\n")
    } else {
        formatted
    }
}

#[cfg(test)]
mod tests;
