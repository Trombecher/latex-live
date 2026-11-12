mod compile;
mod export;
mod workspace;

use workspace::WorkspaceState;

/// Compile the currently selected LaTeX file and return the PDF as raw bytes.
///
/// The source comes from the frontend so unsaved edits are compiled. The
/// workspace root is used as Tectonic's filesystem root, which lets relative
/// `\input`, image, and bibliography paths resolve.
#[tauri::command]
async fn compile_latex(
    source: String,
    path: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<tauri::ipc::Response, String> {
    let root = state.root()?;
    let file = workspace::resolve_existing(&root, &path)?;

    if !file.is_file() {
        return Err("The selected path is not a file.".to_owned());
    }

    let is_latex = file
        .extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("tex") || extension.eq_ignore_ascii_case("latex")
        });

    if !is_latex {
        return Err("Only .tex files can be compiled.".to_owned());
    }

    let file_name = file
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "The selected file name is not valid UTF-8.".to_owned())?
        .to_owned();

    tauri::async_runtime::spawn_blocking(move || compile::compile(&source, &root, &file_name))
        .await
        .map_err(|error| format!("LaTeX compilation task failed: {error}"))?
        .map(tauri::ipc::Response::new)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(WorkspaceState::default())
        .invoke_handler(tauri::generate_handler![
            compile_latex,
            export::export_pdf,
            workspace::open_workspace,
            workspace::list_workspace_directory,
            workspace::read_workspace_file,
            workspace::write_workspace_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
