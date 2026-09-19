mod commands;
mod error;
mod filesystem;
mod jobs;
mod page_range;
mod pdf;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_opener::Builder::new()
                .open_js_links_on_click(false)
                .build(),
        )
        .setup(|app| {
            let bundled_qpdf = app.path().resource_dir()?.join("qpdf").join("qpdf.exe");
            let bundled_pdfium = app.path().resource_dir()?.join("pdfium.dll");
            let qpdf = pdf::qpdf_engine::QpdfEngine::discover_with_bundled(Some(bundled_qpdf));
            let pdfium = pdf::pdfium_engine::PdfiumEngine::load(&bundled_pdfium)?;
            app.manage(jobs::engine::JobEngine::new(qpdf.clone(), pdfium.clone()));
            app.manage(qpdf);
            app.manage(pdfium);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_capabilities,
            commands::start_job,
            commands::list_jobs,
            commands::cancel_job,
            commands::clear_finished_jobs,
            commands::get_default_output_directory,
            commands::prepare_output_directory,
            commands::open_job_output,
            commands::reveal_job_output,
            commands::check_for_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PDF Toolbox");
}
