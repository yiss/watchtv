use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use tokio::process::Command;
use tokio::sync::Mutex;
use warp::Filter;

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

async fn find_available_port() -> Result<u16, String> {
    use std::net::TcpListener;
    
    for port in 9000..9100 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Ok(port);
        }
    }
    
    Err("Could not find an available port".to_string())
}

pub async fn stop_transcode_internal(state: &TranscodeState) {
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

pub async fn start_transcode(
    state: &TranscodeState,
    source_path: &str,
) -> Result<String, String> {
    println!("Starting transcode for: {}", source_path);
    
    // Stop any existing transcode
    stop_transcode_internal(state).await;
    
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
            "-i", source_path,
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

pub async fn stop_transcode(state: &TranscodeState) -> Result<(), String> {
    stop_transcode_internal(state).await;
    Ok(())
}

/// Check if a video format needs transcoding
pub fn needs_transcoding(url: &str) -> bool {
    let unsupported_extensions = ["mkv", "avi", "wmv", "mov", "flv", "webm", "m4v"];
    let lower_url = url.to_lowercase();
    
    unsupported_extensions.iter().any(|ext| {
        lower_url.ends_with(ext) || lower_url.contains(&format!(".{}", ext))
    })
}
