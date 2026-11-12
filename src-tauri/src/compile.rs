//! LaTeX compilation via Tectonic.
//!
//! This mirrors `tectonic::latex_to_pdf`, but keeps a status backend around so
//! that TeX diagnostics can be returned to the frontend when compilation fails.

use std::{
    fmt::{Arguments, Write},
    path::Path,
};

use tectonic::{
    FORMAT_SERIAL,
    config::PersistentConfig,
    driver::{OutputFormat, ProcessingSessionBuilder},
    errors::Error,
    status::{MessageKind, StatusBackend},
};

/// How much diagnostic output we are willing to send over IPC.
const MAX_DIAGNOSTICS_LEN: usize = 64 * 1024;

#[derive(Default)]
struct CaptureStatus {
    messages: String,
}

impl CaptureStatus {
    fn push(&mut self, text: &str) {
        if self.messages.len() >= MAX_DIAGNOSTICS_LEN {
            return;
        }

        let remaining = MAX_DIAGNOSTICS_LEN - self.messages.len();
        if text.len() <= remaining {
            self.messages.push_str(text);
        } else {
            let mut end = remaining;
            while end > 0 && !text.is_char_boundary(end) {
                end -= 1;
            }
            self.messages.push_str(&text[..end]);
        }
    }
}

impl StatusBackend for CaptureStatus {
    fn report(&mut self, kind: MessageKind, args: Arguments<'_>, err: Option<&Error>) {
        let label = match kind {
            MessageKind::Note => "note",
            MessageKind::Warning => "warning",
            MessageKind::Error => "error",
        };

        let mut message = String::new();
        let _ = writeln!(message, "{label}: {args}");
        if let Some(err) = err {
            let _ = writeln!(message, "{err:#}");
        }
        self.push(&message);
    }

    fn dump_error_logs(&mut self, output: &[u8]) {
        self.push(&String::from_utf8_lossy(output));
    }
}

fn with_diagnostics(message: impl AsRef<str>, status: &CaptureStatus) -> String {
    let message = message.as_ref().trim();
    let diagnostics = status.messages.trim();

    match (message.is_empty(), diagnostics.is_empty()) {
        (true, true) => "LaTeX compilation failed.".to_owned(),
        (false, true) => message.to_owned(),
        (true, false) => diagnostics.to_owned(),
        (false, false) => format!("{message}\n\n{diagnostics}"),
    }
}

/// Compile a LaTeX source string into PDF bytes.
///
/// Relative `\input`, `\include`, image, and bibliography paths are resolved
/// from `filesystem_root`. The primary input itself comes from `source`, so
/// unsaved editor contents are compiled without having to write to disk first.
///
/// The first invocation may download the Tectonic resource bundle and build a
/// LaTeX format file. Those artifacts are cached by Tectonic for later runs.
pub fn compile(source: &str, filesystem_root: &Path, file_name: &str) -> Result<Vec<u8>, String> {
    let config = PersistentConfig::open(false)
        .map_err(|e| format!("failed to open the Tectonic configuration: {e:#}"))?;

    // Load the bundle directly so that a network/cache failure produces an
    // error instead of the panic inside `PersistentConfig::default_bundle`.
    let bundle = tectonic_bundles::get_fallback_bundle(FORMAT_SERIAL, false).map_err(|e| {
        format!(
            "failed to load the Tectonic resource bundle. The first compile needs \
             network access to download TeX packages:\n{e:#}"
        )
    })?;

    let format_cache_path = config
        .format_cache_path()
        .map_err(|e| format!("failed to locate the Tectonic format cache: {e:#}"))?;

    let mut status = CaptureStatus::default();

    let mut builder = ProcessingSessionBuilder::default();
    builder
        .bundle(bundle)
        .primary_input_buffer(source.as_bytes())
        .tex_input_name(file_name)
        .filesystem_root(filesystem_root)
        .format_name("latex")
        .format_cache_path(format_cache_path)
        .output_format(OutputFormat::Pdf)
        .do_not_write_output_files()
        .keep_logs(false)
        .keep_intermediates(false)
        .print_stdout(false);

    let mut session = builder.create(&mut status).map_err(|e| {
        with_diagnostics(format!("failed to start the LaTeX engine: {e:#}"), &status)
    })?;

    session
        .run(&mut status)
        .map_err(|e| with_diagnostics(format!("{e:#}"), &status))?;

    let pdf_name = Path::new(file_name)
        .with_extension("pdf")
        .to_string_lossy()
        .replace('\\', "/");

    let mut files = session.into_file_data();
    files
        .remove(&pdf_name)
        .map(|file| file.data)
        .ok_or_else(|| with_diagnostics("LaTeX finished but produced no PDF.", &status))
}

#[cfg(test)]
mod tests {
    #[test]
    #[ignore = "downloads and caches the Tectonic resource bundle on first run"]
    fn compiles_a_minimal_document() {
        let pdf = super::compile(
            r"\documentclass{article}
\begin{document}
Hello, LaTeX Live!
\end{document}",
            std::path::Path::new("."),
            "main.tex",
        )
        .expect("compilation should succeed");

        assert!(pdf.starts_with(b"%PDF"), "output should be a PDF");
    }
}
