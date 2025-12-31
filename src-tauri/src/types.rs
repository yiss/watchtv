use serde::{Deserialize, Serialize};

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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DownloadProgress {
    pub id: String,
    pub progress: f64,
    pub status: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub speed: Option<u64>,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LastViewedState {
    pub playlist_id: String,
    pub channel_id: Option<String>,
    pub category_id: Option<String>,
    pub content_type: String,
}
