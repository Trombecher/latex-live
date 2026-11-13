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
- lucide-solid (for icons);
- Kobalte UI for unstyled, accessible components;
- `nub` as the package manager.

To format and fix oxlint issues, run `nub run format`. To check your changes for
compilation errors, run `nub run check` (and not `nub run build`). It checks
TypeScript errors and linting errors.

### Lucide Import Style

Do not import directly from `"lucide-solid"`, instead import from
`"lucide-solid/icons/<icon>"` to prevent the whole lucide library from being
loaded into the web in development. All component icons imported must have a
suffix of `Icon`.

### Most important Nub package manager commands

Nub has a CLI like bun:

- install packages with `nub install <package>`;
- remove packages with `nub remove <package>`;
- run scripts with`nub run <script>`;
- execute binaries with `nub x <binary>` (replaces `npx`).

For CLI reference: `nub --help`. Do not run `npm` or `npx` or any other package
manager.

## Backend

Root crate in `src-tauri`. Frameworks and libraries:

- Rust;
- rustfmt (format each touched Rust file);
- `tectonic` crate for in-process XeLaTeX PDF rendering.

The backend has a LOT of crates (600+) so building and testing is very slow.
Build more sparingly.

## Git

**On Windows**, do not stage changes from `src-tauri/Cargo.toml` nor from
`src-tauri/Cargo.lock` if not explicitily said.
