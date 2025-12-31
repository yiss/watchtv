use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use surrealdb::engine::local::{Db, RocksDb};
use surrealdb::Surreal;
use tokio::sync::OnceCell;
use serde::{Deserialize, Serialize};

use crate::types::{CachedCategory, CachedChannel, LastViewedState};

static DB: OnceCell<Arc<Surreal<Db>>> = OnceCell::const_new();

fn get_db_path() -> Result<PathBuf, String> {
    let app_dir = dirs::data_dir()
        .ok_or("Could not find data directory")?
        .join("com.watchtv.app")
        .join("surrealdb");
    std::fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app directory: {}", e))?;
    Ok(app_dir)
}

pub async fn init_db() -> Result<Arc<Surreal<Db>>, String> {
    if let Some(db) = DB.get() {
        return Ok(db.clone());
    }
    
    let db_path = get_db_path()?;
    let db = Surreal::new::<RocksDb>(db_path)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    db.use_ns("watchtv")
        .use_db("main")
        .await
        .map_err(|e| format!("Failed to select namespace/database: {}", e))?;
    
    // Define schema
    db.query(
        "
        DEFINE TABLE IF NOT EXISTS category SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS playlist_id ON category TYPE string;
        DEFINE FIELD IF NOT EXISTS name ON category TYPE string;
        DEFINE FIELD IF NOT EXISTS content_type ON category TYPE string;
        DEFINE INDEX IF NOT EXISTS idx_category_playlist ON category FIELDS playlist_id;
        DEFINE INDEX IF NOT EXISTS idx_category_type ON category FIELDS playlist_id, content_type;

        DEFINE TABLE IF NOT EXISTS channel SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS playlist_id ON channel TYPE string;
        DEFINE FIELD IF NOT EXISTS category_id ON channel TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS name ON channel TYPE string;
        DEFINE FIELD IF NOT EXISTS url ON channel TYPE string;
        DEFINE FIELD IF NOT EXISTS logo ON channel TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS group_title ON channel TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS content_type ON channel TYPE string;
        DEFINE FIELD IF NOT EXISTS stream_id ON channel TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS container_extension ON channel TYPE option<string>;
        DEFINE INDEX IF NOT EXISTS idx_channel_playlist ON channel FIELDS playlist_id;
        DEFINE INDEX IF NOT EXISTS idx_channel_category ON channel FIELDS playlist_id, category_id;
        DEFINE INDEX IF NOT EXISTS idx_channel_type ON channel FIELDS playlist_id, content_type;

        DEFINE TABLE IF NOT EXISTS last_viewed SCHEMAFULL;
        DEFINE FIELD IF NOT EXISTS playlist_id ON last_viewed TYPE string;
        DEFINE FIELD IF NOT EXISTS channel_id ON last_viewed TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS category_id ON last_viewed TYPE option<string>;
        DEFINE FIELD IF NOT EXISTS content_type ON last_viewed TYPE string;
        "
    )
    .await
    .map_err(|e| format!("Failed to define schema: {}", e))?;
    
    println!("SurrealDB initialized successfully");
    
    let db = Arc::new(db);
    let _ = DB.set(db.clone());
    Ok(db)
}

pub async fn get_db() -> Result<Arc<Surreal<Db>>, String> {
    match DB.get() {
        Some(db) => Ok(db.clone()),
        None => init_db().await,
    }
}

// Category record for SurrealDB
#[derive(Debug, Serialize, Deserialize, Clone)]
struct CategoryRecord {
    playlist_id: String,
    name: String,
    content_type: String,
}

// Channel record for SurrealDB
#[derive(Debug, Serialize, Deserialize, Clone)]
struct ChannelRecord {
    playlist_id: String,
    category_id: Option<String>,
    name: String,
    url: String,
    logo: Option<String>,
    group_title: Option<String>,
    content_type: String,
    stream_id: Option<String>,
    container_extension: Option<String>,
}

// LastViewed record for SurrealDB
#[derive(Debug, Serialize, Deserialize, Clone)]
struct LastViewedRecord {
    playlist_id: String,
    channel_id: Option<String>,
    category_id: Option<String>,
    content_type: String,
}

pub async fn cache_playlist_data(
    playlist_id: String,
    categories: Vec<CachedCategory>,
    channels: Vec<CachedChannel>,
) -> Result<(), String> {
    let db = get_db().await?;
    
    // Clear existing data for this playlist
    db.query("DELETE FROM category WHERE playlist_id = $playlist_id")
        .bind(("playlist_id", playlist_id.clone()))
        .await
        .map_err(|e| format!("Failed to clear categories: {}", e))?;
    
    db.query("DELETE FROM channel WHERE playlist_id = $playlist_id")
        .bind(("playlist_id", playlist_id.clone()))
        .await
        .map_err(|e| format!("Failed to clear channels: {}", e))?;
    
    // Insert categories
    for cat in categories {
        let record = CategoryRecord {
            playlist_id: playlist_id.clone(),
            name: cat.name,
            content_type: cat.content_type,
        };
        let _: Option<CategoryRecord> = db
            .create(("category", format!("{}_{}", playlist_id, cat.id)))
            .content(record)
            .await
            .map_err(|e| format!("Failed to insert category: {}", e))?;
    }
    
    // Insert channels
    for ch in channels {
        let record = ChannelRecord {
            playlist_id: playlist_id.clone(),
            category_id: ch.category_id,
            name: ch.name,
            url: ch.url,
            logo: ch.logo,
            group_title: ch.group_title,
            content_type: ch.content_type,
            stream_id: ch.stream_id,
            container_extension: ch.container_extension,
        };
        let _: Option<ChannelRecord> = db
            .create(("channel", format!("{}_{}", playlist_id, ch.id)))
            .content(record)
            .await
            .map_err(|e| format!("Failed to insert channel: {}", e))?;
    }
    
    println!("Cached data for playlist {}", playlist_id);
    Ok(())
}

pub async fn get_cached_categories(
    playlist_id: String,
    content_type: String,
) -> Result<Vec<CachedCategory>, String> {
    let db = get_db().await?;
    
    let mut result = db
        .query("SELECT * FROM category WHERE playlist_id = $playlist_id AND content_type = $content_type ORDER BY name")
        .bind(("playlist_id", playlist_id))
        .bind(("content_type", content_type))
        .await
        .map_err(|e| format!("Failed to query categories: {}", e))?;
    
    let records: Vec<CategoryRecord> = result
        .take(0)
        .map_err(|e| format!("Failed to parse categories: {}", e))?;
    
    Ok(records
        .into_iter()
        .enumerate()
        .map(|(i, r)| CachedCategory {
            id: format!("{}", i),
            name: r.name,
            content_type: r.content_type,
        })
        .collect())
}

pub async fn get_cached_channels(
    playlist_id: String,
    category_id: Option<String>,
    content_type: String,
) -> Result<Vec<CachedChannel>, String> {
    let db = get_db().await?;
    
    let records: Vec<ChannelRecord> = if let Some(cat_id) = category_id {
        let mut result = db
            .query("SELECT * FROM channel WHERE playlist_id = $playlist_id AND category_id = $category_id AND content_type = $content_type ORDER BY name")
            .bind(("playlist_id", playlist_id))
            .bind(("category_id", cat_id))
            .bind(("content_type", content_type))
            .await
            .map_err(|e| format!("Failed to query channels: {}", e))?;
        
        result.take(0).map_err(|e| format!("Failed to parse channels: {}", e))?
    } else {
        let mut result = db
            .query("SELECT * FROM channel WHERE playlist_id = $playlist_id AND content_type = $content_type ORDER BY name")
            .bind(("playlist_id", playlist_id))
            .bind(("content_type", content_type))
            .await
            .map_err(|e| format!("Failed to query channels: {}", e))?;
        
        result.take(0).map_err(|e| format!("Failed to parse channels: {}", e))?
    };
    
    Ok(records
        .into_iter()
        .enumerate()
        .map(|(i, r)| CachedChannel {
            id: format!("{}", i),
            name: r.name,
            url: r.url,
            logo: r.logo,
            group_title: r.group_title,
            content_type: r.content_type,
            category_id: r.category_id,
            stream_id: r.stream_id,
            container_extension: r.container_extension,
        })
        .collect())
}

pub async fn is_playlist_cached(playlist_id: String) -> Result<bool, String> {
    let db = get_db().await?;
    
    let mut result = db
        .query("SELECT count() AS count FROM channel WHERE playlist_id = $playlist_id GROUP ALL")
        .bind(("playlist_id", playlist_id))
        .await
        .map_err(|e| format!("Failed to check cache: {}", e))?;
    
    #[derive(Debug, Deserialize)]
    struct CountResult {
        count: i64,
    }
    
    let count: Option<CountResult> = result.take(0).ok().and_then(|v: Vec<CountResult>| v.into_iter().next());
    Ok(count.map(|c| c.count > 0).unwrap_or(false))
}

pub async fn clear_playlist_cache(playlist_id: String) -> Result<(), String> {
    let db = get_db().await?;
    
    db.query("DELETE FROM channel WHERE playlist_id = $playlist_id")
        .bind(("playlist_id", playlist_id.clone()))
        .await
        .map_err(|e| format!("Failed to clear channels: {}", e))?;
    
    db.query("DELETE FROM category WHERE playlist_id = $playlist_id")
        .bind(("playlist_id", playlist_id))
        .await
        .map_err(|e| format!("Failed to clear categories: {}", e))?;
    
    Ok(())
}

pub async fn search_cached_channels(
    playlist_id: String,
    query: String,
    content_type: Option<String>,
    limit: i32,
) -> Result<Vec<CachedChannel>, String> {
    let db = get_db().await?;
    
    let records: Vec<ChannelRecord> = if let Some(ct) = content_type {
        let mut result = db
            .query("SELECT * FROM channel WHERE playlist_id = $playlist_id AND content_type = $content_type AND string::lowercase(name) CONTAINS string::lowercase($query) ORDER BY name LIMIT $limit")
            .bind(("playlist_id", playlist_id))
            .bind(("content_type", ct))
            .bind(("query", query))
            .bind(("limit", limit))
            .await
            .map_err(|e| format!("Failed to search channels: {}", e))?;
        
        result.take(0).map_err(|e| format!("Failed to parse channels: {}", e))?
    } else {
        let mut result = db
            .query("SELECT * FROM channel WHERE playlist_id = $playlist_id AND string::lowercase(name) CONTAINS string::lowercase($query) ORDER BY name LIMIT $limit")
            .bind(("playlist_id", playlist_id))
            .bind(("query", query))
            .bind(("limit", limit))
            .await
            .map_err(|e| format!("Failed to search channels: {}", e))?;
        
        result.take(0).map_err(|e| format!("Failed to parse channels: {}", e))?
    };
    
    Ok(records
        .into_iter()
        .enumerate()
        .map(|(i, r)| CachedChannel {
            id: format!("{}", i),
            name: r.name,
            url: r.url,
            logo: r.logo,
            group_title: r.group_title,
            content_type: r.content_type,
            category_id: r.category_id,
            stream_id: r.stream_id,
            container_extension: r.container_extension,
        })
        .collect())
}

pub async fn get_content_availability(playlist_id: String) -> Result<HashMap<String, bool>, String> {
    let db = get_db().await?;
    
    let mut result_map = HashMap::new();
    
    for content_type in &["live", "movie", "series"] {
        let mut query_result = db
            .query("SELECT count() AS count FROM channel WHERE playlist_id = $playlist_id AND content_type = $content_type GROUP ALL")
            .bind(("playlist_id", playlist_id.clone()))
            .bind(("content_type", *content_type))
            .await
            .map_err(|e| format!("Failed to check content type: {}", e))?;
        
        #[derive(Debug, Deserialize)]
        struct CountResult {
            count: i64,
        }
        
        let count: Option<CountResult> = query_result.take(0).ok().and_then(|v: Vec<CountResult>| v.into_iter().next());
        result_map.insert(content_type.to_string(), count.map(|c| c.count > 0).unwrap_or(false));
    }
    
    Ok(result_map)
}

pub async fn save_last_viewed(state: LastViewedState) -> Result<(), String> {
    let db = get_db().await?;
    
    let record = LastViewedRecord {
        playlist_id: state.playlist_id,
        channel_id: state.channel_id,
        category_id: state.category_id,
        content_type: state.content_type,
    };
    
    // Upsert last viewed state
    let _: Option<LastViewedRecord> = db
        .upsert(("last_viewed", "current"))
        .content(record)
        .await
        .map_err(|e| format!("Failed to save last viewed: {}", e))?;
    
    Ok(())
}

pub async fn get_last_viewed() -> Result<Option<LastViewedState>, String> {
    let db = get_db().await?;
    
    let result: Option<LastViewedRecord> = db
        .select(("last_viewed", "current"))
        .await
        .map_err(|e| format!("Failed to get last viewed: {}", e))?;
    
    Ok(result.map(|r| LastViewedState {
        playlist_id: r.playlist_id,
        channel_id: r.channel_id,
        category_id: r.category_id,
        content_type: r.content_type,
    }))
}
