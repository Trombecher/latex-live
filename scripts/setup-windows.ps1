Set-Location .\src-tauri

$env:RUSTFLAGS = "-Ctarget-feature=+crt-static"
$env:VCPKGRS_TRIPLET = "x64-windows-static-release"
$env:TECTONIC_DEP_BACKEND = "vcpkg"

cargo vcpkg build

$env:VCPKG_ROOT = Join-Path (Get-Location) "target\vcpkg"

cargo build
Set-Location ..
