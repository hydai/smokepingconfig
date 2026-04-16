use std::fs;
use std::io::Write;
use std::path::Path;

use crate::base_resolver::resolve_base;
use crate::patch::{DriftReport, apply_patch, patch_from_yaml};
use crate::serializer::serialize_catalog;
use crate::types::Catalog;

#[derive(Clone, Copy, PartialEq)]
pub enum DriftMode {
    Ignore,
    Warn,
    Error,
}

pub fn parse_drift_mode(s: &str) -> Option<DriftMode> {
    match s {
        "ignore" => Some(DriftMode::Ignore),
        "warn" => Some(DriftMode::Warn),
        "error" => Some(DriftMode::Error),
        _ => None,
    }
}

pub fn run_render(
    patch_path: &str,
    base: Option<&str>,
    base_url: Option<&str>,
    on_drift: &str,
    out: Option<&str>,
) -> i32 {
    let drift_mode = match parse_drift_mode(on_drift) {
        Some(m) => m,
        None => {
            eprintln!(
                "render: --on-drift must be one of ignore | warn | error, got {:?}",
                on_drift
            );
            return 2;
        }
    };

    let catalog = match resolve_base(base, base_url) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("smokeping-config: {}", e);
            return 1;
        }
    };

    let patch_text = match read_patch_file(patch_path) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("smokeping-config: {}", e);
            return 1;
        }
    };

    let patch = match patch_from_yaml(&patch_text) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("smokeping-config: {}", e);
            return 1;
        }
    };

    let (tree, drift) = apply_patch(&patch, &catalog);

    let drift_lines = format_drift(&drift);
    if !drift_lines.is_empty() {
        if drift_mode == DriftMode::Error {
            for line in &drift_lines {
                eprintln!("error: {}", line);
            }
            eprintln!("render: aborting due to drift (--on-drift=error)");
            return 1;
        }
        if drift_mode == DriftMode::Warn {
            for line in &drift_lines {
                eprintln!("warning: {}", line);
            }
        }
    }

    let catalog_view = Catalog {
        schema_ver: tree.schema_ver,
        root: tree.root,
        nodes: tree.nodes,
        version: tree.version,
    };
    let targets = serialize_catalog(&catalog_view);

    if let Some(out_path) = out {
        let abs = if Path::new(out_path).is_absolute() {
            out_path.to_string()
        } else {
            std::env::current_dir()
                .unwrap()
                .join(out_path)
                .to_string_lossy()
                .to_string()
        };
        if let Err(e) = fs::write(&abs, &targets) {
            eprintln!("smokeping-config: {}", e);
            return 1;
        }
        eprintln!("render: wrote {} ({} bytes)", out_path, targets.len());
    } else {
        let _ = std::io::stdout().write_all(targets.as_bytes());
    }

    0
}

fn read_patch_file(path: &str) -> Result<String, String> {
    let abs = if Path::new(path).is_absolute() {
        path.to_string()
    } else {
        std::env::current_dir()
            .map_err(|e| e.to_string())?
            .join(path)
            .to_string_lossy()
            .to_string()
    };
    fs::read_to_string(&abs).map_err(|e| format!("{}: {}", path, e))
}

pub fn format_drift(drift: &DriftReport) -> Vec<String> {
    let mut lines = Vec::new();
    if let Some(mm) = &drift.base_mismatch {
        let p = &mm.patch;
        let msg = if let Some(a) = &mm.actual {
            format!(
                "baseVersion mismatch: patch pinned {} @ {}, current base is {} @ {}",
                p.date, p.sha, a.date, a.sha
            )
        } else {
            format!(
                "baseVersion mismatch: patch pinned {} @ {}, current base has no version stamp",
                p.date, p.sha
            )
        };
        lines.push(msg);
    }
    for p in &drift.missing_paths {
        lines.push(format!("path not present in base: {}", p));
    }
    lines
}
