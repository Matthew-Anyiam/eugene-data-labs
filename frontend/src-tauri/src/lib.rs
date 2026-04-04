use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_autostart::MacosLauncher;

/// Handle deep link URLs (eugene://company/AAPL → navigate in webview)
fn handle_deep_link(app: &tauri::AppHandle, urls: Vec<url::Url>) {
    if let Some(url) = urls.first() {
        // Convert eugene://company/AAPL → /company/AAPL
        let path = format!("/{}{}", url.host_str().unwrap_or(""), url.path());
        if let Some(window) = app.get_webview_window("main") {
            let _ = window.eval(&format!(
                "window.location.hash = ''; window.history.pushState(null, '', '{}'); window.dispatchEvent(new PopStateEvent('popstate'));",
                path
            ));
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            // ── System tray ───────────────────────────────────
            let show = MenuItem::with_id(app, "show", "Show Eugene", true, None::<&str>)?;
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &hide, &quit])?;

            let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
                .unwrap_or_else(|_| Image::from_bytes(include_bytes!("../icons/32x32.png")).expect("icon fallback"));

            TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Eugene Intelligence")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "hide" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.hide();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            // ── Deep links ────────────────────────────────────
            let handle = app.handle().clone();
            app.listen("deep-link://new-url", move |event| {
                if let Ok(urls) = serde_json::from_str::<Vec<url::Url>>(event.payload()) {
                    handle_deep_link(&handle, urls);
                }
            });

            // ── Dev tools in debug ────────────────────────────
            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
