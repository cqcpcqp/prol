use tauri::command;
use serde::{Deserialize, Serialize};

/// 范式信息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParadigmInfo {
    pub id: String,
    pub name: String,
    pub description: String,
}

/// 获取所有可用范式
#[command]
pub fn get_paradigms() -> Vec<ParadigmInfo> {
    vec![
        ParadigmInfo {
            id: "vibe".to_string(),
            name: "💭 Vibe".to_string(),
            description: "自然语言描述，AI理解意图".to_string(),
        },
        ParadigmInfo {
            id: "spec".to_string(),
            name: "📋 Spec".to_string(),
            description: "详细规格说明，精确实现".to_string(),
        },
        ParadigmInfo {
            id: "harness".to_string(),
            name: "🧪 Harness".to_string(),
            description: "测试约束驱动，验证优先".to_string(),
        },
    ]
}

/// 获取当前范式
#[command]
pub fn get_current_paradigm() -> Result<String, String> {
    // 从配置中读取
    let _config = crate::config::IdeConfig::load()
        .map_err(|e| e.to_string())?;

    // TODO: 将范式存储在配置中
    Ok("vibe".to_string())
}

/// 设置当前范式
#[command]
pub fn set_paradigm(paradigm_id: String) -> Result<(), String> {
    // 验证范式ID
    match paradigm_id.as_str() {
        "vibe" | "spec" | "harness" => {
            // TODO: 保存到配置
            log::info!("Paradigm changed to: {}", paradigm_id);
            Ok(())
        }
        _ => Err(format!("Unknown paradigm: {}", paradigm_id)),
    }
}

/// 获取范式描述
#[command]
pub fn get_paradigm_description(paradigm_id: String) -> Result<String, String> {
    match paradigm_id.as_str() {
        "vibe" => Ok(crate::paradigm::PromptTemplate::system_prompt(
            &crate::paradigm::Paradigm::Vibe
        )),
        "spec" => Ok(crate::paradigm::PromptTemplate::system_prompt(
            &crate::paradigm::Paradigm::Spec
        )),
        "harness" => Ok(crate::paradigm::PromptTemplate::system_prompt(
            &crate::paradigm::Paradigm::Harness
        )),
        _ => Err(format!("Unknown paradigm: {}", paradigm_id)),
    }
}