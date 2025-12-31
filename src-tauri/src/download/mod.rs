use std::collections::HashMap;
use std::path::PathBuf;
use tokio::sync::Mutex;
use tokio::io::AsyncWriteExt;
use futures_util::StreamExt;
use tauri::Emitter;

use crate::types::{DownloadProgress, DownloadedItem};

pub struct DownloadState {
    pub active_downloads: Mutex<HashMap<String, bool>>,
}

impl Default for DownloadState {
    fn default() -> Self {
        Self {
            active_downloads: Mutex::new(HashMap::new()),
        }
    }
}

fn get_downloads_dir() -> Result<PathBuf, String> {
    let home = dirs::home_dir().ok_or("Could not find home directory")?;
    let downloads_dir = home.join("Movies").join("WatchTV");
    std::fs::create_dir_all(&downloads_dir)
        .map_err(|e| format!("Failed to create downloads directory: {}", e))?;
    Ok(downloads_dir)
}

pub fn get_downloads_path() -> Result<String, String> {
    let dir = get_downloads_dir()?;
    Ok(dir.to_string_lossy().to_string())
}

pub async fn download_video(
    app: &tauri::AppHandle,
    state: &DownloadState,
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
        .timeout(std::time::Duration::from_secs(3600))
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
    
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();
    
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

pub async fn cancel_download(state: &DownloadState, id: &str) -> Result<(), String> {
    let mut downloads = state.active_downloads.lock().await;
    if let Some(cancelled) = downloads.get_mut(id) {
        *cancelled = true;
    }
    Ok(())
}

pub async fn delete_download(path: &str) -> Result<(), String> {
    tokio::fs::remove_file(path)
        .await
        .map_err(|e| format!("Failed to delete file: {}", e))?;
    Ok(())
}
