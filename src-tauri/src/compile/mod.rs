//! LaTeX compilation via Tectonic.
//!
//! This mirrors `tectonic::latex_to_pdf`, but keeps a status backend around so
//! that TeX diagnostics can be returned to the frontend when compilation fails.

use std::{
    fmt::{Arguments, Write},
    path::Path,
};

use serde::Serialize;
use tectonic::{
    FORMAT_SERIAL,
    config::PersistentConfig,
    driver::{OutputFormat, ProcessingSessionBuilder},
    errors::Error,
    status::{MessageKind, StatusBackend},
};

/// How much diagnostic output we are willing to send over IPC.
const MAX_DIAGNOSTICS_LEN: usize = 64 * 1024;

/// Severity of a structured compilation diagnostic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    /// A condition that prevented the document from compiling.
    Error,
    /// A condition that did not prevent compilation but deserves attention.
    Warning,
}

/// A single source location extracted from the TeX log.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct Diagnostic {
    /// Workspace-relative path of the file the diagnostic belongs to.
    pub file: String,
    /// One-based line number.
    pub line: u32,
    /// The human-readable error message.
    pub message: String,
    /// Whether TeX reported this as an error or a warning.
    pub severity: Severity,
}

/// A failed compilation, sent to the frontend as the command error.
#[derive(Debug, Serialize)]
pub struct CompileFailure {
    /// The full flattened log, rendered in the error panel.
    pub message: String,
    /// Parsed source locations, rendered as editor markers.
    pub diagnostics: Vec<Diagnostic>,
}

impl CompileFailure {
    /// Create a failure without source locations, for errors that happen
    /// outside the TeX engine (for example, invalid workspace paths).
    #[must_use]
    pub fn new(message: impl Into<String>) -> Self {
        Self {
            message: message.into(),
            diagnostics: Vec::new(),
        }
    }
}

/// A status message that may contain a `file:line: message` prefix.
struct RawDiagnostic {
    kind: MessageKind,
    text: String,
}

#[derive(Default)]
struct CaptureStatus {
    messages: String,
    diagnostics: Vec<RawDiagnostic>,
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

    /// Extract the structured diagnostics from the captured status messages.
    fn structured_diagnostics(
        &self,
        filesystem_root: &Path,
        primary_name: &str,
        primary_path: &str,
    ) -> Vec<Diagnostic> {
        let mut diagnostics: Vec<Diagnostic> = Vec::new();

        for raw in &self.diagnostics {
            let Some((file, line, message)) = parse_location(&raw.text) else {
                continue;
            };

            if message.is_empty() {
                continue;
            }

            let diagnostic = Diagnostic {
                file: normalize_file(file, filesystem_root, primary_name, primary_path),
                line,
                message: message.to_owned(),
                severity: match raw.kind {
                    MessageKind::Warning => Severity::Warning,
                    MessageKind::Note | MessageKind::Error => Severity::Error,
                },
            };

            if !diagnostics.contains(&diagnostic) {
                diagnostics.push(diagnostic);
            }
        }

        diagnostics
    }
}

impl StatusBackend for CaptureStatus {
    fn report(&mut self, kind: MessageKind, args: Arguments<'_>, err: Option<&Error>) {
        let label = match kind {
            MessageKind::Note => "note",
            MessageKind::Warning => "warning",
            MessageKind::Error => "error",
        };

        let text = args.to_string();
        let mut message = String::new();
        let _ = writeln!(message, "{label}: {text}");
        if let Some(err) = err {
            let _ = writeln!(message, "{err:#}");
        }
        self.push(&message);

        if matches!(kind, MessageKind::Warning | MessageKind::Error) {
            self.diagnostics.push(RawDiagnostic { kind, text });
        }
    }

    fn dump_error_logs(&mut self, output: &[u8]) {
        self.push(&String::from_utf8_lossy(output));
    }
}

/// Parse a leading `file:line: message` sequence, as produced by `XeTeX`'s
/// structured diagnostics. The file component may itself contain colons (for
/// example, a Windows drive path), so scan for the `:<digits>: ` separator.
fn parse_location(text: &str) -> Option<(&str, u32, &str)> {
    let first_line = text.lines().next()?.trim_end();

    for (colon, _) in first_line.match_indices(':') {
        let rest = &first_line[colon + 1..];
        let digits = rest.bytes().take_while(u8::is_ascii_digit).count();

        if digits == 0 {
            continue;
        }

        if let Some(message) = rest[digits..].strip_prefix(": ")
            && let Ok(line) = rest[..digits].parse()
        {
            return Some((&first_line[..colon], line, message.trim()));
        }
    }

    None
}

/// Turn the path TeX reported into a workspace-relative path, and map the
/// primary input name (which Tectonic prefixes with no directory) onto the
/// path of the file the user actually compiled.
fn normalize_file(
    reported: &str,
    filesystem_root: &Path,
    primary_name: &str,
    primary_path: &str,
) -> String {
    let reported = reported.trim().replace('\\', "/");

    if reported == primary_name {
        return primary_path.replace('\\', "/");
    }

    let root = filesystem_root.to_string_lossy().replace('\\', "/");
    let root = root.trim_end_matches('/');

    if reported == root {
        return String::new();
    }

    let prefix = format!("{root}/");
    if let Some(relative) = reported.strip_prefix(&prefix) {
        return relative.to_owned();
    }

    reported.strip_prefix("./").unwrap_or(&reported).to_owned()
}

fn with_diagnostics(
    message: impl AsRef<str>,
    status: &CaptureStatus,
    filesystem_root: &Path,
    primary_name: &str,
    primary_path: &str,
) -> CompileFailure {
    let message = message.as_ref().trim();
    let diagnostics = status.messages.trim();

    let message = match (message.is_empty(), diagnostics.is_empty()) {
        (true, true) => "LaTeX compilation failed.".to_owned(),
        (false, true) => message.to_owned(),
        (true, false) => diagnostics.to_owned(),
        (false, false) => format!("{message}\n\n{diagnostics}"),
    };

    CompileFailure {
        message,
        diagnostics: status.structured_diagnostics(filesystem_root, primary_name, primary_path),
    }
}

/// Compile a LaTeX source string into PDF bytes.
///
/// Relative `\input`, `\include`, image, and bibliography paths are resolved
/// from `filesystem_root`. The primary input itself comes from `source`, so
/// unsaved editor contents are compiled without having to write to disk first.
/// `path` is the workspace-relative path of the compiled file; it is used to
/// map TeX diagnostics back to the file open in the editor.
///
/// The first invocation may download the Tectonic resource bundle and build a
/// LaTeX format file. Those artifacts are cached by Tectonic for later runs.
pub fn compile(
    source: &str,
    filesystem_root: &Path,
    file_name: &str,
    path: &str,
) -> Result<Vec<u8>, CompileFailure> {
    let config = PersistentConfig::open(false).map_err(|e| {
        CompileFailure::new(format!("failed to open the Tectonic configuration: {e:#}"))
    })?;

    // Load the bundle directly so that a network/cache failure produces an
    // error instead of the panic inside `PersistentConfig::default_bundle`.
    let bundle = tectonic_bundles::get_fallback_bundle(FORMAT_SERIAL, false).map_err(|e| {
        CompileFailure::new(format!(
            "failed to load the Tectonic resource bundle. The first compile needs \
             network access to download TeX packages:\n{e:#}"
        ))
    })?;

    let format_cache_path = config.format_cache_path().map_err(|e| {
        CompileFailure::new(format!("failed to locate the Tectonic format cache: {e:#}"))
    })?;

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
        with_diagnostics(
            format!("failed to start the LaTeX engine: {e:#}"),
            &status,
            filesystem_root,
            file_name,
            path,
        )
    })?;

    session.run(&mut status).map_err(|e| {
        with_diagnostics(format!("{e:#}"), &status, filesystem_root, file_name, path)
    })?;

    let pdf_name = Path::new(file_name)
        .with_extension("pdf")
        .to_string_lossy()
        .replace('\\', "/");

    let mut files = session.into_file_data();
    files
        .remove(&pdf_name)
        .map(|file| file.data)
        .ok_or_else(|| {
            with_diagnostics(
                "LaTeX finished but produced no PDF.",
                &status,
                filesystem_root,
                file_name,
                path,
            )
        })
}

#[cfg(test)]
mod tests;
