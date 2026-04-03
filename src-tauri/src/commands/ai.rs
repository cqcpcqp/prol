use tauri::command;
use tauri::ipc::Channel;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenerateCodeRequest {
    pub user_input: String,
    pub project_path: String,
    pub session_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeExplanationRequest {
    pub code: String,
    pub file_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyRequest {
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamChunk {
    pub content: String,
    pub is_done: bool,
}

/// 生成代码（非流式）
#[command]
pub async fn generate_code(
    request: GenerateCodeRequest,
) -> Result<String, String> {
    let orchestrator = crate::ai::AIOrchestrator::new()
        .map_err(|e| e.to_string())?;

    let context = crate::ai::ProjectContext::from_path(&request.project_path)
        .await
        .map_err(|e| e.to_string())?;

    orchestrator.generate_code(&request.user_input, context)
        .await
        .map_err(|e| e.to_string())
}

/// 生成代码（流式 - 通过Channel实时推送）
#[command]
pub async fn generate_code_stream_channel(
    request: GenerateCodeRequest,
    on_chunk: Channel<StreamChunk>,
) -> Result<(), String> {
    let orchestrator = crate::ai::AIOrchestrator::new()
        .map_err(|e| e.to_string())?;

    let context = crate::ai::ProjectContext::from_path(&request.project_path)
        .await
        .map_err(|e| e.to_string())?;

    let mut stream = orchestrator.generate_code_stream(&request.user_input, context)
        .await
        .map_err(|e| e.to_string())?;

    use futures::StreamExt;

    while let Some(chunk) = stream.next().await {
        match chunk {
            Ok(chunk) => {
                let is_done = chunk.is_done;
                on_chunk
                    .send(StreamChunk {
                        content: chunk.content,
                        is_done,
                    })
                    .map_err(|e| e.to_string())?;

                if is_done {
                    break;
                }
            }
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(())
}

/// 解释代码
#[command]
pub async fn explain_code(
    request: CodeExplanationRequest,
) -> Result<String, String> {
    let orchestrator = crate::ai::AIOrchestrator::new()
        .map_err(|e| e.to_string())?;

    orchestrator.explain_code(&request.code, &request.file_path)
        .await
        .map_err(|e| e.to_string())
}

/// 获取配置
#[command]
pub async fn get_config() -> Result<crate::config::IdeConfig, String> {
    crate::config::IdeConfig::load()
        .map_err(|e| e.to_string())
}

/// 设置API密钥
#[command]
pub async fn set_api_key(request: ApiKeyRequest) -> Result<(), String> {
    let mut config = crate::config::IdeConfig::load()
        .map_err(|e| e.to_string())?;

    let provider = match request.provider.as_str() {
        "openai" => crate::llm::Provider::OpenAI,
        "anthropic" => crate::llm::Provider::Anthropic,
        "local" => crate::llm::Provider::Local,
        _ => return Err(format!("Unknown provider: {}", request.provider)),
    };

    config.set_api_key(provider, request.api_key);

    config.save()
        .map_err(|e| e.to_string())
}
