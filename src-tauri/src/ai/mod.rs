use crate::llm::{ChatRequest, LLMClientFactory, Message, StreamChunk};
use crate::config::IdeConfig;
use crate::paradigm::{self, Paradigm};
use std::pin::Pin;
use futures::Stream;

/// AI编排服务
pub struct AIOrchestrator {
    config: IdeConfig,
    paradigm: Paradigm,
}

impl AIOrchestrator {
    pub fn new() -> anyhow::Result<Self> {
        let config = IdeConfig::load()?;
        Ok(Self {
            config,
            paradigm: Paradigm::default(),
        })
    }

    #[allow(dead_code)]
    pub fn with_paradigm(mut self, paradigm: Paradigm) -> Self {
        self.paradigm = paradigm;
        self
    }

    /// 生成代码（流式）
    pub async fn generate_code_stream(
        &self,
        user_input: &str,
        project_context: ProjectContext,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<StreamChunk>> + Send>>> {
        let api_key = self
            .config
            .get_api_key(&self.config.default_provider)
            .ok_or_else(|| anyhow::anyhow!("API key not configured"))?;

        let client = LLMClientFactory::create(self.config.default_provider.clone(), api_key);

        let messages = paradigm::create_messages(
            &self.paradigm,
            user_input,
            &project_context.to_string(),
            vec![], // TODO: 从历史记录加载
        );

        let request = ChatRequest::new(self.config.default_provider.clone(), messages)
            .with_temperature(0.7);

        client.chat_stream(request).await
    }

    /// 生成代码（非流式）
    pub async fn generate_code(
        &self,
        user_input: &str,
        project_context: ProjectContext,
    ) -> anyhow::Result<String> {
        let api_key = self
            .config
            .get_api_key(&self.config.default_provider)
            .ok_or_else(|| anyhow::anyhow!("API key not configured"))?;

        let client = LLMClientFactory::create(self.config.default_provider.clone(), api_key);

        let messages = paradigm::create_messages(
            &self.paradigm,
            user_input,
            &project_context.to_string(),
            vec![],
        );

        let request = ChatRequest::new(self.config.default_provider.clone(), messages)
            .with_temperature(0.7);

        client.chat(request).await
    }

    /// 解释代码
    pub async fn explain_code(
        &self,
        code: &str,
        file_path: &str,
    ) -> anyhow::Result<String> {
        let api_key = self
            .config
            .get_api_key(&self.config.default_provider)
            .ok_or_else(|| anyhow::anyhow!("API key not configured"))?;

        let client = LLMClientFactory::create(self.config.default_provider.clone(), api_key);

        let messages = vec![
            Message::system(
                "你是一个代码解释专家。用简单易懂的语言解释代码的功能，\
                适合非技术背景的产品经理理解。",
            ),
            Message::user(format!(
                "请解释以下代码的功能（文件：{}）：\n\n```\n{}\n```",
                file_path, code
            )),
        ];

        let request = ChatRequest::new(self.config.default_provider.clone(), messages)
            .with_temperature(0.5);

        client.chat(request).await
    }

    /// 修复代码
    #[allow(dead_code)]
    pub async fn fix_code(
        &self,
        code: &str,
        error_message: &str,
    ) -> anyhow::Result<String> {
        let api_key = self
            .config
            .get_api_key(&self.config.default_provider)
            .ok_or_else(|| anyhow::anyhow!("API key not configured"))?;

        let client = LLMClientFactory::create(self.config.default_provider.clone(), api_key);

        let messages = vec![
            Message::system("你是一个代码修复专家。分析错误并修复代码。"),
            Message::user(format!(
                "以下代码有错误，请修复：\n\n代码：\n```\n{}\n```\n\n错误信息：\n{}\n\n请提供修复后的完整代码。",
                code, error_message
            )),
        ];

        let request = ChatRequest::new(self.config.default_provider.clone(), messages)
            .with_temperature(0.3);

        client.chat(request).await
    }

    /// 获取当前范式
    #[allow(dead_code)]
    pub fn current_paradigm(&self) -> &Paradigm {
        &self.paradigm
    }

    /// 设置范式
    #[allow(dead_code)]
    pub fn set_paradigm(&mut self, paradigm: Paradigm) {
        self.paradigm = paradigm;
    }
}

/// 项目上下文
#[derive(Debug, Clone)]
pub struct ProjectContext {
    pub path: String,
    pub primary_language: Option<String>,
    #[allow(dead_code)]
    pub project_type: Option<String>,
    pub file_structure: Vec<String>,
}

impl ProjectContext {
    pub async fn from_path(project_path: &str) -> anyhow::Result<Self> {
        let (primary_language, project_type) = detect_project_type(project_path).await?;
        let file_structure = get_file_structure(project_path, 20).await?;

        Ok(Self {
            path: project_path.to_string(),
            primary_language,
            project_type,
            file_structure,
        })
    }
}

impl std::fmt::Display for ProjectContext {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        writeln!(f, "项目路径: {}", self.path)?;
        if let Some(lang) = &self.primary_language {
            writeln!(f, "主要语言: {}", lang)?;
        }
        writeln!(f, "\n文件结构:")?;
        for file in self.file_structure.iter().take(20) {
            writeln!(f, "  {}", file)?;
        }
        Ok(())
    }
}

/// 检测项目类型
async fn detect_project_type(
    project_path: &str,
) -> anyhow::Result<(Option<String>, Option<String>)> {
    use std::path::Path;

    let path = Path::new(project_path);
    let mut primary_language = None;
    let mut project_type = None;

    if path.join("Cargo.toml").exists() {
        primary_language = Some("Rust".to_string());
        project_type = Some("Rust Application".to_string());
    } else if path.join("package.json").exists() {
        primary_language = Some("JavaScript/TypeScript".to_string());
        if path.join("src-tauri").exists() {
            project_type = Some("Tauri Application".to_string());
        } else {
            project_type = Some("Node.js Application".to_string());
        }
    } else if path.join("pyproject.toml").exists() || path.join("requirements.txt").exists() {
        primary_language = Some("Python".to_string());
        project_type = Some("Python Application".to_string());
    } else if path.join("go.mod").exists() {
        primary_language = Some("Go".to_string());
        project_type = Some("Go Application".to_string());
    }

    Ok((primary_language, project_type))
}

/// 获取文件结构
async fn get_file_structure(
    project_path: &str,
    limit: usize,
) -> anyhow::Result<Vec<String>> {
    let mut files = Vec::new();
    let path = std::path::PathBuf::from(project_path);

    fn collect_files(dir: &std::path::Path, prefix: &str, files: &mut Vec<String>, limit: usize) {
        if files.len() >= limit {
            return;
        }

        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                if files.len() >= limit {
                    break;
                }

                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with('.') && name != ".ai-ide" {
                    continue;
                }

                let path = entry.path();
                let display_name = format!("{}{}", prefix, name);

                if path.is_dir() {
                    files.push(format!("{}/", display_name));
                    collect_files(&path, &format!("{}  ", prefix), files, limit);
                } else {
                    files.push(display_name);
                }
            }
        }
    }

    collect_files(&path, "", &mut files, limit);
    Ok(files)
}

