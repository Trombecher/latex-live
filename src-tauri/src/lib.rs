#![forbid(unsafe_code)]
#![deny(clippy::pedantic)]

mod compile;
mod export;
mod format;
mod git;
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

    if !workspace::is_latex_file(&file) {
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

/// Run the Tauri application.
///
/// # Panics
///
/// Panics if the Tauri application fails to start.
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
            workspace::create_workspace_file,
            workspace::create_workspace_folder,
            workspace::rename_workspace_file,
            workspace::trash_workspace_entry,
            git::git_status,
            git::git_init,
            git::git_set_origin,
            git::git_commit_push,
            git::git_fetch_pull,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
