use tauri::command;

pub mod ai;
pub mod fs;
pub mod paradigm;
pub mod session;

// 运行时命令
#[command]
pub async fn list_installed_runtimes() -> Result<Vec<crate::runtime::RuntimeConfig>, String> {
    crate::runtime::list_installed_runtimes()
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn install_runtime(
    runtime_type: String,
    version: String,
) -> Result<crate::runtime::RuntimeConfig, String> {
    let rt_type = match runtime_type.as_str() {
        "python" => crate::runtime::RuntimeType::Python,
        "node" => crate::runtime::RuntimeType::Node,
        _ => return Err(format!("Unknown runtime type: {}", runtime_type)),
    };

    crate::runtime::install_runtime(rt_type, version)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn create_project_venv(
    project_path: String,
    runtime_id: String,
) -> Result<crate::runtime::ProjectRuntime, String> {
    let path = std::path::PathBuf::from(project_path);
    crate::runtime::create_project_venv(path, runtime_id)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn exec_in_project(
    project_path: String,
    command: String,
    args: Vec<String>,
) -> Result<crate::runtime::ExecResult, String> {
    let path = std::path::PathBuf::from(project_path);
    crate::runtime::exec_in_project(path, command, args)
        .await
        .map_err(|e| e.to_string())
}

// 沙箱命令
#[command]
pub async fn run_code(
    project_path: String,
    file: String,
) -> Result<crate::runtime::ExecResult, String> {
    let path = std::path::PathBuf::from(project_path);
    crate::sandbox::run_code(path, file)
        .await
        .map_err(|e| e.to_string())
}

#[command]
pub async fn install_dependency(
    project_path: String,
    package: String,
) -> Result<crate::runtime::ExecResult, String> {
    let path = std::path::PathBuf::from(project_path);
    crate::sandbox::install_dependency(path, package)
        .await
        .map_err(|e| e.to_string())
}