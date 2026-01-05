mod db;
mod download;
mod playlist;
mod transcode;
mod types;

use std::collections::HashMap;

pub use types::*;
pub use db::{init_db, get_db};
pub use download::DownloadState;
pub use transcode::TranscodeState;

// ==================== Tauri Commands ====================

#[tauri::command]
async fn fetch_and_parse_m3u(url: String) -> Result<ParsedPlaylist, String> {
    playlist::fetch_and_parse_m3u(&url).await
}

#[tauri::command]
async fn download_video(
    app: tauri::AppHandle,
    state: tauri::State<'_, DownloadState>,
    id: String,
    url: String,
    name: String,
    thumbnail: Option<String>,
) -> Result<DownloadedItem, String> {
    download::download_video(&app, &state, id, url, name, thumbnail).await
}

#[tauri::command]
async fn cancel_download(
    state: tauri::State<'_, DownloadState>,
    id: String,
) -> Result<(), String> {
    download::cancel_download(&state, &id).await
}

#[tauri::command]
async fn delete_download(path: String) -> Result<(), String> {
    download::delete_download(&path).await
}

#[tauri::command]
fn get_downloads_path() -> Result<String, String> {
    download::get_downloads_path()
}

#[tauri::command]
async fn start_transcode(
    state: tauri::State<'_, TranscodeState>,
    source_path: String,
) -> Result<String, String> {
    transcode::start_transcode(&state, &source_path).await
}

#[tauri::command]
async fn stop_transcode(
    state: tauri::State<'_, TranscodeState>,
) -> Result<(), String> {
    transcode::stop_transcode(&state).await
}

#[tauri::command]
fn needs_transcoding(url: String) -> bool {
    transcode::needs_transcoding(&url)
}

#[tauri::command]
async fn cache_playlist_data(
    playlist_id: String,
    categories: Vec<CachedCategory>,
    channels: Vec<CachedChannel>,
) -> Result<(), String> {
    db::cache_playlist_data(playlist_id, categories, channels).await
}

#[tauri::command]
async fn get_cached_categories(
    playlist_id: String,
    content_type: String,
) -> Result<Vec<CachedCategory>, String> {
    db::get_cached_categories(playlist_id, content_type).await
}

#[tauri::command]
async fn get_cached_channels(
    playlist_id: String,
    category_id: Option<String>,
    content_type: String,
) -> Result<Vec<CachedChannel>, String> {
    db::get_cached_channels(playlist_id, category_id, content_type).await
}

#[tauri::command]
async fn is_playlist_cached(
    playlist_id: String,
) -> Result<bool, String> {
    db::is_playlist_cached(playlist_id).await
}

#[tauri::command]
async fn clear_playlist_cache(
    playlist_id: String,
) -> Result<(), String> {
    db::clear_playlist_cache(playlist_id).await
}

#[tauri::command]
async fn search_cached_channels(
    playlist_id: String,
    query: String,
    content_type: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<CachedChannel>, String> {
    db::search_cached_channels(
        playlist_id,
        query,
        content_type,
        limit.unwrap_or(50),
    ).await
}

#[tauri::command]
async fn get_content_availability(
    playlist_id: String,
) -> Result<HashMap<String, bool>, String> {
    db::get_content_availability(playlist_id).await
}

#[tauri::command]
async fn save_last_viewed_state(
    playlist_id: String,
    channel_id: Option<String>,
    category_id: Option<String>,
    content_type: String,
) -> Result<(), String> {
    let state = LastViewedState {
        playlist_id,
        channel_id,
        category_id,
        content_type,
    };
    db::save_last_viewed(state).await
}

#[tauri::command]
async fn get_last_viewed_state() -> Result<Option<LastViewedState>, String> {
    db::get_last_viewed().await
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// ==================== App Entry Point ====================

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(DownloadState::default())
        .manage(TranscodeState::default())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .setup(|_app| {
            // Initialize database on startup
            tauri::async_runtime::spawn(async {
                if let Err(e) = init_db().await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_and_parse_m3u,
            // Download commands
            download_video,
            cancel_download,
            delete_download,
            get_downloads_path,
            // Transcode commands
            start_transcode,
            stop_transcode,
            needs_transcoding,
            // Cache commands
            cache_playlist_data,
            get_cached_categories,
            get_cached_channels,
            is_playlist_cached,
            clear_playlist_cache,
            search_cached_channels,
            get_content_availability,
            // State commands
            save_last_viewed_state,
            get_last_viewed_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
