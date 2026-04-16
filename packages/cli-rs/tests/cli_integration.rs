use std::fs;
use std::path::PathBuf;

use assert_cmd::Command;
use tempfile::TempDir;

fn cli() -> Command {
    Command::cargo_bin("smokepingconf").unwrap()
}

fn catalog_json() -> &'static str {
    include_str!(concat!(env!("OUT_DIR"), "/catalog.json"))
}

fn catalog_sha() -> String {
    let v: serde_json::Value = serde_json::from_str(catalog_json()).unwrap();
    v["version"]["sha"].as_str().unwrap().to_string()
}

fn catalog_date() -> String {
    let v: serde_json::Value = serde_json::from_str(catalog_json()).unwrap();
    v["version"]["date"].as_str().unwrap().to_string()
}

fn happy_patch_yaml() -> String {
    format!(
        r#"schema: 1
baseVersion:
  date: {}
  sha: {}
excluded:
  - /CDN/Akamai
overrides:
  /CDN/Cloudflare:
    host: 1.1.1.1
"#,
        catalog_date(),
        catalog_sha()
    )
}

fn drift_patch_yaml() -> String {
    format!(
        r#"schema: 1
baseVersion:
  date: {}
  sha: {}
excluded:
  - /CDN/DoesNotExist
"#,
        catalog_date(),
        catalog_sha()
    )
}

fn base_mismatch_patch_yaml() -> String {
    r#"schema: 1
baseVersion:
  date: 2020-01-01
  sha: aaaaaaa
"#
    .to_string()
}

fn write_patch(dir: &TempDir, name: &str, contents: &str) -> PathBuf {
    let path = dir.path().join(name);
    fs::write(&path, contents).unwrap();
    path
}

// -----------------------------------------------------------------------------
// Bootstrap
// -----------------------------------------------------------------------------

#[test]
fn version_prints_cli_and_bundled_catalog_stamp() {
    let out = cli().arg("--version").output().unwrap();
    let stdout = String::from_utf8(out.stdout).unwrap();
    assert!(stdout.contains("smokepingconf v"));
    assert!(stdout.contains("bundled catalog"));
}

#[test]
fn help_lists_all_three_subcommands() {
    let out = cli().arg("--help").output().unwrap();
    let stdout = String::from_utf8(out.stdout).unwrap();
    assert!(stdout.contains("render"));
    assert!(stdout.contains("diff-base"));
    assert!(stdout.contains("init"));
}

// -----------------------------------------------------------------------------
// render
// -----------------------------------------------------------------------------

#[test]
fn render_happy_path_to_stdout() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "happy.yaml", &happy_patch_yaml());
    let out = cli()
        .args(["render", patch.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8(out.stdout).unwrap();
    assert!(stdout.contains("*** Targets ***"));
    assert!(!stdout.contains("++ Akamai"));
    assert!(stdout.contains("host = 1.1.1.1"));
}

#[test]
fn render_out_writes_file_and_stderr_summary() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "happy.yaml", &happy_patch_yaml());
    let out_path = dir.path().join("Targets");
    let out = cli()
        .args([
            "render",
            patch.to_str().unwrap(),
            "--out",
            out_path.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    assert!(String::from_utf8(out.stdout).unwrap().is_empty());
    assert!(String::from_utf8(out.stderr).unwrap().contains("wrote"));
    let contents = fs::read_to_string(&out_path).unwrap();
    assert!(contents.contains("*** Targets ***"));
}

#[test]
fn render_drift_warn_default() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "drift.yaml", &drift_patch_yaml());
    let out = cli()
        .args(["render", patch.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stderr = String::from_utf8(out.stderr).unwrap();
    assert!(stderr.contains("warning"));
    assert!(stderr.contains("/CDN/DoesNotExist"));
    let stdout = String::from_utf8(out.stdout).unwrap();
    assert!(stdout.contains("*** Targets ***"));
}

#[test]
fn render_drift_error_exits_1() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "drift.yaml", &drift_patch_yaml());
    let out = cli()
        .args(["render", patch.to_str().unwrap(), "--on-drift", "error"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(1));
    let stderr = String::from_utf8(out.stderr).unwrap();
    assert!(stderr.contains("error"));
    assert!(stderr.contains("/CDN/DoesNotExist"));
}

#[test]
fn render_drift_ignore_silent() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "drift.yaml", &drift_patch_yaml());
    let out = cli()
        .args(["render", patch.to_str().unwrap(), "--on-drift", "ignore"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    assert!(String::from_utf8(out.stderr).unwrap().is_empty());
    assert!(
        String::from_utf8(out.stdout)
            .unwrap()
            .contains("*** Targets ***")
    );
}

#[test]
fn render_base_version_mismatch_error() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "mismatch.yaml", &base_mismatch_patch_yaml());
    let out = cli()
        .args(["render", patch.to_str().unwrap(), "--on-drift", "error"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(1));
    let stderr = String::from_utf8(out.stderr).unwrap();
    assert!(stderr.contains("baseVersion mismatch"));
    assert!(stderr.contains("aaaaaaa"));
}

#[test]
fn render_unknown_on_drift_exits_2() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "happy.yaml", &happy_patch_yaml());
    let out = cli()
        .args(["render", patch.to_str().unwrap(), "--on-drift", "nope"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(2));
    assert!(
        String::from_utf8(out.stderr)
            .unwrap()
            .contains("--on-drift")
    );
}

// -----------------------------------------------------------------------------
// diff-base
// -----------------------------------------------------------------------------

#[test]
fn diff_base_clean() {
    let dir = tempfile::tempdir().unwrap();
    let patch_yaml = format!(
        "schema: 1\nbaseVersion:\n  date: {}\n  sha: {}\n",
        catalog_date(),
        catalog_sha()
    );
    let patch = write_patch(&dir, "clean.yaml", &patch_yaml);
    let out = cli()
        .args(["diff-base", patch.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    assert!(String::from_utf8(out.stdout).unwrap().contains("no drift"));
}

#[test]
fn diff_base_missing_paths_exits_0_by_default() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "drift.yaml", &drift_patch_yaml());
    let out = cli()
        .args(["diff-base", patch.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    let stdout = String::from_utf8(out.stdout).unwrap();
    assert!(stdout.contains("/CDN/DoesNotExist"));
    assert!(stdout.contains("missing from base"));
}

#[test]
fn diff_base_error_mode_exits_1() {
    let dir = tempfile::tempdir().unwrap();
    let patch = write_patch(&dir, "mismatch.yaml", &base_mismatch_patch_yaml());
    let out = cli()
        .args(["diff-base", patch.to_str().unwrap(), "--on-drift", "error"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(1));
    assert!(
        String::from_utf8(out.stdout)
            .unwrap()
            .contains("baseVersion mismatch")
    );
}

// -----------------------------------------------------------------------------
// init
// -----------------------------------------------------------------------------

#[test]
fn init_writes_default_patch_yaml() {
    let dir = tempfile::tempdir().unwrap();
    let out = cli().arg("init").current_dir(dir.path()).output().unwrap();
    assert_eq!(out.status.code(), Some(0));
    let patch_path = dir.path().join("patch.yaml");
    let content = fs::read_to_string(&patch_path).unwrap();
    assert!(content.contains("schema: 1"));
    assert!(content.contains("baseVersion"));
    assert!(content.contains(&catalog_sha()));
    assert!(content.contains("# Example edits"));
}

#[test]
fn init_honours_out_flag() {
    let dir = tempfile::tempdir().unwrap();
    let out_path = dir.path().join("my.patch.yml");
    let out = cli()
        .args(["init", "--out", out_path.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    assert!(out_path.exists());
}

#[test]
fn init_refuses_to_clobber() {
    let dir = tempfile::tempdir().unwrap();
    let out_path = dir.path().join("patch.yaml");
    fs::write(&out_path, "existing content").unwrap();
    let out = cli()
        .args(["init", "--out", out_path.to_str().unwrap()])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(1));
    assert!(
        String::from_utf8(out.stderr)
            .unwrap()
            .contains("already exists")
    );
    assert_eq!(fs::read_to_string(&out_path).unwrap(), "existing content");
}

#[test]
fn init_force_overwrites() {
    let dir = tempfile::tempdir().unwrap();
    let out_path = dir.path().join("patch.yaml");
    fs::write(&out_path, "stale").unwrap();
    let out = cli()
        .args(["init", "--out", out_path.to_str().unwrap(), "--force"])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    assert!(fs::read_to_string(&out_path).unwrap().contains("schema: 1"));
}

// -----------------------------------------------------------------------------
// --base file
// -----------------------------------------------------------------------------

#[test]
fn render_with_base_file() {
    let dir = tempfile::tempdir().unwrap();
    let base_path = dir.path().join("base.json");
    fs::write(&base_path, catalog_json()).unwrap();
    let patch = write_patch(&dir, "happy.yaml", &happy_patch_yaml());
    let out = cli()
        .args([
            "render",
            patch.to_str().unwrap(),
            "--base",
            base_path.to_str().unwrap(),
        ])
        .output()
        .unwrap();
    assert_eq!(out.status.code(), Some(0));
    assert!(
        String::from_utf8(out.stdout)
            .unwrap()
            .contains("*** Targets ***")
    );
}
