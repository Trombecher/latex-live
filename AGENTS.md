# Latex Live Agent Information

This should be a desktop app to edit and compile latex. It is a Tauri V2 app.

## Frontend

SolidJS, TailwindCSS, oxfmt, oxlint.

## Backend

Rust, rustfmt. Render latex pdfs via the `tectonic` crate.

## Git

Do not stage changes from `src-tauri/Cargo.toml` nor from `src-tauri/Cargo.lock`
if not explicitily said.
