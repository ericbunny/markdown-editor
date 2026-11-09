//! 构建脚本：把 Windows 图标资源编译进可执行文件。
//!
//! 资源管理器与任务栏固定项读的是可执行文件内的图标资源（ID 32512），它由 `tauri_build`
//! 依据 `icons/icon.ico` 生成；运行时的窗口图标取自同一份素材，两者因此保持一致。
//! `tauri_build` 自己不声明这份依赖，必须在这里显式声明，否则替换图标后资源不会重新生成。

fn main() {
    println!("cargo:rerun-if-changed=icons/icon.ico");
    tauri_build::build()
}
