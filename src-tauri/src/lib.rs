#[cfg(test)]
mod app_icon;

#[tauri::command]
async fn convert_document_to_markdown(path: String) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || anydoc::to_markdown(path))
        .await
        .map_err(|error| format!("document conversion task failed: {error}"))?
        .map_err(|error| error.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![convert_document_to_markdown])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
