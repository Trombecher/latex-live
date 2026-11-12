//! Workspace-scoped filesystem access.
//!
//! Every path that crosses the Tauri boundary is relative to the one global
//! workspace root. The root is canonicalized when a folder is opened, and all
//! later operations re-check that their target stays inside it.

use std::{
    fs,
    path::{Component, Path, PathBuf},
    sync::Mutex,
};

use serde::Serialize;

/// Global workspace directory shared by all commands.
#[derive(Default)]
pub struct WorkspaceState {
    root: Mutex<Option<PathBuf>>,
}

impl WorkspaceState {
    pub fn root(&self) -> Result<PathBuf, String> {
        self.root
            .lock()
            .map_err(|_| "The workspace state is unavailable.".to_owned())?
            .clone()
            .ok_or_else(|| "No folder is open.".to_owned())
    }

    fn set_root(&self, root: PathBuf) -> Result<(), String> {
        *self
            .root
            .lock()
            .map_err(|_| "The workspace state is unavailable.".to_owned())? = Some(root);
        Ok(())
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceInfo {
    pub root: String,
    pub name: String,
    pub entries: Vec<DirEntry>,
}

/// Join a frontend-supplied relative path onto the workspace root.
///
/// Absolute paths, drive prefixes, and `..` components are rejected so that a
/// caller cannot address anything outside the workspace.
fn join_relative(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let relative = Path::new(relative);

    for component in relative.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            _ => return Err("Invalid path: paths must stay inside the open folder.".to_owned()),
        }
    }

    Ok(root.join(relative))
}

/// Resolve an existing path and verify that it is still inside the workspace.
///
/// Canonicalization follows symlinks, so this also rejects symlinks that point
/// outside the workspace.
pub(crate) fn resolve_existing(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let candidate = join_relative(root, relative)?;
    let resolved = fs::canonicalize(&candidate)
        .map_err(|error| format!("Failed to open {relative:?}: {error}"))?;

    if !resolved.starts_with(root) {
        return Err("Path is outside the open folder.".to_owned());
    }

    Ok(resolved)
}

/// Convert an absolute path into the `/`-separated form used by the frontend.
fn relative_path(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .unwrap_or(path)
        .components()
        .filter_map(|component| match component {
            Component::Normal(part) => Some(part.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect::<Vec<_>>()
        .join("/")
}

fn read_entries(root: &Path, directory: &Path) -> Result<Vec<DirEntry>, String> {
    let reader = fs::read_dir(directory)
        .map_err(|error| format!("Failed to list {}: {error}", directory.display()))?;

    let mut entries = Vec::new();

    for entry in reader {
        let entry = entry.map_err(|error| format!("Failed to read a directory entry: {error}"))?;
        let path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| format!("Failed to inspect {}: {error}", path.display()))?;

        // Follow symlinks for display purposes; access is still checked with
        // `resolve_existing` whenever the entry is opened.
        let is_dir = if file_type.is_symlink() {
            fs::metadata(&path).is_ok_and(|metadata| metadata.is_dir())
        } else {
            file_type.is_dir()
        };

        entries.push(DirEntry {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: relative_path(root, &path),
            is_dir,
        });
    }

    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(entries)
}

#[tauri::command]
pub fn open_workspace(
    path: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<WorkspaceInfo, String> {
    let root = fs::canonicalize(&path)
        .map_err(|error| format!("Failed to open the folder {path:?}: {error}"))?;

    if !root.is_dir() {
        return Err("The selected path is not a folder.".to_owned());
    }

    let entries = read_entries(&root, &root)?;
    let name = root
        .file_name()
        .map(|name| name.to_string_lossy().into_owned())
        .unwrap_or_else(|| root.display().to_string());

    state.set_root(root.clone())?;

    Ok(WorkspaceInfo {
        root: root.display().to_string(),
        name,
        entries,
    })
}

#[tauri::command]
pub fn list_workspace_directory(
    path: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<Vec<DirEntry>, String> {
    let root = state.root()?;
    let directory = resolve_existing(&root, &path)?;

    if !directory.is_dir() {
        return Err("The selected path is not a folder.".to_owned());
    }

    read_entries(&root, &directory)
}

#[tauri::command]
pub fn read_workspace_file(
    path: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<String, String> {
    let root = state.root()?;
    let file = resolve_existing(&root, &path)?;

    if !file.is_file() {
        return Err("The selected path is not a file.".to_owned());
    }

    let bytes =
        fs::read(&file).map_err(|error| format!("Failed to read {}: {error}", file.display()))?;

    String::from_utf8(bytes).map_err(|_| "This file is not valid UTF-8 text.".to_owned())
}

#[tauri::command]
pub fn write_workspace_file(
    path: String,
    contents: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let root = state.root()?;
    let file = resolve_existing(&root, &path)?;

    if !file.is_file() {
        return Err("Only existing files can be saved.".to_owned());
    }

    fs::write(&file, contents)
        .map_err(|error| format!("Failed to save {}: {error}", file.display()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_normal_relative_paths() {
        let root = Path::new("/workspace");

        assert_eq!(
            join_relative(root, "chapters/intro.tex").unwrap(),
            PathBuf::from("/workspace/chapters/intro.tex")
        );
        assert_eq!(
            join_relative(root, "").unwrap(),
            PathBuf::from("/workspace")
        );
    }

    #[test]
    fn rejects_escaping_paths() {
        let root = Path::new("/workspace");

        assert!(join_relative(root, "../secret.tex").is_err());
        assert!(join_relative(root, "/etc/passwd").is_err());
        assert!(join_relative(root, "chapters/../../secret.tex").is_err());
    }

    #[test]
    fn formats_relative_paths_with_forward_slashes() {
        let root = Path::new("/workspace");

        assert_eq!(
            relative_path(root, Path::new("/workspace/chapters/intro.tex")),
            "chapters/intro.tex"
        );
        assert_eq!(relative_path(root, root), "");
    }
}
