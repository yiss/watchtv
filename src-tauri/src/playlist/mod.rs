use regex::Regex;
use crate::types::{PlaylistItem, ParsedPlaylist};

pub fn parse_m3u_content(content: &str) -> ParsedPlaylist {
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

pub async fn fetch_and_parse_m3u(url: &str) -> Result<ParsedPlaylist, String> {
    println!("Rust: Fetching M3U from: {}", url);
    
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let response = client
        .get(url)
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
