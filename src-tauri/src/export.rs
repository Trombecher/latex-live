//! Writing the compiled PDF to a user-chosen location.

use std::{fs, path::PathBuf};

use tauri::ipc::{InvokeBody, Request};

/// Write a PDF to the destination picked in the native save dialog.
///
/// The raw IPC payload is a little-endian `u32` byte length, followed by the
/// UTF-8 destination path and then the PDF bytes. Sending the PDF this way
/// avoids serializing it as a JSON array of numbers.
#[tauri::command]
pub fn export_pdf(request: Request<'_>) -> Result<(), String> {
    let InvokeBody::Raw(payload) = request.body() else {
        return Err("Expected raw PDF data.".to_owned());
    };

    let Some((length_bytes, rest)) = payload.split_at_checked(4) else {
        return Err("Invalid export payload.".to_owned());
    };

    let path_length =
        u32::from_le_bytes(length_bytes.try_into().expect("slice has length 4")) as usize;

    let Some((path_bytes, pdf_bytes)) = rest.split_at_checked(path_length) else {
        return Err("Invalid export payload.".to_owned());
    };

    let destination = String::from_utf8(path_bytes.to_vec())
        .map_err(|_| "The export path is not valid UTF-8.".to_owned())?;
    let destination = PathBuf::from(destination);

    fs::write(&destination, pdf_bytes)
        .map_err(|error| format!("Failed to export {}: {error}", destination.display()))
}
