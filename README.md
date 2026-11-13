# Latex Live

Cross-platform LaTeX editor with live PDF preview.

## Building

To build you need [`nub`](https://nubjs.com/) and [Rust](https://rustup.rs/),
the newest version if possible.

Due to a bug in cargo-vcpkg, we have to use a custom version of tectonic. Pull
down [my tectonic fork](https://github.com/Trombecher/contribute-tectonic) and
adjust the tectonic paths in the [`Cargo.toml`](./src-tauri/Cargo.toml).
Technically you only need this when building on windows; on linux you can just
insert the latest versions from crates.io.

### Building on Windows

Tectonic requires some dependencies. It is easiest to install them with vcpkg
(via `cargo-vcpkg`):

```powershell
cargo install cargo-vcpkg
```

Then run [`./scripts/setup-windows.ps1`](scripts\setup-windows.ps1).

### Building on Linux

Tauri requires [some libraries](https://tauri.app/start/prerequisites/#linux).
Install them. Tectonic (LaTeX to PDF conversion library) also needs some
libraries. On Linux, it is easy to just
[install them globally](https://tectonic-typesetting.github.io/book/latest/howto/build-tectonic/external-dep-install.html).
