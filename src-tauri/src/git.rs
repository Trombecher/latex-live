//! Git integration through the system `git` command-line interface.
//!
//! Every command runs with the workspace root as its working directory and
//! arguments are passed directly to the process, never through a shell. Git
//! itself handles credentials through the user's configured credential helper
//! or SSH agent; prompts are disabled so that a missing credential fails with
//! an error instead of hanging the app.

use std::{
    path::{Path, PathBuf},
    process::{Command, Output},
};

use serde::Serialize;

use crate::workspace::WorkspaceState;

/// How much of Git's error output we are willing to send over IPC.
const MAX_ERROR_LEN: usize = 8 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitChange {
    /// Path relative to the workspace root, using `/` separators.
    pub path: String,
    /// Previous path of a rename or copy, workspace-relative when possible.
    pub orig_path: Option<String>,
    /// Status in the index (first porcelain column).
    pub index: String,
    /// Status in the working tree (second porcelain column).
    pub worktree: String,
    /// Single character used for the status badge in the UI.
    pub status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
    pub is_repo: bool,
    pub repo_root: Option<String>,
    pub branch: Option<String>,
    pub detached: bool,
    pub origin_url: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub has_upstream: bool,
    pub changes: Vec<GitChange>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitActionResult {
    pub message: String,
    pub status: GitStatus,
}

#[derive(Default)]
struct BranchInfo {
    branch: Option<String>,
    detached: bool,
    ahead: u32,
    behind: u32,
    has_upstream: bool,
}

/// Run Git and return its raw output.
///
/// Optional locks are disabled so that read-only `git status` calls never take
/// the index lock while another command is running.
fn run_git(root: &Path, args: &[&str]) -> Result<Output, String> {
    let mut command = Command::new("git");

    command
        .current_dir(root)
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("NO_COLOR", "1")
        .env("LC_ALL", "C")
        .arg("-c")
        .arg("color.ui=false")
        .args(args);

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // Do not flash a console window when spawning Git from the GUI.
        command.creation_flags(0x0800_0000);
    }

    command.output().map_err(|error| {
        if error.kind() == std::io::ErrorKind::NotFound {
            "Git is not installed or could not be found on PATH.".to_owned()
        } else {
            format!("Failed to run Git: {error}")
        }
    })
}

/// Run Git and fail with its stderr when the exit status is non-zero.
fn run_git_checked(root: &Path, args: &[&str]) -> Result<String, String> {
    let output = run_git(root, args)?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).into_owned())
    } else {
        Err(git_error(&output))
    }
}

/// Turn a failed Git invocation into a readable, size-capped error message.
fn git_error(output: &Output) -> String {
    let stderr = String::from_utf8_lossy(&output.stderr);
    let stderr = stderr.trim();

    if !stderr.is_empty() {
        return truncate(stderr);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let stdout = stdout.trim();

    if !stdout.is_empty() {
        return truncate(stdout);
    }

    format!("Git exited with {}.", output.status)
}

fn truncate(text: &str) -> String {
    if text.len() <= MAX_ERROR_LEN {
        return text.to_owned();
    }

    let mut end = MAX_ERROR_LEN;
    while end > 0 && !text.is_char_boundary(end) {
        end -= 1;
    }

    let mut truncated = text[..end].to_owned();
    truncated.push('…');
    truncated
}

/// Locate the repository containing the workspace and the workspace's path
/// relative to that repository root (e.g. `book/`, or an empty string).
fn repo_info(root: &Path) -> Result<Option<(PathBuf, String)>, String> {
    let output = run_git(root, &["rev-parse", "--show-toplevel", "--show-prefix"])?;

    // A `rev-parse` failure normally means the folder is not inside a work
    // tree. Anything else (for example Git's dubious-ownership check) is a real
    // error that should be shown instead of offering to initialize a repo.
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let outside_repo = stderr.contains("not a git repository")
            || stderr.contains("must be run in a work tree");

        return if outside_repo {
            Ok(None)
        } else {
            Err(git_error(&output))
        };
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut lines = text.lines();

    let Some(toplevel) = lines.next().map(str::trim) else {
        return Ok(None);
    };

    if toplevel.is_empty() {
        return Ok(None);
    }

    let prefix = lines.next().unwrap_or("").trim().to_owned();

    Ok(Some((PathBuf::from(toplevel), prefix)))
}

fn read_origin_url(root: &Path) -> Result<Option<String>, String> {
    let output = run_git(root, &["remote", "get-url", "origin"])?;

    if !output.status.success() {
        return Ok(None);
    }

    let url = String::from_utf8_lossy(&output.stdout).trim().to_owned();

    Ok((!url.is_empty()).then_some(url))
}

/// Read the repository state and the changes inside the workspace.
fn read_status(root: &Path) -> Result<GitStatus, String> {
    let Some((repo_root, prefix)) = repo_info(root)? else {
        return Ok(GitStatus {
            is_repo: false,
            repo_root: None,
            branch: None,
            detached: false,
            origin_url: None,
            ahead: 0,
            behind: 0,
            has_upstream: false,
            changes: Vec::new(),
        });
    };

    let output = run_git(
        root,
        &[
            "status",
            "--porcelain=v1",
            "-z",
            "--branch",
            "--untracked-files=all",
            "--",
            ".",
        ],
    )?;

    if !output.status.success() {
        return Err(git_error(&output));
    }

    let (info, changes) = parse_status(&output.stdout, &prefix);

    Ok(GitStatus {
        is_repo: true,
        repo_root: Some(repo_root.display().to_string()),
        branch: info.branch,
        detached: info.detached,
        origin_url: read_origin_url(root)?,
        ahead: info.ahead,
        behind: info.behind,
        has_upstream: info.has_upstream,
        changes,
    })
}

/// Parse `git status --porcelain=v1 -z --branch` output.
///
/// Paths are relative to the repository root and `prefix` is stripped so that
/// every returned path is relative to the workspace.
fn parse_status(stdout: &[u8], prefix: &str) -> (BranchInfo, Vec<GitChange>) {
    let mut info = BranchInfo::default();
    let mut changes = Vec::new();
    let mut tokens = stdout
        .split(|byte| *byte == 0)
        .filter(|token| !token.is_empty());

    if let Some(first) = tokens.next() {
        if let Some(header) = first.strip_prefix(b"## ") {
            parse_branch_header(header, &mut info);
        } else {
            parse_change(first, &mut tokens, prefix, &mut changes);
        }
    }

    while let Some(token) = tokens.next() {
        parse_change(token, &mut tokens, prefix, &mut changes);
    }

    (info, changes)
}

fn parse_branch_header(header: &[u8], info: &mut BranchInfo) {
    let text = String::from_utf8_lossy(header);
    let text = text.trim();

    if let Some(branch) = text.strip_prefix("No commits yet on ") {
        info.branch = Some(branch.to_owned());
        return;
    }

    if text == "HEAD (no branch)" {
        info.detached = true;
        return;
    }

    let (names, tracking) = match text.find(" [") {
        Some(start) => (
            &text[..start],
            Some(text[start + 2..].trim_end_matches(']')),
        ),
        None => (text, None),
    };

    match names.split_once("...") {
        Some((local, upstream)) => {
            info.branch = Some(local.to_owned());
            info.has_upstream = !upstream.is_empty() && tracking != Some("gone");
        }
        None => info.branch = Some(names.to_owned()),
    }

    let Some(tracking) = tracking else {
        return;
    };

    for part in tracking.split(',') {
        let part = part.trim();

        if let Some(count) = part.strip_prefix("ahead ") {
            info.ahead = count.parse().unwrap_or(0);
        } else if let Some(count) = part.strip_prefix("behind ") {
            info.behind = count.parse().unwrap_or(0);
        }
    }
}

fn parse_change<'a, I>(token: &'a [u8], tokens: &mut I, prefix: &str, changes: &mut Vec<GitChange>)
where
    I: Iterator<Item = &'a [u8]>,
{
    // Every entry starts with two status characters and a space.
    if token.len() < 4 || token[2] != b' ' {
        return;
    }

    let index = char::from(token[0]);
    let worktree = char::from(token[1]);
    let path = String::from_utf8_lossy(&token[3..]).into_owned();

    // In `-z` mode renames and copies put the original path in the next token.
    let mut orig_path = None;
    if (matches!(index, 'R' | 'C') || matches!(worktree, 'R' | 'C'))
        && let Some(original) = tokens.next()
    {
        orig_path = strip_path(&String::from_utf8_lossy(original), prefix);
    }

    // The path filter keeps changes inside the workspace, but a rename can
    // still reference a path outside of it.
    let Some(path) = strip_path(&path, prefix) else {
        return;
    };

    changes.push(GitChange {
        path,
        orig_path,
        index: index.to_string(),
        worktree: worktree.to_string(),
        status: overall_status(index, worktree).to_string(),
    });
}

fn strip_path(path: &str, prefix: &str) -> Option<String> {
    if prefix.is_empty() {
        return Some(path.to_owned());
    }

    path.strip_prefix(prefix).map(str::to_owned)
}

/// Collapse the two porcelain columns into one badge character.
fn overall_status(index: char, worktree: char) -> char {
    let statuses = [index, worktree];

    if statuses.contains(&'?') {
        return '?';
    }

    if statuses.contains(&'U') {
        return 'U';
    }

    // Unmerged entries can also be "both added" or "both deleted" without a
    // `U` column.
    if matches!((index, worktree), ('A', 'A') | ('D', 'D')) {
        return 'U';
    }

    if statuses.contains(&'R') {
        return 'R';
    }

    if statuses.contains(&'C') {
        return 'C';
    }

    if statuses.contains(&'D') {
        return 'D';
    }

    if statuses.contains(&'A') {
        return 'A';
    }

    if statuses.contains(&'M') || statuses.contains(&'T') {
        return 'M';
    }

    '?'
}

/// Ensure Git can attribute a commit before we create one.
fn ensure_identity(root: &Path) -> Result<(), String> {
    let name = run_git(root, &["config", "--get", "user.name"])?;

    if !name.status.success() || String::from_utf8_lossy(&name.stdout).trim().is_empty() {
        return Err("Git needs a user name before it can commit. Run:\n\
             git config --global user.name \"Your Name\""
            .to_owned());
    }

    let email = run_git(root, &["config", "--get", "user.email"])?;

    if !email.status.success() || String::from_utf8_lossy(&email.stdout).trim().is_empty() {
        return Err("Git needs an email address before it can commit. Run:\n\
             git config --global user.email \"you@example.com\""
            .to_owned());
    }

    Ok(())
}

/// Validate the repository and return its status, or an error explaining why
/// an action cannot run.
fn require_repo(root: &Path) -> Result<GitStatus, String> {
    let status = read_status(root)?;

    if !status.is_repo {
        return Err("This folder is not a Git repository.".to_owned());
    }

    Ok(status)
}

fn commit_and_push(root: &Path, message: &str) -> Result<GitActionResult, String> {
    let status = require_repo(root)?;

    if status.detached {
        return Err("Cannot commit while HEAD is detached. Check out a branch first.".to_owned());
    }

    let has_origin = status.origin_url.is_some();
    let branch = status
        .branch
        .clone()
        .ok_or_else(|| "Could not determine the current branch.".to_owned())?;
    let had_upstream = status.has_upstream;
    let had_ahead = status.ahead;

    ensure_identity(root)?;

    run_git_checked(root, &["add", "-A", "--", "."])?;

    // `diff --cached --quiet` exits with 1 when there are staged changes.
    let has_staged_changes = !run_git(root, &["diff", "--cached", "--quiet"])?
        .status
        .success();
    let mut parts = Vec::new();

    if has_staged_changes {
        run_git_checked(root, &["commit", "-m", message])?;

        let hash = run_git_checked(root, &["rev-parse", "--short", "HEAD"])
            .map_or_default(|hash| hash.trim().to_owned());

        if hash.is_empty() {
            parts.push("Committed changes.".to_owned());
        } else {
            parts.push(format!("Committed {hash}."));
        }
    } else {
        parts.push("Nothing to commit.".to_owned());
    }

    let should_push = has_staged_changes || had_ahead > 0;

    if !should_push {
        parts.push("Working tree is clean.".to_owned());

        return Ok(GitActionResult {
            message: parts.join(" "),
            status: read_status(root)?,
        });
    }

    // Without a remote the commit stays local.
    if !has_origin {
        parts.push("No remote configured, so nothing was pushed.".to_owned());

        return Ok(GitActionResult {
            message: parts.join(" "),
            status: read_status(root)?,
        });
    }

    let push_args: Vec<&str> = if had_upstream {
        vec!["push"]
    } else {
        vec!["push", "-u", "origin", &branch]
    };

    let output = run_git(root, &push_args)?;

    if !output.status.success() {
        return Err(format!(
            "{} Push failed:\n{}",
            parts.join(" "),
            git_error(&output)
        ));
    }

    parts.push(format!("Pushed to origin/{branch}."));

    Ok(GitActionResult {
        message: parts.join(" "),
        status: read_status(root)?,
    })
}

fn fetch_and_pull(root: &Path) -> Result<GitActionResult, String> {
    let status = require_repo(root)?;

    if status.detached {
        return Err("Cannot pull while HEAD is detached. Check out a branch first.".to_owned());
    }

    if status.origin_url.is_none() {
        return Err("Add an origin remote before fetching.".to_owned());
    }

    let branch = status
        .branch
        .clone()
        .ok_or_else(|| "Could not determine the current branch.".to_owned())?;

    run_git_checked(root, &["fetch", "--prune", "origin"])?;

    let output = if status.has_upstream {
        run_git(root, &["pull", "--ff-only"])?
    } else {
        run_git(root, &["pull", "--ff-only", "origin", &branch])?
    };

    if !output.status.success() {
        return Err(format!(
            "Fetched from origin, but the pull failed:\n{}",
            git_error(&output)
        ));
    }

    let summary = String::from_utf8_lossy(&output.stdout).trim().to_owned();
    let message = if summary.is_empty() {
        "Fetched and pulled from origin.".to_owned()
    } else {
        format!("Fetched and pulled from origin.\n{summary}")
    };

    Ok(GitActionResult {
        message,
        status: read_status(root)?,
    })
}

/// Return the current repository state, or `isRepo: false` when the workspace
/// is not inside a Git work tree.
#[tauri::command]
pub async fn git_status(state: tauri::State<'_, WorkspaceState>) -> Result<GitStatus, String> {
    let root = state.root()?;

    tauri::async_runtime::spawn_blocking(move || read_status(&root))
        .await
        .map_err(|error| format!("Git status task failed: {error}"))?
}

/// Initialize a repository in the workspace root.
#[tauri::command]
pub async fn git_init(state: tauri::State<'_, WorkspaceState>) -> Result<GitStatus, String> {
    let root = state.root()?;

    tauri::async_runtime::spawn_blocking(move || {
        if repo_info(&root)?.is_some() {
            return Err("This folder is already inside a Git repository.".to_owned());
        }

        run_git_checked(&root, &["init", "-b", "main"])?;

        read_status(&root)
    })
    .await
    .map_err(|error| format!("Git init task failed: {error}"))?
}

/// Add or update the `origin` remote.
#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
pub async fn git_set_origin(
    url: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<GitStatus, String> {
    let root = state.root()?;
    let url = url.trim().to_owned();

    if url.is_empty() {
        return Err("Enter a remote URL.".to_owned());
    }

    if url.starts_with('-') || url.chars().any(char::is_control) {
        return Err("That remote URL is not valid.".to_owned());
    }

    tauri::async_runtime::spawn_blocking(move || {
        require_repo(&root)?;

        let has_origin = run_git(&root, &["remote", "get-url", "origin"])?
            .status
            .success();

        if has_origin {
            run_git_checked(&root, &["remote", "set-url", "origin", &url])?;
        } else {
            run_git_checked(&root, &["remote", "add", "origin", &url])?;
        }

        read_status(&root)
    })
    .await
    .map_err(|error| format!("Git remote task failed: {error}"))?
}

/// Stage everything, commit, and push the current branch to `origin` when a
/// remote is configured. Without a remote the commit stays local.
#[tauri::command]
// Tauri passes command arguments by value, so these cannot be borrowed.
#[allow(clippy::needless_pass_by_value)]
pub async fn git_commit_push(
    message: String,
    state: tauri::State<'_, WorkspaceState>,
) -> Result<GitActionResult, String> {
    let root = state.root()?;
    let message = message.trim().to_owned();

    if message.is_empty() {
        return Err("Enter a commit message.".to_owned());
    }

    tauri::async_runtime::spawn_blocking(move || commit_and_push(&root, &message))
        .await
        .map_err(|error| format!("Git commit task failed: {error}"))?
}

/// Fetch from `origin` and fast-forward the current branch.
#[tauri::command]
pub async fn git_fetch_pull(
    state: tauri::State<'_, WorkspaceState>,
) -> Result<GitActionResult, String> {
    let root = state.root()?;

    tauri::async_runtime::spawn_blocking(move || fetch_and_pull(&root))
        .await
        .map_err(|error| format!("Git pull task failed: {error}"))?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status_of(stdout: &[u8], prefix: &str) -> (BranchInfo, Vec<GitChange>) {
        parse_status(stdout, prefix)
    }

    #[test]
    fn parses_tracked_and_untracked_changes() {
        let output = b"## main...origin/main [ahead 2, behind 1]\0 M main.tex\0?? notes.txt\0";

        let (info, changes) = status_of(output, "");

        assert_eq!(info.branch.as_deref(), Some("main"));
        assert!(info.has_upstream);
        assert_eq!(info.ahead, 2);
        assert_eq!(info.behind, 1);
        assert_eq!(changes.len(), 2);

        assert_eq!(changes[0].path, "main.tex");
        assert_eq!(changes[0].index, " ");
        assert_eq!(changes[0].worktree, "M");
        assert_eq!(changes[0].status, "M");

        assert_eq!(changes[1].path, "notes.txt");
        assert_eq!(changes[1].status, "?");
    }

    #[test]
    fn parses_staged_changes() {
        let output = b"## main\0A  added.tex\0D  removed.tex\0";

        let (info, changes) = status_of(output, "");

        assert_eq!(info.branch.as_deref(), Some("main"));
        assert!(!info.has_upstream);
        assert_eq!(changes[0].status, "A");
        assert_eq!(changes[1].status, "D");
    }

    #[test]
    fn parses_renames_new_path_first() {
        let output = b"## main\0R  chapters/new.tex\0chapters/old.tex\0";

        let (_, changes) = status_of(output, "");

        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].path, "chapters/new.tex");
        assert_eq!(changes[0].orig_path.as_deref(), Some("chapters/old.tex"));
        assert_eq!(changes[0].status, "R");
    }

    #[test]
    fn parses_unborn_and_detached_branches() {
        let (unborn, _) = status_of(b"## No commits yet on main\0?? main.tex\0", "");
        assert_eq!(unborn.branch.as_deref(), Some("main"));

        let (detached, _) = status_of(b"## HEAD (no branch)\0 M main.tex\0", "");
        assert!(detached.detached);
        assert!(detached.branch.is_none());
    }

    #[test]
    fn parses_gone_upstream() {
        let (info, _) = status_of(b"## main...origin/main [gone]\0", "");

        assert_eq!(info.branch.as_deref(), Some("main"));
        assert!(!info.has_upstream);
    }

    #[test]
    fn strips_the_workspace_prefix() {
        let output = b"## main\0 M book/chapters/intro.tex\0?? book/notes.txt\0";

        let (_, changes) = status_of(output, "book/");

        assert_eq!(changes[0].path, "chapters/intro.tex");
        assert_eq!(changes[1].path, "notes.txt");
    }

    #[test]
    fn keeps_the_original_path_when_a_rename_leaves_the_workspace() {
        let output = b"## main\0R  book/new.tex\0other/old.tex\0";

        let (_, changes) = status_of(output, "book/");

        assert_eq!(changes[0].path, "new.tex");
        assert!(changes[0].orig_path.is_none());
    }

    #[test]
    fn detects_conflicts() {
        assert_eq!(overall_status('U', 'U'), 'U');
        assert_eq!(overall_status('A', 'U'), 'U');
        assert_eq!(overall_status('A', 'A'), 'U');
        assert_eq!(overall_status('D', 'D'), 'U');
        assert_eq!(overall_status(' ', 'M'), 'M');
        assert_eq!(overall_status('?', '?'), '?');
    }
}
