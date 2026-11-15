use super::*;

#[test]
fn indents_list_items() {
    let source = concat!(
        "\\begin{document}\n",
        "\\begin{itemize}\n",
        "\\item one\n",
        "\\end{itemize}\n",
        "\\end{document}\n",
    );
    let expected = concat!(
        "\\begin{document}\n",
        "\\begin{itemize}\n",
        "    \\item one\n",
        "\\end{itemize}\n",
        "\\end{document}\n",
    );

    assert_eq!(format_latex(source), expected);
}

#[test]
fn preserves_lf_line_endings() {
    let formatted = format_latex("\\begin{document}\ntext\n\\end{document}\n");

    assert!(!formatted.contains('\r'));
}

#[test]
fn preserves_crlf_line_endings() {
    let formatted = format_latex("\\begin{document}\r\ntext\r\n\\end{document}\r\n");

    assert!(!formatted.replace("\r\n", "").contains('\n'));
}

#[test]
fn formatting_is_idempotent() {
    let source =
        "\\begin{document}\n\\begin{itemize}\n\\item one\n\\end{itemize}\n\\end{document}\n";
    let once = format_latex(source);

    assert_eq!(format_latex(&once), once);
}
