use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Stdio;
use tokio::process::Command;

/// 运行时配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    pub id: String,
    pub runtime_type: RuntimeType,
    pub version: String,
    pub install_path: PathBuf,
    pub installed_at: String,
    pub is_default: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeType {
    Python,
    Node,
}

impl RuntimeType {
    pub fn as_str(&self) -> &'static str {
        match self {
            RuntimeType::Python => "python",
            RuntimeType::Node => "node",
        }
    }
}

/// 项目运行时配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectRuntime {
    pub project_path: PathBuf,
    pub runtime_id: String,
    pub venv_path: PathBuf,
    pub dependencies: Vec<Dependency>,
    pub installed_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dependency {
    pub name: String,
    pub version: String,
    pub installed_at: String,
}

/// 执行结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
}

/// 获取AI IDE配置目录
pub fn get_ai_ide_dir() -> anyhow::Result<PathBuf> {
    let home = dirs::home_dir().ok_or_else(|| anyhow::anyhow!("Cannot find home directory"))?;
    let ai_ide_dir = home.join(".ai-ide");
    std::fs::create_dir_all(&ai_ide_dir)?;
    Ok(ai_ide_dir)
}

/// 获取运行时目录
pub fn get_runtimes_dir() -> anyhow::Result<PathBuf> {
    let dir = get_ai_ide_dir()?.join("runtimes");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// 初始化运行时目录
pub fn init_runtime_dir(_app_handle: &tauri::AppHandle) -> anyhow::Result<()> {
    let runtimes_dir = get_runtimes_dir()?;
    log::info!("Runtime directory: {:?}", runtimes_dir);

    // 确保目录存在
    std::fs::create_dir_all(&runtimes_dir)?;

    Ok(())
}

/// 列出已安装的运行时
pub async fn list_installed_runtimes() -> anyhow::Result<Vec<RuntimeConfig>> {
    let runtimes_dir = get_runtimes_dir()?;
    let mut runtimes = Vec::new();

    if !runtimes_dir.exists() {
        return Ok(runtimes);
    }

    // 读取运行时目录
    for entry in std::fs::read_dir(&runtimes_dir)? {
        let entry = entry?;
        let runtime_type_dir = entry.path();

        if runtime_type_dir.is_dir() {
            let runtime_type = runtime_type_dir
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");

            for version_entry in std::fs::read_dir(&runtime_type_dir)? {
                let version_entry = version_entry?;
                let version_dir = version_entry.path();

                if version_dir.is_dir() {
                    let version = version_dir
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("")
                        .to_string();

                    let runtime_type_enum = match runtime_type {
                        "python" => RuntimeType::Python,
                        "node" => RuntimeType::Node,
                        _ => continue,
                    };

                    // 验证安装是否完整
                    if is_runtime_valid(&runtime_type_enum, &version_dir).await? {
                        runtimes.push(RuntimeConfig {
                            id: format!("{}-{}", runtime_type, version),
                            runtime_type: runtime_type_enum,
                            version,
                            install_path: version_dir,
                            installed_at: chrono::Utc::now().to_rfc3339(),
                            is_default: false,
                        });
                    }
                }
            }
        }
    }

    Ok(runtimes)
}

/// 验证运行时是否完整
async fn is_runtime_valid(runtime_type: &RuntimeType, install_path: &PathBuf) -> anyhow::Result<bool> {
    match runtime_type {
        RuntimeType::Python => {
            let python_exe = if cfg!(target_os = "windows") {
                install_path.join("python.exe")
            } else {
                install_path.join("bin").join("python3")
            };
            Ok(python_exe.exists())
        }
        RuntimeType::Node => {
            let node_exe = if cfg!(target_os = "windows") {
                install_path.join("node.exe")
            } else {
                install_path.join("bin").join("node")
            };
            Ok(node_exe.exists())
        }
    }
}

/// 安装运行时
pub async fn install_runtime(
    runtime_type: RuntimeType,
    version: String,
) -> anyhow::Result<RuntimeConfig> {
    let runtimes_dir = get_runtimes_dir()?;
    let install_dir = runtimes_dir
        .join(runtime_type.as_str())
        .join(&version);

    std::fs::create_dir_all(&install_dir)?;

    match runtime_type {
        RuntimeType::Python => install_python(&version, &install_dir).await?,
        RuntimeType::Node => install_node(&version, &install_dir).await?,
    }

    let config = RuntimeConfig {
        id: format!("{}-{}", runtime_type.as_str(), version),
        runtime_type,
        version,
        install_path: install_dir,
        installed_at: chrono::Utc::now().to_rfc3339(),
        is_default: false,
    };

    Ok(config)
}

/// 安装Python运行时
async fn install_python(version: &str, install_dir: &PathBuf) -> anyhow::Result<()> {
    // 下载Python嵌入版
    let platform = if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "win32"
    };

    let arch = if cfg!(target_arch = "x86_64") {
        "x86_64"
    } else if cfg!(target_arch = "aarch64") {
        "aarch64"
    } else {
        "x86"
    };

    // 使用python-build-standalone或类似方案
    let download_url = format!(
        "https://github.com/indygreg/python-build-standalone/releases/download/20240107/cpython-{}-{}-{}-install_only.tar.gz",
        version, platform, arch
    );

    log::info!("Downloading Python from: {}", download_url);

    let response = reqwest::get(&download_url).await?;
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Failed to download Python: {}", response.status()));
    }

    let bytes = response.bytes().await?;

    // 解压tar.gz
    let tar = flate2::read::GzDecoder::new(&bytes[..]);
    let mut archive = tar::Archive::new(tar);
    archive.unpack(install_dir)?;

    log::info!("Python {} installed to {:?}", version, install_dir);

    Ok(())
}

/// 安装Node运行时
async fn install_node(version: &str, install_dir: &PathBuf) -> anyhow::Result<()> {
    let platform = if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        "win32"
    };

    let arch = if cfg!(target_arch = "x86_64") {
        "x64"
    } else if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x86"
    };

    let ext = if cfg!(target_os = "windows") { "zip" } else { "tar.gz" };

    let download_url = format!(
        "https://nodejs.org/dist/v{}/node-v{}-{}-{}.{}",
        version, version, platform, arch, ext
    );

    log::info!("Downloading Node from: {}", download_url);

    let response = reqwest::get(&download_url).await?;
    if !response.status().is_success() {
        return Err(anyhow::anyhow!("Failed to download Node: {}", response.status()));
    }

    let bytes = response.bytes().await?;

    if ext == "zip" {
        // 解压zip
        let reader = std::io::Cursor::new(&bytes);
        let mut archive = zip::ZipArchive::new(reader)?;
        archive.extract(install_dir)?;
    } else {
        // 解压tar.gz
        let tar = flate2::read::GzDecoder::new(&bytes[..]);
        let mut archive = tar::Archive::new(tar);
        archive.unpack(install_dir)?;
    }

    log::info!("Node {} installed to {:?}", version, install_dir);

    Ok(())
}

/// 为项目创建虚拟环境
pub async fn create_project_venv(
    project_path: PathBuf,
    runtime_id: String,
) -> anyhow::Result<ProjectRuntime> {
    let runtimes = list_installed_runtimes().await?;
    let runtime = runtimes
        .into_iter()
        .find(|r| r.id == runtime_id)
        .ok_or_else(|| anyhow::anyhow!("Runtime not found: {}", runtime_id))?;

    let venv_path = project_path.join(".ai-ide").join("venv");
    std::fs::create_dir_all(&venv_path)?;

    match runtime.runtime_type {
        RuntimeType::Python => {
            let python_path = if cfg!(target_os = "windows") {
                runtime.install_path.join("python.exe")
            } else {
                runtime.install_path.join("bin").join("python3")
            };

            let output = Command::new(&python_path)
                .args(&["-m", "venv", venv_path.to_str().unwrap()])
                .output()
                .await?;

            if !output.status.success() {
                return Err(anyhow::anyhow!(
                    "Failed to create venv: {}",
                    String::from_utf8_lossy(&output.stderr)
                ));
            }
        }
        RuntimeType::Node => {
            // Node使用node_modules作为隔离
            let node_modules = project_path.join("node_modules");
            std::fs::create_dir_all(&node_modules)?;
        }
    }

    let project_runtime = ProjectRuntime {
        project_path: project_path.clone(),
        runtime_id,
        venv_path,
        dependencies: vec![],
        installed_at: chrono::Utc::now().to_rfc3339(),
    };

    // 保存项目运行时配置
    let config_path = project_path.join(".ai-ide").join("runtime.json");
    let config_json = serde_json::to_string_pretty(&project_runtime)?;
    std::fs::write(&config_path, config_json)?;

    Ok(project_runtime)
}

/// 在项目虚拟环境中执行命令
pub async fn exec_in_project(
    project_path: PathBuf,
    command: String,
    args: Vec<String>,
) -> anyhow::Result<ExecResult> {
    // 读取项目运行时配置
    let config_path = project_path.join(".ai-ide").join("runtime.json");
    let config_str = std::fs::read_to_string(&config_path)
        .map_err(|_| anyhow::anyhow!("Project runtime not configured. Please create venv first."))?;
    let project_runtime: ProjectRuntime = serde_json::from_str(&config_str)?;

    // 获取运行时信息
    let runtimes = list_installed_runtimes().await?;
    let _runtime = runtimes
        .into_iter()
        .find(|r| r.id == project_runtime.runtime_id)
        .ok_or_else(|| anyhow::anyhow!("Runtime not found"))?;

    // 构建环境变量（完全隔离）
    let venv_bin = project_runtime.venv_path.join("bin");
    let mut cmd = Command::new(&command);

    cmd.args(&args)
        .current_dir(&project_path)
        .env_clear()
        .env("PATH", &venv_bin)
        .env("VIRTUAL_ENV", &project_runtime.venv_path)
        .env("PYTHONNOUSERSITE", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // 执行命令
    let output = cmd.output().await?;

    Ok(ExecResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
        stderr: String::from_utf8_lossy(&output.stderr).to_string(),
        exit_code: output.status.code().unwrap_or(-1),
    })
}