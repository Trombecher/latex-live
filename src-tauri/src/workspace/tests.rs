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
