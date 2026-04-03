use tauri::command;
use std::path::PathBuf;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub is_directory: bool,
    pub children: Option<Vec<FileNode>>,
}

#[command]
pub async fn read_directory(dir_path: String) -> Result<Vec<FileNode>, String> {
    let path = PathBuf::from(&dir_path);
    let mut nodes = Vec::new();

    let mut entries = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| e.to_string())?;

    let mut collected = Vec::new();
    while let Some(entry) = entries.next_entry().await.map_err(|e| e.to_string())? {
        let is_dir = entry.file_type().await.map(|t| t.is_dir()).unwrap_or(false);
        collected.push((entry, is_dir));
    }

    collected.sort_by(|a, b| {
        match (a.1, b.1) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.0.file_name().cmp(&b.0.file_name()),
        }
    });

    for (entry, is_directory) in collected {
        let name = entry.file_name().to_string_lossy().to_string();
        let path = entry.path().to_string_lossy().to_string();

        // 跳过隐藏文件和目录（除了.ai-ide）
        if name.starts_with('.') && name != ".ai-ide" {
            continue;
        }

        let children = if is_directory {
            Some(vec![]) // 前端按需加载
        } else {
            None
        };

        nodes.push(FileNode {
            name,
            path,
            is_directory,
            children,
        });
    }

    Ok(nodes)
}

#[command]
pub async fn read_file(file_path: String) -> Result<String, String> {
    tokio::fs::read_to_string(&file_path)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn write_file(file_path: String, content: String) -> Result<(), String> {
    // 确保父目录存在
    if let Some(parent) = PathBuf::from(&file_path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    tokio::fs::write(&file_path, content)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_directory(dir_path: String) -> Result<(), String> {
    tokio::fs::create_dir_all(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_file(file_path: String) -> Result<(), String> {
    // 确保父目录存在
    if let Some(parent) = PathBuf::from(&file_path).parent() {
        tokio::fs::create_dir_all(parent)
            .await
            .map_err(|e| e.to_string())?;
    }

    // 创建空文件
    tokio::fs::write(&file_path, "")
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_file(file_path: String) -> Result<(), String> {
    tokio::fs::remove_file(&file_path)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn delete_directory(dir_path: String) -> Result<(), String> {
    tokio::fs::remove_dir_all(&dir_path)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    tokio::fs::rename(&old_path, &new_path)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn file_exists(file_path: String) -> Result<bool, String> {
    Ok(PathBuf::from(&file_path).exists())
}