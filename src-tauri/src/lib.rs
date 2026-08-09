mod fs;
mod watch;

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::menu::{MenuBuilder, MenuItem, SubmenuBuilder};
use tauri::{Emitter, Manager, RunEvent};

/// Exit paths are held until the frontend confirms pending saves are
/// flushed. Exit codes are not a reliable discriminator, so a flag it is.
static QUIT_CONFIRMED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
fn confirm_quit(app: tauri::AppHandle) {
    QUIT_CONFIRMED.store(true, Ordering::SeqCst);
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(watch::WatcherState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // The default menu's Quit sends AppKit `terminate:`, which kills
            // the process before anything can flush pending saves (tao has no
            // applicationShouldTerminate hook). Our own Quit item routes
            // Cmd+Q through the flush flow in the frontend instead.
            let handle = app.handle();
            let quit = MenuItem::with_id(handle, "quit", "Quit kladd", true, Some("CmdOrCtrl+Q"))?;
            let app_menu = SubmenuBuilder::new(handle, "kladd")
                .about(None)
                .separator()
                .services()
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .item(&quit)
                .build()?;
            let edit = SubmenuBuilder::new(handle, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;
            let window = SubmenuBuilder::new(handle, "Window")
                .minimize()
                .close_window()
                .build()?;
            let menu = MenuBuilder::new(handle)
                .items(&[&app_menu, &edit, &window])
                .build()?;
            app.set_menu(menu)?;
            app.on_menu_event(|app_handle, event| {
                if event.id() == "quit" {
                    let _ = app_handle.emit("quit-requested", ());
                    // Safety valve: if the frontend is hung the app must
                    // still quit. Atomic writes mean no torn files either way.
                    std::thread::spawn(|| {
                        std::thread::sleep(std::time::Duration::from_secs(2));
                        std::process::exit(0);
                    });
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            fs::read_dir,
            fs::list_files,
            fs::read_file,
            fs::write_file_atomic,
            fs::create_file,
            fs::create_dir,
            fs::rename_path,
            fs::delete_path,
            watch::watch_workspace,
            confirm_quit
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // Backstop for programmatic exits: hold them for a flush too,
        // unless confirm_quit already ran or no window is left to ask.
        if let RunEvent::ExitRequested { api, .. } = &event {
            if !QUIT_CONFIRMED.load(Ordering::SeqCst) && !app_handle.webview_windows().is_empty() {
                api.prevent_exit();
                let _ = app_handle.emit("quit-requested", ());
            }
        }
    });
}
