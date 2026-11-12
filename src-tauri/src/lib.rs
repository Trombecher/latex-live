mod compile;

/// Compile LaTeX source and return the resulting PDF as raw bytes.
///
/// The frontend receives the response as an `ArrayBuffer`, wraps it in a
/// `Blob`, and renders it with pdf.js.
#[tauri::command]
async fn compile_latex(source: String) -> Result<tauri::ipc::Response, String> {
    tauri::async_runtime::spawn_blocking(move || compile::compile(&source))
        .await
        .map_err(|e| format!("LaTeX compilation task failed: {e}"))?
        .map(tauri::ipc::Response::new)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![compile_latex])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
