use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

/// 会话消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMessage {
    pub id: String,
    pub role: String, // "user" | "assistant" | "system"
    pub content: String,
    pub timestamp: DateTime<Utc>,
}

impl SessionMessage {
    pub fn new(role: impl Into<String>, content: impl Into<String>) -> Self {
        Self {
            id: Uuid::new_v4().to_string(),
            role: role.into(),
            content: content.into(),
            timestamp: Utc::now(),
        }
    }
}

/// 代码变更记录
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChange {
    pub file_path: String,
    pub change_type: String, // "create" | "modify" | "delete"
    pub description: String,
    pub timestamp: DateTime<Utc>,
}

/// 会话元数据
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    pub id: String,
    pub title: String,
    pub project_path: String,
    pub paradigm: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub message_count: usize,
    pub code_changes: Vec<CodeChange>,
}

/// 完整会话
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Session {
    pub metadata: SessionMetadata,
    pub messages: Vec<SessionMessage>,
}

impl Session {
    /// 创建新会话
    pub fn new(project_path: impl Into<String>, paradigm: impl Into<String>) -> Self {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        Self {
            metadata: SessionMetadata {
                id: id.clone(),
                title: "新会话".to_string(),
                project_path: project_path.into(),
                paradigm: paradigm.into(),
                created_at: now,
                updated_at: now,
                message_count: 0,
                code_changes: vec![],
            },
            messages: vec![],
        }
    }

    /// 添加消息
    pub fn add_message(&mut self, role: impl Into<String>, content: impl Into<String>) {
        let message = SessionMessage::new(role, content);
        self.messages.push(message);
        self.metadata.message_count = self.messages.len();
        self.metadata.updated_at = Utc::now();
    }

    /// 添加系统欢迎消息
    pub fn add_welcome_message(&mut self) {
        self.add_message(
            "assistant",
            "你好！我是你的AI编程助手。描述你想实现的功能，我会帮你编写代码。",
        );
    }

    /// 记录代码变更
    pub fn record_code_change(
        &mut self,
        file_path: impl Into<String>,
        change_type: impl Into<String>,
        description: impl Into<String>,
    ) {
        let change = CodeChange {
            file_path: file_path.into(),
            change_type: change_type.into(),
            description: description.into(),
            timestamp: Utc::now(),
        };
        self.metadata.code_changes.push(change);
        self.metadata.updated_at = Utc::now();
    }

    /// 生成会话标题（基于第一条用户消息）
    pub fn generate_title(&mut self) {
        if let Some(first_user_msg) = self.messages.iter().find(|m| m.role == "user") {
            let content = &first_user_msg.content;
            // 截取前20个字符作为标题
            let title = if content.chars().count() > 20 {
                format!("{}...", &content[..20])
            } else {
                content.clone()
            };
            self.metadata.title = title;
        }
    }
}

/// 会话管理器
pub struct SessionManager;

impl SessionManager {
    /// 获取会话存储目录
    fn get_sessions_dir() -> anyhow::Result<PathBuf> {
        let dir = crate::config::get_ai_ide_dir()?.join("sessions");
        std::fs::create_dir_all(&dir)?;
        Ok(dir)
    }

    /// 保存会话
    pub fn save_session(session: &Session) -> anyhow::Result<()> {
        let dir = Self::get_sessions_dir()?;
        let file_path = dir.join(format!("{}.json", session.metadata.id));

        let json = serde_json::to_string_pretty(session)?;
        std::fs::write(&file_path, json)?;

        log::info!("Session saved: {}", session.metadata.id);
        Ok(())
    }

    /// 加载会话
    pub fn load_session(session_id: &str) -> anyhow::Result<Session> {
        let dir = Self::get_sessions_dir()?;
        let file_path = dir.join(format!("{}.json", session_id));

        let json = std::fs::read_to_string(&file_path)?;
        let session: Session = serde_json::from_str(&json)?;

        Ok(session)
    }

    /// 列出所有会话（按更新时间倒序）
    pub fn list_sessions() -> anyhow::Result<Vec<SessionMetadata>> {
        let dir = Self::get_sessions_dir()?;
        let mut sessions = Vec::new();

        if !dir.exists() {
            return Ok(sessions);
        }

        for entry in std::fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();

            if path.extension().and_then(|e| e.to_str()) == Some("json") {
                if let Ok(json) = std::fs::read_to_string(&path) {
                    if let Ok(session) = serde_json::from_str::<Session>(&json) {
                        sessions.push(session.metadata);
                    }
                }
            }
        }

        // 按更新时间倒序排列
        sessions.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));

        Ok(sessions)
    }

    /// 列出项目的会话
    pub fn list_project_sessions(project_path: &str) -> anyhow::Result<Vec<SessionMetadata>> {
        let all_sessions = Self::list_sessions()?;
        let project_sessions: Vec<_> = all_sessions
            .into_iter()
            .filter(|s| s.project_path == project_path)
            .collect();
        Ok(project_sessions)
    }

    /// 删除会话
    pub fn delete_session(session_id: &str) -> anyhow::Result<()> {
        let dir = Self::get_sessions_dir()?;
        let file_path = dir.join(format!("{}.json", session_id));

        if file_path.exists() {
            std::fs::remove_file(&file_path)?;
            log::info!("Session deleted: {}", session_id);
        }

        Ok(())
    }

    /// 导出会话为Markdown
    pub fn export_session_to_markdown(session_id: &str) -> anyhow::Result<String> {
        let session = Self::load_session(session_id)?;

        let mut markdown = format!("# {}\n\n", session.metadata.title);
        markdown.push_str(&format!("- 项目: `{}`\n", session.metadata.project_path));
        markdown.push_str(&format!("- 范式: {}\n", session.metadata.paradigm));
        markdown.push_str(&format!(
            "- 时间: {}\n",
            session.metadata.created_at.format("%Y-%m-%d %H:%M")
        ));
        markdown.push_str(&format!("- 消息数: {}\n\n", session.metadata.message_count));

        markdown.push_str("## 对话记录\n\n");

        for msg in &session.messages {
            let role_display = match msg.role.as_str() {
                "user" => "👤 用户",
                "assistant" => "🤖 AI",
                "system" => "⚙️ 系统",
                _ => &msg.role,
            };

            markdown.push_str(&format!(
                "### {} ({})\n\n{}",
                role_display,
                msg.timestamp.format("%H:%M:%S"),
                msg.content
            ));
            markdown.push_str("\n\n---\n\n");
        }

        if !session.metadata.code_changes.is_empty() {
            markdown.push_str("\n## 代码变更\n\n");
            for change in &session.metadata.code_changes {
                markdown.push_str(&format!(
                    "- `{}` ({}): {}\n",
                    change.file_path, change.change_type, change.description
                ));
            }
        }

        Ok(markdown)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_session_creation() {
        let session = Session::new("/path/to/project", "vibe");
        assert_eq!(session.metadata.title, "新会话");
        assert_eq!(session.metadata.paradigm, "vibe");
        assert!(session.messages.is_empty());
    }

    #[test]
    fn test_add_message() {
        let mut session = Session::new("/path", "vibe");
        session.add_message("user", "Hello");
        assert_eq!(session.messages.len(), 1);
        assert_eq!(session.metadata.message_count, 1);
    }

    #[test]
    fn test_generate_title() {
        let mut session = Session::new("/path", "vibe");
        session.add_message("user", "帮我写一个爬虫程序");
        session.generate_title();
        assert_eq!(session.metadata.title, "帮我写一个爬虫程序");
    }
}
