use keyring::{Entry, Error as KeyErr};

const SERVICE: &str = "avenzia-groups";
const ACCOUNT: &str = "session";

fn entry() -> Result<Entry, String> { Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string()) }

// Le jeton de session est conservé dans le coffre du système (Windows Credential Manager / Keychain / Secret Service).
#[tauri::command]
fn store_token(token: String) -> Result<(), String> { entry()?.set_password(&token).map_err(|e| e.to_string()) }

#[tauri::command]
fn get_token() -> Result<Option<String>, String> {
    match entry()?.get_password() { Ok(t) => Ok(Some(t)), Err(KeyErr::NoEntry) => Ok(None), Err(e) => Err(e.to_string()) }
}

#[tauri::command]
fn clear_token() -> Result<(), String> {
    match entry()?.delete_credential() { Ok(()) | Err(KeyErr::NoEntry) => Ok(()), Err(e) => Err(e.to_string()) }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![store_token, get_token, clear_token])
        .run(tauri::generate_context!())
        .expect("erreur au lancement d'Avenzia");
}
