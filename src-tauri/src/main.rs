// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod config;
mod llm;
mod paradigm;
mod ai;
mod runtime;
mod sandbox;
mod session;


fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            // 初始化运行时管理器目录
            let app_handle = app.handle();
            if let Err(e) = runtime::init_runtime_dir(&app_handle) {
                eprintln!("Failed to init runtime dir: {}", e);
            }

            // 加载配置
            match config::IdeConfig::load() {
                Ok(_config) => {
                    log::info!("Configuration loaded successfully");
                }
                Err(e) => {
                    eprintln!("Failed to load config: {}", e);
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // 文件系统命令
            commands::fs::read_directory,
            commands::fs::read_file,
            commands::fs::write_file,
            commands::fs::create_directory,
            commands::fs::create_file,
            commands::fs::delete_file,
            commands::fs::delete_directory,
            commands::fs::rename_path,
            commands::fs::file_exists,
            // 运行时命令
            commands::list_installed_runtimes,
            commands::install_runtime,
            commands::create_project_venv,
            commands::exec_in_project,
            // 沙箱命令
            commands::run_code,
            commands::install_dependency,
            // AI命令
            commands::ai::generate_code,
            commands::ai::generate_code_stream_channel,
            commands::ai::explain_code,
            commands::ai::get_config,
            commands::ai::set_api_key,
            // 范式命令
            commands::paradigm::get_paradigms,
            commands::paradigm::get_current_paradigm,
            commands::paradigm::set_paradigm,
            commands::paradigm::get_paradigm_description,
            // 会话命令
            commands::session::create_session,
            commands::session::get_sessions,
            commands::session::get_project_sessions,
            commands::session::load_session,
            commands::session::save_session_message,
            commands::session::delete_session,
            commands::session::export_session,
            commands::session::record_code_change,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}