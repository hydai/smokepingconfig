use std::fs;
use std::path::Path;

use crate::base_resolver::resolve_base;
use crate::patch::{apply_patch, patch_from_yaml};

pub fn run_diff_base(
    patch_path: &str,
    base: Option<&str>,
    base_url: Option<&str>,
    on_drift: &str,
) -> i32 {
    let catalog = match resolve_base(base, base_url) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("smokepingconf: {}", e);
            return 1;
        }
    };

    let abs = if Path::new(patch_path).is_absolute() {
        patch_path.to_string()
    } else {
        std::env::current_dir()
            .unwrap()
            .join(patch_path)
            .to_string_lossy()
            .to_string()
    };
    let patch_text = match fs::read_to_string(&abs) {
        Ok(t) => t,
        Err(e) => {
            eprintln!("smokepingconf: {}: {}", patch_path, e);
            return 1;
        }
    };

    let patch = match patch_from_yaml(&patch_text) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("smokepingconf: {}", e);
            return 1;
        }
    };

    let (_, drift) = apply_patch(&patch, &catalog);

    let clean = drift.base_mismatch.is_none() && drift.missing_paths.is_empty();
    if clean {
        println!("no drift — patch applies cleanly against the current base");
        return 0;
    }

    if let Some(mm) = &drift.base_mismatch {
        let p = &mm.patch;
        println!("baseVersion mismatch:");
        println!("  patch pinned: {} @ {}", p.date, p.sha);
        if let Some(a) = &mm.actual {
            println!("  current base: {} @ {}", a.date, a.sha);
        } else {
            println!("  current base: (no version stamp)");
        }
    }

    if !drift.missing_paths.is_empty() {
        println!(
            "paths referenced by patch but missing from base ({}):",
            drift.missing_paths.len()
        );
        for p in &drift.missing_paths {
            println!("  - {}", p);
        }
    }

    if on_drift == "error" { 1 } else { 0 }
}
