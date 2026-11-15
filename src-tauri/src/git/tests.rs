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
