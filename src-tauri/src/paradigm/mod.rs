use crate::llm::Message;
use serde::{Deserialize, Serialize};

/// 编程范式类型
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Paradigm {
    /// 氛围编程 - 自然语言描述意图
    Vibe,
    /// 规格编程 - 详细规格说明驱动
    Spec,
    /// 约束编程 - 测试/约束驱动
    Harness,
}

impl Paradigm {
    #[allow(dead_code)]
    pub fn as_str(&self) -> &'static str {
        match self {
            Paradigm::Vibe => "vibe",
            Paradigm::Spec => "spec",
            Paradigm::Harness => "harness",
        }
    }

    #[allow(dead_code)]
    pub fn display_name(&self) -> &'static str {
        match self {
            Paradigm::Vibe => "💭 Vibe",
            Paradigm::Spec => "📋 Spec",
            Paradigm::Harness => "🧪 Harness",
        }
    }

    #[allow(dead_code)]
    pub fn description(&self) -> &'static str {
        match self {
            Paradigm::Vibe => "自然语言描述，AI理解意图",
            Paradigm::Spec => "详细规格说明，精确实现",
            Paradigm::Harness => "测试约束驱动，验证优先",
        }
    }
}

impl Default for Paradigm {
    fn default() -> Self {
        Paradigm::Vibe
    }
}

/// 提示词模板引擎
pub struct PromptTemplate;

impl PromptTemplate {
    /// 根据范式生成系统提示词
    pub fn system_prompt(paradigm: &Paradigm) -> String {
        match paradigm {
            Paradigm::Vibe => Self::vibe_system_prompt(),
            Paradigm::Spec => Self::spec_system_prompt(),
            Paradigm::Harness => Self::harness_system_prompt(),
        }
    }

    /// 根据范式生成用户提示词包装
    pub fn wrap_user_input(paradigm: &Paradigm, input: &str, context: &str) -> String {
        match paradigm {
            Paradigm::Vibe => Self::vibe_user_prompt(input, context),
            Paradigm::Spec => Self::spec_user_prompt(input, context),
            Paradigm::Harness => Self::harness_user_prompt(input, context),
        }
    }

    // ==================== Vibe 范式 ====================

    fn vibe_system_prompt() -> String {
        r#"# Vibe Coding Assistant

你是一个直觉驱动的编程助手，帮助产品经理将想法转化为代码。

## 核心原则

1. **理解意图胜过精确描述**
   - 用户可能不擅长技术表达
   - 从模糊描述中捕捉真实需求
   - 主动填补合理的实现细节

2. **渐进式澄清**
   - 如果需求确实模糊，提出2-3个关键问题
   - 不要一次性问太多问题
   - 给出合理的默认假设

3. **实用主义代码**
   - 优先工作，其次完美
   - 使用最简单可靠的技术方案
   - 避免过度工程

4. **教育式解释**
   - 解释"这段代码做什么"
   - 而非"这段代码怎么写"
   - 用产品经理能理解的语言

## 输出格式

1. 简要理解总结（1-2句）
2. 实现的代码（带注释）
3. 使用说明（如何运行/测试）
4. 可选的改进建议

## 代码风格

- 清晰可读，避免炫技
- 适当的错误处理
- 添加注释解释"为什么"
- 保持与项目现有风格一致
"#.to_string()
    }

    fn vibe_user_prompt(input: &str, context: &str) -> String {
        format!(
            r#"## 项目上下文
{}

## 我的想法
{}

---

请帮我实现这个功能。我不确定技术细节，但相信你能理解我的意图。如果有什么关键问题需要确认，请简要提出。"#,
            context, input
        )
    }

    // ==================== Spec 范式 ====================

    fn spec_system_prompt() -> String {
        r#"# Spec Coding Assistant

你是一个规格驱动的精确实现者，严格按照规格说明编写代码。

## 核心原则

1. **规格即契约**
   - 严格遵循给定的规格说明
   - 规格明确的地方，精确实现
   - 规格模糊的地方，标记出来

2. **完整性检查**
   - 实现所有明确列出的功能点
   - 处理所有提及的边界情况
   - 不添加规格外功能

3. **接口优先**
   - 先定义函数签名和数据结构
   - 再实现内部逻辑
   - 保持API一致性

4. **验证导向**
   - 考虑如何验证实现正确性
   - 提供测试思路或伪代码
   - 说明每个功能的验收标准

## 输出格式

1. 规格解析（列出功能点）
2. 接口设计（函数/数据结构）
3. 完整实现代码
4. 边界情况处理说明
5. 验证建议

## 代码风格

- 严格的类型定义
- 完整错误处理
- 详细的文档注释
- 可预测的行为
"#.to_string()
    }

    fn spec_user_prompt(input: &str, context: &str) -> String {
        format!(
            r#"## 项目上下文
{}

## 产品规格
{}

---

请严格按照上述规格实现。如果有规格不明确或矛盾的地方，请标记出来。不要添加规格外的功能。"#,
            context, input
        )
    }

    // ==================== Harness 范式 ====================

    fn harness_system_prompt() -> String {
        r#"# Harness Coding Assistant

你是一个约束驱动的开发者，通过测试和验证来驱动代码实现。

## 核心原则

1. **测试即需求**
   - 测试用例就是具体的需求说明
   - 先理解测试，再写实现
   - 所有测试必须通过

2. **契约式编程**
   - 明确定义前置条件
   - 保证后置条件
   - 处理所有异常情况

3. **防御性代码**
   - 不信任外部输入
   - 验证所有假设
   - 优雅失败

4. **可验证性**
   - 代码易于测试
   - 提供测试代码
   - 说明验证方法

## 输出格式

1. 约束分析（测试/约束解读）
2. 边界情况列表
3. 实现代码（带断言）
4. 测试代码
5. 验证结果说明

## 代码风格

- 断言丰富
- 错误信息清晰
- 日志完整
- 便于调试
"#.to_string()
    }

    fn harness_user_prompt(input: &str, context: &str) -> String {
        format!(
            r#"## 项目上下文
{}

## 约束/测试要求
{}

---

请实现满足上述约束的代码。提供测试用例验证实现正确性。确保所有边界情况都被处理。"#,
            context, input
        )
    }
}

/// 项目上下文生成器
#[allow(dead_code)]
pub struct ProjectContextGenerator;

#[allow(dead_code)]
impl ProjectContextGenerator {
    pub fn generate(
        project_path: &str,
        language: Option<&str>,
        file_structure: &[String],
    ) -> String {
        let mut context = format!("项目路径: {}\n", project_path);

        if let Some(lang) = language {
            context.push_str(&format!("主要语言: {}\n", lang));
        }

        context.push_str("\n文件结构:\n");
        for file in file_structure.iter().take(20) {
            context.push_str(&format!("  {}\n", file));
        }

        if file_structure.len() > 20 {
            context.push_str(&format!("  ... 还有 {} 个文件\n", file_structure.len() - 20));
        }

        context
    }
}

/// 创建完整的消息列表
pub fn create_messages(
    paradigm: &Paradigm,
    user_input: &str,
    project_context: &str,
    chat_history: Vec<(String, String)>, // (user, assistant)
) -> Vec<Message> {
    let mut messages = vec![
        Message::system(PromptTemplate::system_prompt(paradigm)),
    ];

    // 添加历史对话
    for (user_msg, assistant_msg) in chat_history {
        messages.push(Message::user(user_msg));
        messages.push(Message::assistant(assistant_msg));
    }

    // 添加当前请求
    let wrapped_input = PromptTemplate::wrap_user_input(paradigm, user_input, project_context);
    messages.push(Message::user(wrapped_input));

    messages
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_paradigm_display() {
        assert_eq!(Paradigm::Vibe.display_name(), "💭 Vibe");
        assert_eq!(Paradigm::Spec.display_name(), "📋 Spec");
        assert_eq!(Paradigm::Harness.display_name(), "🧪 Harness");
    }

    #[test]
    fn test_vibe_system_prompt() {
        let prompt = PromptTemplate::system_prompt(&Paradigm::Vibe);
        assert!(prompt.contains("Vibe Coding"));
        assert!(prompt.contains("直觉驱动"));
    }

    #[test]
    fn test_spec_system_prompt() {
        let prompt = PromptTemplate::system_prompt(&Paradigm::Spec);
        assert!(prompt.contains("Spec Coding"));
        assert!(prompt.contains("规格即契约"));
    }

    #[test]
    fn test_harness_system_prompt() {
        let prompt = PromptTemplate::system_prompt(&Paradigm::Harness);
        assert!(prompt.contains("Harness Coding"));
        assert!(prompt.contains("测试即需求"));
    }
}
