use regex::Regex;
use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::path::PathBuf;
use tokio::process::Command;
use tauri::Emitter;
use tokio::sync::Mutex;
use std::collections::HashMap;
use std::sync::Arc;
use warp::Filter;
use rusqlite::{Connection, params};
use std::sync::Mutex as StdMutex;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlaylistItem {
    pub id: String,
    pub name: String,
    pub url: String,
    pub tvg_id: Option<String>,
    pub tvg_logo: Option<String>,
    pub group_title: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ParsedPlaylist {
    pub items: Vec<PlaylistItem>,
    pub categories: Vec<String>,
}

fn parse_m3u_content(content: &str) -> ParsedPlaylist {
    let mut items: Vec<PlaylistItem> = Vec::new();
    let mut categories_set: std::collections::HashSet<String> = std::collections::HashSet::new();
    
    // Regex patterns for parsing EXTINF lines
    let tvg_id_regex = Regex::new(r#"tvg-id="([^"]*)""#).unwrap();
    let tvg_logo_regex = Regex::new(r#"tvg-logo="([^"]*)""#).unwrap();
    let group_title_regex = Regex::new(r#"group-title="([^"]*)""#).unwrap();
    let name_regex = Regex::new(r#",(.+)$"#).unwrap();
    
    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;
    let mut item_index = 0;
    
    while i < lines.len() {
        let line = lines[i].trim();
        
        if line.starts_with("#EXTINF:") {
            // Parse the EXTINF line
            let mut tvg_id: Option<String> = None;
            let mut tvg_logo: Option<String> = None;
            let mut group_title = "Uncategorized".to_string();
            let mut name = format!("Channel {}", item_index + 1);
            
            if let Some(caps) = tvg_id_regex.captures(line) {
                if let Some(m) = caps.get(1) {
                    let val = m.as_str().to_string();
                    if !val.is_empty() {
                        tvg_id = Some(val);
                    }
                }
            }
            
            if let Some(caps) = tvg_logo_regex.captures(line) {
                if let Some(m) = caps.get(1) {
                    let val = m.as_str().to_string();
                    if !val.is_empty() {
                        tvg_logo = Some(val);
                    }
                }
            }
            
            if let Some(caps) = group_title_regex.captures(line) {
                if let Some(m) = caps.get(1) {
                    let val = m.as_str().to_string();
                    if !val.is_empty() {
                        group_title = val;
                    }
                }
            }
            
            if let Some(caps) = name_regex.captures(line) {
                if let Some(m) = caps.get(1) {
                    name = m.as_str().trim().to_string();
                }
            }
            
            // Next non-empty, non-comment line should be the URL
            i += 1;
            while i < lines.len() {
                let url_line = lines[i].trim();
                if !url_line.is_empty() && !url_line.starts_with('#') {
                    categories_set.insert(group_title.clone());
                    
                    items.push(PlaylistItem {
                        id: tvg_id.clone().unwrap_or_else(|| format!("item-{}", item_index)),
                        name,
                        url: url_line.to_string(),
                        tvg_id,
                        tvg_logo,
                        group_title,
                    });
                    item_index += 1;
                    break;
                }
                i += 1;
            }
        }
        i += 1;
    }
    
    let mut categories: Vec<String> = categories_set.into_iter().collect();
    categories.sort();
    
    ParsedPlaylist { items, categories }
}

#[tauri::command]
async fn fetch_and_parse_m3u(url: String) -> Result<ParsedPlaylist, String> {
    println!("Rust: Fetching M3U from: {}", url);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let response = client
        .get(&url)
        .header("User-Agent", "WatchTV/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let content = response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;
    
    println!("Rust: Received {} bytes", content.len());
    
    if !content.trim().starts_with("#EXTM3U") {
        return Err("Response does not appear to be a valid M3U file".to_string());
    }
    
    let result = parse_m3u_content(&content);
    println!("Rust: Parsed {} items in {} categories", result.items.len(), result.categories.len());
    
    Ok(result)
}

/// Play video directly using mpv (opens in separate window)
#[tauri::command]
async fn play_with_mpv(url: String, title: String) -> Result<(), String> {
    println!("Playing with mpv: {} - {}", title, url);
    
    // Try to use mpv to play the video
    let result = Command::new("mpv")
        .args([
            "--title", &title,
            "--force-window=immediate",
            "--keep-open=no",
            "--no-terminal",
            &url,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    
    match result {
        Ok(_) => Ok(()),
        Err(e) => {
            // If mpv is not found, try iina on macOS
            let iina_result = Command::new("iina")
                .args(["--no-stdin", &url])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn();
            
            match iina_result {
                Ok(_) => Ok(()),
                Err(_) => {
                    // Try VLC as last resort
                    let vlc_result = Command::new("/Applications/VLC.app/Contents/MacOS/VLC")
                        .args(["--no-video-title-show", &url])
                        .stdin(Stdio::null())
                        .stdout(Stdio::null())
                        .stderr(Stdio::null())
                        .spawn();
                    
                    match vlc_result {
                        Ok(_) => Ok(()),
                        Err(_) => Err(format!(
                            "No compatible video player found. Please install mpv, IINA, or VLC. Error: {}", 
                            e
                        )),
                    }
                }
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub id: String,
    pub progress: f64, // 0.0 to 1.0
    pub status: String, // "downloading", "completed", "error", "cancelled"
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed: Option<u64>, // bytes per second
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadedItem {
    pub id: String,
    pub name: String,
    pub local_path: String,
    pub original_url: String,
    pub thumbnail: Option<String>,
    pub downloaded_at: u64,
    pub size: Option<u64>,
}

// State for tracking active downloads
pub struct DownloadState {
    pub active_downloads: Mutex<HashMap<String, bool>>, // id -> is_cancelled
}

impl Default for DownloadState {
    fn default() -> Self {
        Self {
            active_downloads: Mutex::new(HashMap::new()),
        }
    }
}

// State for FFmpeg transcoding
pub struct TranscodeState {
    pub ffmpeg_process: Arc<Mutex<Option<tokio::process::Child>>>,
    pub server_port: Arc<Mutex<Option<u16>>>,
    pub output_dir: Arc<Mutex<Option<PathBuf>>>,
}

impl Default for TranscodeState {
    fn default() -> Self {
        Self {
            ffmpeg_process: Arc::new(Mutex::new(None)),
            server_port: Arc::new(Mutex::new(None)),
            output_dir: Arc::new(Mutex::new(None)),
        }
    }
}

// Database state for caching playlist data
pub struct DbState {
    pub conn: StdMutex<Connection>,
}

impl DbState {
    pub fn new() -> Result<Self, String> {
        let db_path = get_db_path()?;
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open database: {}", e))?;
        
        // Create tables
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS playlists (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                url TEXT,
                type TEXT NOT NULL,
                username TEXT,
                password TEXT,
                updated_at INTEGER NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT NOT NULL,
                playlist_id TEXT NOT NULL,
                name TEXT NOT NULL,
                content_type TEXT NOT NULL,
                PRIMARY KEY (id, playlist_id, content_type),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            );
            
            CREATE TABLE IF NOT EXISTS channels (
                id TEXT NOT NULL,
                playlist_id TEXT NOT NULL,
                category_id TEXT,
                name TEXT NOT NULL,
                url TEXT NOT NULL,
                logo TEXT,
                group_title TEXT,
                content_type TEXT NOT NULL,
                stream_id TEXT,
                container_extension TEXT,
                PRIMARY KEY (id, playlist_id),
                FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
            );
            
            CREATE INDEX IF NOT EXISTS idx_channels_playlist ON channels(playlist_id);
            CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category_id, playlist_id);
            CREATE INDEX IF NOT EXISTS idx_channels_content_type ON channels(content_type, playlist_id);
            CREATE INDEX IF NOT EXISTS idx_categories_playlist ON categories(playlist_id);
            "
        ).map_err(|e| format!("Failed to create tables: {}", e))?;
        
        Ok(Self {
            conn: StdMutex::new(conn),
        })
    }
}

fn get_db_path() -> Result<PathBuf, String> {
    let app_dir = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("com.watchtv.app");
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;
    Ok(app_dir.join("watchtv.db"))
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CachedCategory {
    pub id: String,
    pub name: String,
    pub content_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CachedChannel {
    pub id: String,
    pub name: String,
    pub url: String,
    pub logo: Option<String>,
    pub group_title: Option<String>,
    pub content_type: String,
    pub category_id: Option<String>,
    pub stream_id: Option<String>,
    pub container_extension: Option<String>,
}

/// Get the downloads directory
fn get_downloads_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let downloads_dir = home.join("Movies").join("WatchTV");
    std::fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("Failed to create downloads directory: {}", e))?;
    Ok(downloads_dir)
}

/// Download a video file
#[tauri::command]
async fn download_video(
    app: tauri::AppHandle,
    state: tauri::State<'_, DownloadState>,
    id: String,
    url: String,
    name: String,
    thumbnail: Option<String>,
) -> Result<DownloadedItem, String> {
    println!("Starting download: {} - {}", name, url);
    
    // Mark as active download
    {
        let mut downloads = state.active_downloads.lock().await;
        downloads.insert(id.clone(), false);
    }
    
    // Create filename from name
    let safe_name: String = name
        .chars()
        .map(|c| if c.is_alphanumeric() || c == ' ' || c == '-' || c == '_' { c } else { '_' })
        .collect();
    
    // Get file extension from URL
    let extension = url
        .split('.')
        .last()
        .and_then(|ext| ext.split('?').next())
        .unwrap_or("mp4");
    
    let downloads_dir = get_downloads_dir()?;
    let file_path = downloads_dir.join(format!("{}.{}", safe_name, extension));
    let file_path_str = file_path.to_string_lossy().to_string();
    
    // Create HTTP client
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(3600)) // 1 hour timeout for large files
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    // Start download
    let response = client
        .get(&url)
        .header("User-Agent", "WatchTV/1.0")
        .send()
        .await
        .map_err(|e| format!("Failed to start download: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let total_size = response.content_length();
    
    // Create file
    let mut file = tokio::fs::File::create(&file_path)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    use tokio::io::AsyncWriteExt;
    
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    
    let start_time = std::time::Instant::now();
    let mut last_emit_time = start_time;
    
    while let Some(chunk_result) = stream.next().await {
        // Check if cancelled
        let is_cancelled = {
            let downloads = state.active_downloads.lock().await;
            downloads.get(&id).copied().unwrap_or(false)
        };
        
        if is_cancelled {
            drop(file);
            let _ = tokio::fs::remove_file(&file_path).await;
            return Err("Download cancelled".to_string());
        }
        
        let chunk = chunk_result.map_err(|e| format!("Download error: {}", e))?;
        file.write_all(&chunk).await.map_err(|e| format!("Write error: {}", e))?;
        downloaded += chunk.len() as u64;
        
        // Emit progress every 500ms
        let now = std::time::Instant::now();
        if now.duration_since(last_emit_time).as_millis() >= 500 {
            let elapsed = now.duration_since(start_time).as_secs_f64();
            let speed = if elapsed > 0.0 { (downloaded as f64 / elapsed) as u64 } else { 0 };
            
            let progress = DownloadProgress {
                id: id.clone(),
                progress: total_size.map(|t| downloaded as f64 / t as f64).unwrap_or(0.0),
                status: "downloading".to_string(),
                downloaded_bytes: downloaded,
                total_bytes: total_size,
                speed: Some(speed),
            };
            
            let _ = app.emit("download-progress", &progress);
            last_emit_time = now;
        }
    }
    
    file.flush().await.map_err(|e| format!("Flush error: {}", e))?;
    
    // Remove from active downloads
    {
        let mut downloads = state.active_downloads.lock().await;
        downloads.remove(&id);
    }
    
    // Emit completion
    let final_progress = DownloadProgress {
        id: id.clone(),
        progress: 1.0,
        status: "completed".to_string(),
        downloaded_bytes: downloaded,
        total_bytes: Some(downloaded),
        speed: None,
    };
    let _ = app.emit("download-progress", &final_progress);
    
    println!("Download completed: {}", file_path_str);
    
    Ok(DownloadedItem {
        id,
        name,
        local_path: file_path_str,
        original_url: url,
        thumbnail,
        downloaded_at: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs(),
        size: Some(downloaded),
    })
}

/// Cancel a download
#[tauri::command]
async fn cancel_download(
    state: tauri::State<'_, DownloadState>,
    id: String,
) -> Result<(), String> {
    let mut downloads = state.active_downloads.lock().await;
    if let Some(cancelled) = downloads.get_mut(&id) {
        *cancelled = true;
    }
    Ok(())
}

/// Delete a downloaded file
#[tauri::command]
async fn delete_download(path: String) -> Result<(), String> {
    tokio::fs::remove_file(&path)
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}

/// Get downloads directory path
#[tauri::command]
fn get_downloads_path() -> Result<String, String> {
    let dir = get_downloads_dir()?;
    Ok(dir.to_string_lossy().to_string())
}

/// Start transcoding a video file to HLS format
#[tauri::command]
async fn start_transcode(
    state: tauri::State<'_, TranscodeState>,
    source_path: String,
) -> Result<String, String> {
    println!("Starting transcode for: {}", source_path);
    
    // Stop any existing transcode
    stop_transcode_internal(&state).await;
    
    // Create temp directory for HLS output
    let temp_dir = std::env::temp_dir().join("watchtv_transcode");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;
    
    let output_path = temp_dir.join("stream.m3u8");
    let segment_pattern = temp_dir.join("segment%03d.ts");
    
    // Find an available port
    let port = find_available_port().await?;
    
    // Start FFmpeg process
    let ffmpeg = Command::new("ffmpeg")
        .args([
            "-i", &source_path,
            "-c:v", "libx264",
            "-preset", "ultrafast",
            "-tune", "zerolatency",
            "-c:a", "aac",
            "-b:a", "128k",
            "-f", "hls",
            "-hls_time", "4",
            "-hls_list_size", "0",
            "-hls_segment_filename", segment_pattern.to_str().unwrap(),
            "-y",
            output_path.to_str().unwrap(),
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .kill_on_drop(true)
        .spawn()
        .map_err(|e| format!("Failed to start FFmpeg: {}. Make sure FFmpeg is installed.", e))?;
    
    // Store process and directory
    {
        let mut proc = state.ffmpeg_process.lock().await;
        *proc = Some(ffmpeg);
    }
    {
        let mut dir = state.output_dir.lock().await;
        *dir = Some(temp_dir.clone());
    }
    {
        let mut p = state.server_port.lock().await;
        *p = Some(port);
    }
    
    // Start local HTTP server to serve the HLS files
    let serve_dir = temp_dir.clone();
    tokio::spawn(async move {
        let cors = warp::cors()
            .allow_any_origin()
            .allow_methods(vec!["GET", "HEAD", "OPTIONS"])
            .allow_headers(vec!["Content-Type", "Range"]);
        
        let routes = warp::fs::dir(serve_dir)
            .with(cors)
            .with(warp::log("transcode_server"));
        
        println!("Starting transcode server on port {}", port);
        warp::serve(routes).run(([127, 0, 0, 1], port)).await;
    });
    
    // Wait a bit for FFmpeg to start generating segments
    tokio::time::sleep(tokio::time::Duration::from_millis(2000)).await;
    
    // Return the URL to the HLS stream
    let stream_url = format!("http://127.0.0.1:{}/stream.m3u8", port);
    println!("Transcode stream available at: {}", stream_url);
    
    Ok(stream_url)
}

/// Stop the current transcode process
#[tauri::command]
async fn stop_transcode(
    state: tauri::State<'_, TranscodeState>,
) -> Result<(), String> {
    stop_transcode_internal(&state).await;
    Ok(())
}

async fn stop_transcode_internal(state: &TranscodeState) {
    // Kill FFmpeg process
    {
        let mut proc = state.ffmpeg_process.lock().await;
        if let Some(mut process) = proc.take() {
            let _ = process.kill().await;
        }
    }
    
    // Clean up temp files
    {
        let mut dir = state.output_dir.lock().await;
        if let Some(path) = dir.take() {
            let _ = std::fs::remove_dir_all(path);
        }
    }
    
    // Clear port
    {
        let mut p = state.server_port.lock().await;
        *p = None;
    }
}

async fn find_available_port() -> Result<u16, String> {
    use std::net::TcpListener;
    
    // Try to find an available port starting from 9000
    for port in 9000..9100 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    
    Err("Could not find an available port".to_string())
}

/// Save parsed playlist data to cache
#[tauri::command]
fn cache_playlist_data(
    db: tauri::State<'_, DbState>,
    playlist_id: String,
    categories: Vec<CachedCategory>,
    channels: Vec<CachedChannel>,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    // Start transaction
    conn.execute("BEGIN TRANSACTION", [])
        .map_err(|e| format!("Failed to begin transaction: {}", e))?;
    
    // Clear existing data for this playlist
    conn.execute("DELETE FROM channels WHERE playlist_id = ?", [&playlist_id])
        .map_err(|e| format!("Failed to clear channels: {}", e))?;
    conn.execute("DELETE FROM categories WHERE playlist_id = ?", [&playlist_id])
        .map_err(|e| format!("Failed to clear categories: {}", e))?;
    
    // Insert categories
    for cat in &categories {
        conn.execute(
            "INSERT OR REPLACE INTO categories (id, playlist_id, name, content_type) VALUES (?, ?, ?, ?)",
            params![cat.id, playlist_id, cat.name, cat.content_type],
        ).map_err(|e| format!("Failed to insert category: {}", e))?;
    }
    
    // Insert channels
    for ch in &channels {
        conn.execute(
            "INSERT OR REPLACE INTO channels (id, playlist_id, category_id, name, url, logo, group_title, content_type, stream_id, container_extension) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            params![ch.id, playlist_id, ch.category_id, ch.name, ch.url, ch.logo, ch.group_title, ch.content_type, ch.stream_id, ch.container_extension],
        ).map_err(|e| format!("Failed to insert channel: {}", e))?;
    }
    
    // Commit transaction
    conn.execute("COMMIT", [])
        .map_err(|e| format!("Failed to commit transaction: {}", e))?;
    
    println!("Cached {} categories and {} channels for playlist {}", categories.len(), channels.len(), playlist_id);
    
    Ok(())
}

/// Get cached categories for a playlist
#[tauri::command]
fn get_cached_categories(
    db: tauri::State<'_, DbState>,
    playlist_id: String,
    content_type: String,
) -> Result<Vec<CachedCategory>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    let mut stmt = conn.prepare(
        "SELECT id, name, content_type FROM categories WHERE playlist_id = ? AND content_type = ? ORDER BY name"
    ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
    
    let categories = stmt.query_map(params![playlist_id, content_type], |row| {
        Ok(CachedCategory {
            id: row.get(0)?,
            name: row.get(1)?,
            content_type: row.get(2)?,
        })
    }).map_err(|e| format!("Failed to query categories: {}", e))?
    .filter_map(|r| r.ok())
    .collect();
    
    Ok(categories)
}

/// Get cached channels for a category
#[tauri::command]
fn get_cached_channels(
    db: tauri::State<'_, DbState>,
    playlist_id: String,
    category_id: Option<String>,
    content_type: String,
) -> Result<Vec<CachedChannel>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    let channels: Vec<CachedChannel> = if let Some(cat_id) = category_id {
        let mut stmt = conn.prepare(
            "SELECT id, name, url, logo, group_title, content_type, category_id, stream_id, container_extension FROM channels WHERE playlist_id = ? AND category_id = ? AND content_type = ? ORDER BY name"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let rows = stmt.query_map(params![playlist_id, cat_id, content_type], |row| {
            Ok(CachedChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                logo: row.get(3)?,
                group_title: row.get(4)?,
                content_type: row.get(5)?,
                category_id: row.get(6)?,
                stream_id: row.get(7)?,
                container_extension: row.get(8)?,
            })
        }).map_err(|e| format!("Failed to query channels: {}", e))?;
        
        rows.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, name, url, logo, group_title, content_type, category_id, stream_id, container_extension FROM channels WHERE playlist_id = ? AND content_type = ? ORDER BY name"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let rows = stmt.query_map(params![playlist_id, content_type], |row| {
            Ok(CachedChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                logo: row.get(3)?,
                group_title: row.get(4)?,
                content_type: row.get(5)?,
                category_id: row.get(6)?,
                stream_id: row.get(7)?,
                container_extension: row.get(8)?,
            })
        }).map_err(|e| format!("Failed to query channels: {}", e))?;
        
        rows.filter_map(|r| r.ok()).collect()
    };
    
    Ok(channels)
}

/// Check if playlist data is cached
#[tauri::command]
fn is_playlist_cached(
    db: tauri::State<'_, DbState>,
    playlist_id: String,
) -> Result<bool, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM channels WHERE playlist_id = ?",
        [&playlist_id],
        |row| row.get(0),
    ).map_err(|e| format!("Failed to check cache: {}", e))?;
    
    Ok(count > 0)
}

/// Clear playlist cache
#[tauri::command]
fn clear_playlist_cache(
    db: tauri::State<'_, DbState>,
    playlist_id: String,
) -> Result<(), String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    conn.execute("DELETE FROM channels WHERE playlist_id = ?", [&playlist_id])
        .map_err(|e| format!("Failed to clear channels: {}", e))?;
    conn.execute("DELETE FROM categories WHERE playlist_id = ?", [&playlist_id])
        .map_err(|e| format!("Failed to clear categories: {}", e))?;
    
    Ok(())
}

/// Search channels across a playlist
#[tauri::command]
fn search_cached_channels(
    db: tauri::State<'_, DbState>,
    playlist_id: String,
    query: String,
    content_type: Option<String>,
    limit: Option<i32>,
) -> Result<Vec<CachedChannel>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    let search_query = format!("%{}%", query.to_lowercase());
    let limit_val = limit.unwrap_or(50);
    
    let channels: Vec<CachedChannel> = if let Some(ct) = content_type {
        let mut stmt = conn.prepare(
            "SELECT id, name, url, logo, group_title, content_type, category_id, stream_id, container_extension 
             FROM channels 
             WHERE playlist_id = ? AND content_type = ? AND LOWER(name) LIKE ? 
             ORDER BY name LIMIT ?"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let rows = stmt.query_map(params![playlist_id, ct, search_query, limit_val], |row| {
            Ok(CachedChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                logo: row.get(3)?,
                group_title: row.get(4)?,
                content_type: row.get(5)?,
                category_id: row.get(6)?,
                stream_id: row.get(7)?,
                container_extension: row.get(8)?,
            })
        }).map_err(|e| format!("Failed to query channels: {}", e))?;
        
        rows.filter_map(|r| r.ok()).collect()
    } else {
        let mut stmt = conn.prepare(
            "SELECT id, name, url, logo, group_title, content_type, category_id, stream_id, container_extension 
             FROM channels 
             WHERE playlist_id = ? AND LOWER(name) LIKE ? 
             ORDER BY name LIMIT ?"
        ).map_err(|e| format!("Failed to prepare statement: {}", e))?;
        
        let rows = stmt.query_map(params![playlist_id, search_query, limit_val], |row| {
            Ok(CachedChannel {
                id: row.get(0)?,
                name: row.get(1)?,
                url: row.get(2)?,
                logo: row.get(3)?,
                group_title: row.get(4)?,
                content_type: row.get(5)?,
                category_id: row.get(6)?,
                stream_id: row.get(7)?,
                container_extension: row.get(8)?,
            })
        }).map_err(|e| format!("Failed to query channels: {}", e))?;
        
        rows.filter_map(|r| r.ok()).collect()
    };
    
    Ok(channels)
}

/// Get content type availability for a playlist
#[tauri::command]
fn get_content_availability(
    db: tauri::State<'_, DbState>,
    playlist_id: String,
) -> Result<HashMap<String, bool>, String> {
    let conn = db.conn.lock().map_err(|e| e.to_string())?;
    
    let mut result = HashMap::new();
    
    for content_type in &["live", "movie", "series"] {
        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM channels WHERE playlist_id = ? AND content_type = ?",
            params![playlist_id, content_type],
            |row| row.get(0),
        ).map_err(|e| format!("Failed to check content type: {}", e))?;
        
        result.insert(content_type.to_string(), count > 0);
    }
    
    Ok(result)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db_state = DbState::new().expect("Failed to initialize database");
    
    tauri::Builder::default()
        .manage(DownloadState::default())
        .manage(TranscodeState::default())
        .manage(db_state)
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            fetch_and_parse_m3u,
            play_with_mpv,
            download_video,
            cancel_download,
            delete_download,
            get_downloads_path,
            start_transcode,
            stop_transcode,
            cache_playlist_data,
            get_cached_categories,
            get_cached_channels,
            is_playlist_cached,
            clear_playlist_cache,
            search_cached_channels,
            get_content_availability
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
