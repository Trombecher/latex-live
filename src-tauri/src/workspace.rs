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

/// Validate a single file or folder name supplied by the user.
///
/// Names must not contain path separators, so they always stay in the folder
/// they were entered for.
fn validate_entry_name(name: &str) -> Result<String, String> {
    let name = name.trim();

    if name.is_empty() {
        return Err("Enter a name.".to_owned());
    }

    if name == "." || name == ".." {
        return Err("That name is not allowed.".to_owned());
    }

    if name.contains(['/', '\\', '\0']) {
        return Err("Names cannot contain path separators.".to_owned());
    }

    Ok(name.to_owned())
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

/// Resolve a path for deletion without following a trailing symlink.
///
/// The parent directory is canonicalized so the entry always stays inside the
/// workspace, but the final component is left alone: deleting a symlink must
/// move the link itself to the trash instead of the tree it points at.
fn resolve_entry_for_delete(root: &Path, relative: &str) -> Result<PathBuf, String> {
    let candidate = join_relative(root, relative)?;
    let name = candidate
        .file_name()
        .ok_or_else(|| "The open folder cannot be deleted.".to_owned())?;

    let parent = candidate
        .parent()
        .ok_or_else(|| "The open folder cannot be deleted.".to_owned())?;
    let parent = fs::canonicalize(parent)
        .map_err(|error| format!("Failed to resolve {relative:?}: {error}"))?;

    if !parent.starts_with(root) {
        return Err("Path is outside the open folder.".to_owned());
    }

    let path = parent.join(name);

    fs::symlink_metadata(&path).map_err(|error| format!("Failed to open {relative:?}: {error}"))?;

    Ok(path)
}

/// Whether a path is a LaTeX source file.
pub(crate) fn is_latex_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            extension.eq_ignore_ascii_case("tex") || extension.eq_ignore_ascii_case("latex")
        })
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
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
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
    let name = root.file_name().map_or_else(
        || root.display().to_string(),
        |name| name.to_string_lossy().into_owned(),
    );

    state.set_root(root.clone())?;

    Ok(WorkspaceInfo {
        root: root.display().to_string(),
        name,
        entries,
    })
}

#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
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
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
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

/// Save a file inside the workspace.
///
/// LaTeX sources are formatted with `tex-fmt` before they are written. The
/// text that was actually written is returned so the frontend can apply the
/// formatted source to the open editor.
#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
pub fn write_workspace_file(
    path: String,
    contents: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<String, String> {
    let root = state.root()?;
    let file = resolve_existing(&root, &path)?;

    if !file.is_file() {
        return Err("Only existing files can be saved.".to_owned());
    }

    let contents = if is_latex_file(&file) {
        crate::format::format_latex(&contents)
    } else {
        contents
    };

    fs::write(&file, &contents)
        .map_err(|error| format!("Failed to save {}: {error}", file.display()))?;

    Ok(contents)
}

/// Create a new, empty text file inside the workspace.
///
/// The returned path is relative to the workspace root and uses `/`
/// separators, matching the paths of [`DirEntry`].
#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
pub fn create_workspace_file(
    directory: String,
    name: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<String, String> {
    let root = state.root()?;
    let directory = resolve_existing(&root, &directory)?;

    if !directory.is_dir() {
        return Err("New files can only be created inside a folder.".to_owned());
    }

    let name = validate_entry_name(&name)?;
    let path = directory.join(&name);

    fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                format!("{name:?} already exists in this folder.")
            } else {
                format!("Failed to create {name:?}: {error}")
            }
        })?;

    Ok(relative_path(&root, &path))
}

/// Create a new, empty folder inside the workspace.
///
/// The returned path is relative to the workspace root and uses `/`
/// separators, matching the paths of [`DirEntry`].
#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
pub fn create_workspace_folder(
    directory: String,
    name: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<String, String> {
    let root = state.root()?;
    let directory = resolve_existing(&root, &directory)?;

    if !directory.is_dir() {
        return Err("New folders can only be created inside a folder.".to_owned());
    }

    let name = validate_entry_name(&name)?;
    let path = directory.join(&name);

    fs::create_dir(&path).map_err(|error| {
        if error.kind() == std::io::ErrorKind::AlreadyExists {
            format!("{name:?} already exists in this folder.")
        } else {
            format!("Failed to create {name:?}: {error}")
        }
    })?;

    Ok(relative_path(&root, &path))
}

/// Rename a file inside the workspace and return its new relative path.
#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
pub fn rename_workspace_file(
    path: String,
    name: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<String, String> {
    let root = state.root()?;
    let file = resolve_existing(&root, &path)?;

    if !file.is_file() {
        return Err("Only files can be renamed.".to_owned());
    }

    let name = validate_entry_name(&name)?;
    let parent = file
        .parent()
        .ok_or_else(|| "The file has no parent folder.".to_owned())?;
    let target = parent.join(&name);

    if file.file_name().and_then(|current| current.to_str()) == Some(name.as_str()) {
        return Ok(relative_path(&root, &file));
    }

    // `canonicalize` succeeding means the target exists. A case-only rename on
    // a case-insensitive filesystem resolves to the same file and is allowed.
    if let Ok(existing) = fs::canonicalize(&target)
        && existing != file
    {
        return Err(format!("{name:?} already exists in this folder."));
    }

    fs::rename(&file, &target).map_err(|error| format!("Failed to rename {path:?}: {error}"))?;

    Ok(relative_path(&root, &target))
}

/// Move a file or folder inside the workspace to the operating system's trash.
///
/// Trashing a folder moves the folder and its entire contents, recursively.
#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
pub fn trash_workspace_entry(
    path: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<(), String> {
    let root = state.root()?;
    let entry = resolve_entry_for_delete(&root, &path)?;

    trash::delete(&entry).map_err(|error| format!("Failed to delete {path:?}: {error}"))
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

    #[test]
    fn trims_and_accepts_plain_names() {
        assert_eq!(validate_entry_name("  main.tex  ").unwrap(), "main.tex");
        assert_eq!(
            validate_entry_name("notes with spaces.txt").unwrap(),
            "notes with spaces.txt"
        );
        assert_eq!(validate_entry_name("chapters").unwrap(), "chapters");
    }

    #[test]
    fn rejects_names_with_path_components() {
        assert!(validate_entry_name("").is_err());
        assert!(validate_entry_name("   ").is_err());
        assert!(validate_entry_name(".").is_err());
        assert!(validate_entry_name("..").is_err());
        assert!(validate_entry_name("chapters/intro.tex").is_err());
        assert!(validate_entry_name(r"chapters\intro.tex").is_err());
    }

    #[test]
    fn rejects_deleting_the_workspace_root() {
        let root = fs::canonicalize(std::env::temp_dir()).unwrap();

        assert!(resolve_entry_for_delete(&root, "").is_err());
        assert!(resolve_entry_for_delete(&root, ".").is_err());
        assert!(resolve_entry_for_delete(&root, "../").is_err());
    }
}
