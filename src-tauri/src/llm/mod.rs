use serde::{Deserialize, Serialize};
use std::pin::Pin;
use futures::Stream;

/// LLM提供商类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    OpenAI,
    Anthropic,
    #[serde(rename = "local")]
    Local,
}

impl Provider {
    pub fn default_model(&self) -> &'static str {
        match self {
            Provider::OpenAI => "gpt-4",
            Provider::Anthropic => "claude-3-sonnet-20240229",
            Provider::Local => "llama3",
        }
    }

    pub fn default_api_url(&self) -> String {
        match self {
            Provider::OpenAI => "https://api.openai.com/v1".to_string(),
            Provider::Anthropic => "https://api.anthropic.com/v1".to_string(),
            Provider::Local => "http://localhost:11434".to_string(),
        }
    }
}

/// 消息角色
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    System,
    User,
    Assistant,
}

/// 聊天消息
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Message {
    pub role: Role,
    pub content: String,
}

impl Message {
    pub fn system(content: impl Into<String>) -> Self {
        Self {
            role: Role::System,
            content: content.into(),
        }
    }

    pub fn user(content: impl Into<String>) -> Self {
        Self {
            role: Role::User,
            content: content.into(),
        }
    }

    pub fn assistant(content: impl Into<String>) -> Self {
        Self {
            role: Role::Assistant,
            content: content.into(),
        }
    }
}

/// LLM请求配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    pub provider: Provider,
    pub model: String,
    pub messages: Vec<Message>,
    pub temperature: f32,
    pub max_tokens: Option<u32>,
    pub stream: bool,
}

impl ChatRequest {
    pub fn new(provider: Provider, messages: Vec<Message>) -> Self {
        let model = provider.default_model().to_string();
        Self {
            provider,
            model,
            messages,
            temperature: 0.7,
            max_tokens: None,
            stream: true,
        }
    }

    pub fn with_model(mut self, model: impl Into<String>) -> Self {
        self.model = model.into();
        self
    }

    pub fn with_temperature(mut self, temp: f32) -> Self {
        self.temperature = temp;
        self
    }

    pub fn with_max_tokens(mut self, tokens: u32) -> Self {
        self.max_tokens = Some(tokens);
        self
    }
}

/// 流式响应块
#[derive(Debug, Clone)]
pub struct StreamChunk {
    pub content: String,
    pub is_done: bool,
}

/// LLM客户端trait
#[async_trait::async_trait]
pub trait LLMClient: Send + Sync {
    /// 发送聊天请求（非流式）
    async fn chat(&self, request: ChatRequest) -> anyhow::Result<String>;

    /// 发送聊天请求（流式）
    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<StreamChunk>> + Send>>>;
}

/// OpenAI客户端
pub struct OpenAIClient {
    api_key: String,
    base_url: String,
    client: reqwest::Client,
}

impl OpenAIClient {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: "https://api.openai.com/v1".to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self
    }
}

#[async_trait::async_trait]
impl LLMClient for OpenAIClient {
    async fn chat(&self, request: ChatRequest) -> anyhow::Result<String> {
        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages.iter().map(|m| {
                serde_json::json!({
                    "role": match m.role {
                        Role::System => "system",
                        Role::User => "user",
                        Role::Assistant => "assistant",
                    },
                    "content": m.content,
                })
            }).collect::<Vec<_>>(),
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
        });

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let result: serde_json::Value = response.json().await?;
        let content = result["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid response format"))?;

        Ok(content.to_string())
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<StreamChunk>> + Send>>> {
        let body = serde_json::json!({
            "model": request.model,
            "messages": request.messages.iter().map(|m| {
                serde_json::json!({
                    "role": match m.role {
                        Role::System => "system",
                        Role::User => "user",
                        Role::Assistant => "assistant",
                    },
                    "content": m.content,
                })
            }).collect::<Vec<_>>(),
            "temperature": request.temperature,
            "max_tokens": request.max_tokens,
            "stream": true,
        });

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("OpenAI API error: {}", error_text));
        }

        let stream = response.bytes_stream();
        let stream = async_stream::try_stream! {
            use futures::StreamExt;

            let mut stream = stream;
            while let Some(chunk) = stream.next().await {
                let chunk = chunk?;
                let text = String::from_utf8_lossy(&chunk);

                for line in text.lines() {
                    if line.starts_with("data: ") {
                        let data = &line[6..];
                        if data == "[DONE]" {
                            yield StreamChunk {
                                content: String::new(),
                                is_done: true,
                            };
                            return;
                        }

                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                            if let Some(content) = json["choices"][0]["delta"]["content"].as_str() {
                                yield StreamChunk {
                                    content: content.to_string(),
                                    is_done: false,
                                };
                            }
                        }
                    }
                }
            }
        };

        Ok(Box::pin(stream))
    }
}

/// Anthropic客户端
pub struct AnthropicClient {
    api_key: String,
    base_url: String,
    client: reqwest::Client,
}

impl AnthropicClient {
    pub fn new(api_key: impl Into<String>) -> Self {
        Self {
            api_key: api_key.into(),
            base_url: "https://api.anthropic.com/v1".to_string(),
            client: reqwest::Client::new(),
        }
    }

    pub fn with_base_url(mut self, url: impl Into<String>) -> Self {
        self.base_url = url.into();
        self
    }
}

#[async_trait::async_trait]
impl LLMClient for AnthropicClient {
    async fn chat(&self, request: ChatRequest) -> anyhow::Result<String> {
        // 提取system message
        let system_message = request
            .messages
            .iter()
            .find(|m| m.role == Role::System)
            .map(|m| m.content.clone());

        let messages: Vec<_> = request
            .messages
            .into_iter()
            .filter(|m| m.role != Role::System)
            .map(|m| {
                serde_json::json!({
                    "role": match m.role {
                        Role::User => "user",
                        Role::Assistant => "assistant",
                        _ => "user",
                    },
                    "content": m.content,
                })
            })
            .collect();

        let mut body = serde_json::json!({
            "model": request.model,
            "messages": messages,
            "temperature": request.temperature,
            "max_tokens": request.max_tokens.unwrap_or(4096),
        });

        if let Some(system) = system_message {
            body["system"] = serde_json::json!(system);
        }

        let response = self
            .client
            .post(format!("{}/messages", self.base_url))
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(anyhow::anyhow!("Anthropic API error: {}", error_text));
        }

        let result: serde_json::Value = response.json().await?;
        let content = result["content"][0]["text"]
            .as_str()
            .ok_or_else(|| anyhow::anyhow!("Invalid response format"))?;

        Ok(content.to_string())
    }

    async fn chat_stream(
        &self,
        request: ChatRequest,
    ) -> anyhow::Result<Pin<Box<dyn Stream<Item = anyhow::Result<StreamChunk>> + Send>>> {
        // 类似OpenAI的实现，使用Anthropic的streaming格式
        // 为简化，先返回非流式
        let content = self.chat(request).await?;
        let chunk = StreamChunk {
            content,
            is_done: true,
        };

        let stream = async_stream::try_stream! {
            yield chunk;
        };

        Ok(Box::pin(stream))
    }
}

/// LLM客户端工厂
pub struct LLMClientFactory;

impl LLMClientFactory {
    pub fn create(provider: Provider, api_key: impl Into<String>) -> Box<dyn LLMClient> {
        match provider {
            Provider::OpenAI => Box::new(OpenAIClient::new(api_key)),
            Provider::Anthropic => Box::new(AnthropicClient::new(api_key)),
            Provider::Local => Box::new(OpenAIClient::new(api_key).with_base_url("http://localhost:11434/v1")),
        }
    }
}
