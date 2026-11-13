# Latex Live Agent Information

This is a crossplatform desktop app to edit and compile latex. It is a Tauri V2
app.

## Frontend

Root in `.`, source in `src`. Frameworks and libraries:

- Vite;
- SolidJS;
- TailwindCSS;
- oxfmt (format each touched non-.rs file);
- oxlint;
- Kobalte UI for unstyled, accessible components;
- `nub` as the package manager.

To check your changes for compilation errors, run `nub run check` (and not
`nub run build`). It checks TypeScript errors and linting errors.

### Most important Nub package manager commands

Interface like bun: `nub install <package>`, `nub remove <package>`,
`nub run <script>`, ... For CLI reference: `nub --help`.

## Backend

Root crate in `src-tauri`. Frameworks and libraries:

- Rust;
- rustfmt (format each touched Rust file);
- `tectonic` crate for in-process XeLaTeX PDF rendering.

## Git

**On Windows**, do not stage changes from `src-tauri/Cargo.toml` nor from
`src-tauri/Cargo.lock` if not explicitily said.
