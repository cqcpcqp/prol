use tauri::command;
use serde::{Deserialize, Serialize};

/// 会话列表项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionListItem {
    pub id: String,
    pub title: String,
    pub project_path: String,
    pub paradigm: String,
    pub updated_at: String,
    pub message_count: usize,
}

/// 创建新会话
#[command]
pub fn create_session(project_path: String, paradigm: String) -> Result<String, String> {
    let mut session = crate::session::Session::new(&project_path, &paradigm);
    session.add_welcome_message();

    let session_id = session.metadata.id.clone();

    crate::session::SessionManager::save_session(&session)
        .map_err(|e| e.to_string())?;

    Ok(session_id)
}

/// 获取会话列表
#[command]
pub fn get_sessions() -> Result<Vec<SessionListItem>, String> {
    let sessions = crate::session::SessionManager::list_sessions()
        .map_err(|e| e.to_string())?;

    let items: Vec<SessionListItem> = sessions
        .into_iter()
        .map(|s| SessionListItem {
            id: s.id,
            title: s.title,
            project_path: s.project_path,
            paradigm: s.paradigm,
            updated_at: s.updated_at.to_rfc3339(),
            message_count: s.message_count,
        })
        .collect();

    Ok(items)
}

/// 获取项目的会话列表
#[command]
pub fn get_project_sessions(project_path: String) -> Result<Vec<SessionListItem>, String> {
    let sessions = crate::session::SessionManager::list_project_sessions(&project_path)
        .map_err(|e| e.to_string())?;

    let items: Vec<SessionListItem> = sessions
        .into_iter()
        .map(|s| SessionListItem {
            id: s.id,
            title: s.title,
            project_path: s.project_path,
            paradigm: s.paradigm,
            updated_at: s.updated_at.to_rfc3339(),
            message_count: s.message_count,
        })
        .collect();

    Ok(items)
}

/// 加载会话
#[command]
pub fn load_session(session_id: String) -> Result<crate::session::Session, String> {
    crate::session::SessionManager::load_session(&session_id)
        .map_err(|e| e.to_string())
}

/// 保存会话消息
#[command]
pub fn save_session_message(
    session_id: String,
    role: String,
    content: String,
) -> Result<(), String> {
    let mut session = crate::session::SessionManager::load_session(&session_id)
        .map_err(|e| e.to_string())?;

    session.add_message(role, content);

    // 如果是第一条用户消息，生成标题
    if session.metadata.title == "新会话" {
        session.generate_title();
    }

    crate::session::SessionManager::save_session(&session)
        .map_err(|e| e.to_string())?;

    Ok(())
}

/// 删除会话
#[command]
pub fn delete_session(session_id: String) -> Result<(), String> {
    crate::session::SessionManager::delete_session(&session_id)
        .map_err(|e| e.to_string())
}

/// 导出会话为Markdown
#[command]
pub fn export_session(session_id: String) -> Result<String, String> {
    crate::session::SessionManager::export_session_to_markdown(&session_id)
        .map_err(|e| e.to_string())
}

/// 记录代码变更
#[command]
pub fn record_code_change(
    session_id: String,
    file_path: String,
    change_type: String,
    description: String,
) -> Result<(), String> {
    let mut session = crate::session::SessionManager::load_session(&session_id)
        .map_err(|e| e.to_string())?;

    session.record_code_change(file_path, change_type, description);

    crate::session::SessionManager::save_session(&session)
        .map_err(|e| e.to_string())?;

    Ok(())
}
