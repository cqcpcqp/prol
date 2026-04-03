use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// IDE全局配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeConfig {
    /// 默认LLM提供商
    pub default_provider: crate::llm::Provider,
    /// OpenAI配置
    pub openai: Option<ProviderConfig>,
    /// Anthropic配置
    pub anthropic: Option<ProviderConfig>,
    /// 本地模型配置
    pub local: Option<LocalConfig>,
    /// UI配置
    pub ui: UiConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub api_key: String,
    pub base_url: Option<String>,
    pub default_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalConfig {
    pub base_url: String,
    pub default_model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiConfig {
    pub theme: String,
    pub font_size: u32,
    pub show_line_numbers: bool,
}

impl Default for IdeConfig {
    fn default() -> Self {
        Self {
            default_provider: crate::llm::Provider::OpenAI,
            openai: None,
            anthropic: None,
            local: Some(LocalConfig {
                base_url: "http://localhost:11434".to_string(),
                default_model: "llama3".to_string(),
            }),
            ui: UiConfig {
                theme: "dark".to_string(),
                font_size: 14,
                show_line_numbers: true,
            },
        }
    }
}

impl IdeConfig {
    /// 获取配置文件路径
    pub fn config_path() -> anyhow::Result<PathBuf> {
        let config_dir = dirs::config_dir()
            .ok_or_else(|| anyhow::anyhow!("Cannot find config directory"))?
            .join("ai-ide");
        std::fs::create_dir_all(&config_dir)?;
        Ok(config_dir.join("config.toml"))
    }

    /// 加载配置
    pub fn load() -> anyhow::Result<Self> {
        let path = Self::config_path()?;
        if !path.exists() {
            let config = Self::default();
            config.save()?;
            return Ok(config);
        }

        let content = std::fs::read_to_string(&path)?;
        let config: Self = toml::from_str(&content)?;
        Ok(config)
    }

    /// 保存配置
    pub fn save(&self) -> anyhow::Result<()> {
        let path = Self::config_path()?;
        let content = toml::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    /// 获取API密钥
    pub fn get_api_key(&self, provider: &crate::llm::Provider) -> Option<String> {
        match provider {
            crate::llm::Provider::OpenAI => self.openai.as_ref().map(|c| c.api_key.clone()),
            crate::llm::Provider::Anthropic => self.anthropic.as_ref().map(|c| c.api_key.clone()),
            crate::llm::Provider::Local => Some("".to_string()), // 本地模型不需要API密钥
        }
    }

    /// 设置API密钥
    pub fn set_api_key(&mut self, provider: crate::llm::Provider, api_key: String) {
        let config = ProviderConfig {
            api_key,
            base_url: None,
            default_model: provider.default_model().to_string(),
        };

        match provider {
            crate::llm::Provider::OpenAI => self.openai = Some(config),
            crate::llm::Provider::Anthropic => self.anthropic = Some(config),
            crate::llm::Provider::Local => {}
        }
    }
}

/// 获取AI IDE根目录
pub fn get_ai_ide_dir() -> anyhow::Result<PathBuf> {
    let home = dirs::home_dir()
        .ok_or_else(|| anyhow::anyhow!("Cannot find home directory"))?;
    let ai_ide_dir = home.join(".ai-ide");
    std::fs::create_dir_all(&ai_ide_dir)?;
    Ok(ai_ide_dir)
}
