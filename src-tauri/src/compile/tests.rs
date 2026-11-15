use super::{Diagnostic, Severity, normalize_file, parse_location};
use std::path::Path;

#[test]
fn normalizes_reported_paths() {
    let root = Path::new("/work/doc");

    assert_eq!(
        normalize_file("main.tex", root, "main.tex", "chapters/main.tex"),
        "chapters/main.tex"
    );
    assert_eq!(
        normalize_file(
            "/work/doc/chapters/intro.tex",
            root,
            "main.tex",
            "chapters/main.tex"
        ),
        "chapters/intro.tex"
    );
    assert_eq!(
        normalize_file("./main.tex", root, "main.tex", "main.tex"),
        "main.tex"
    );
    assert_eq!(
        normalize_file("/work/documents/main.tex", root, "main.tex", "main.tex"),
        "/work/documents/main.tex"
    );
}

#[test]
fn parses_locations() {
    assert_eq!(
        parse_location("main.tex:42: Undefined control sequence."),
        Some(("main.tex", 42, "Undefined control sequence."))
    );
    assert_eq!(
        parse_location("chapters/intro.tex:7: Missing $ inserted."),
        Some(("chapters/intro.tex", 7, "Missing $ inserted."))
    );
    assert_eq!(
        parse_location(r"C:\docs\main.tex:3: Bad thing"),
        Some((r"C:\docs\main.tex", 3, "Bad thing"))
    );
    assert_eq!(parse_location("error: something else"), None);
    assert_eq!(parse_location("main.tex: no line"), None);
}

#[test]
#[ignore = "downloads and caches the Tectonic resource bundle on first run"]
fn compiles_a_minimal_document() {
    let pdf = super::compile(
        r"\documentclass{article}
\begin{document}
Hello, LaTeX Live!
\end{document}",
        std::path::Path::new("."),
        "main.tex",
        "main.tex",
    )
    .expect("compilation should succeed");

    assert!(pdf.starts_with(b"%PDF"), "output should be a PDF");
}

#[test]
fn diagnostic_is_serializable() {
    let diagnostic = Diagnostic {
        file: "main.tex".to_owned(),
        line: 1,
        message: "Oops".to_owned(),
        severity: Severity::Error,
    };

    let json = serde_json::to_string(&diagnostic).unwrap();
    assert!(json.contains(r#""severity":"error""#));
    assert!(json.contains(r#""line":1"#));
}
