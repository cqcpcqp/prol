use crate::runtime::{self, ExecResult};
use std::path::PathBuf;

/// 在项目中运行代码文件
pub async fn run_code(project_path: PathBuf, file: String) -> anyhow::Result<ExecResult> {
    // 检测文件类型
    let file_path = project_path.join(&file);
    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    match extension {
        "py" => {
            // Python文件
            let venv_python = project_path.join(".ai-ide").join("venv").join("bin").join("python");
            runtime::exec_in_project(project_path, venv_python.to_string_lossy().to_string(), vec![file]).await
        }
        "js" | "ts" => {
            // Node文件
            runtime::exec_in_project(project_path, "node".to_string(), vec![file]).await
        }
        _ => Err(anyhow::anyhow!("Unsupported file type: {}", extension)),
    }
}

/// 安装依赖
pub async fn install_dependency(project_path: PathBuf, package: String) -> anyhow::Result<ExecResult> {
    // 读取项目配置
    let config_path = project_path.join(".ai-ide").join("runtime.json");

    if !config_path.exists() {
        return Err(anyhow::anyhow!("Project not initialized. Please create venv first."));
    }

    let config_str = tokio::fs::read_to_string(&config_path).await?;
    let project_runtime: runtime::ProjectRuntime = serde_json::from_str(&config_str)?;

    // 根据运行时类型选择包管理器
    let runtimes = runtime::list_installed_runtimes().await?;
    let runtime = runtimes
        .into_iter()
        .find(|r| r.id == project_runtime.runtime_id)
        .ok_or_else(|| anyhow::anyhow!("Runtime not found"))?;

    match runtime.runtime_type {
        runtime::RuntimeType::Python => {
            let pip_path = project_path
                .join(".ai-ide")
                .join("venv")
                .join("bin")
                .join("pip");

            runtime::exec_in_project(
                project_path,
                pip_path.to_string_lossy().to_string(),
                vec!["install".to_string(), package],
            )
            .await
        }
        runtime::RuntimeType::Node => {
            runtime::exec_in_project(
                project_path,
                "npm".to_string(),
                vec!["install".to_string(), package],
            )
            .await
        }
    }
}