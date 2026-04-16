use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::Path;

use crate::base_resolver::bundled_version;
use crate::patch::{PATCH_SCHEMA, Patch, patch_to_yaml};
use crate::types::CatalogVersion;

pub fn run_init(out: &str, force: bool) -> i32 {
    let version = bundled_version().unwrap_or(CatalogVersion {
        date: "unknown".to_string(),
        sha: "unknown".to_string(),
    });

    let starter = Patch {
        schema: PATCH_SCHEMA,
        base_version: version.clone(),
        language: None,
        root: None,
        excluded: None,
        overrides: None,
        custom: None,
    };

    let body = match patch_to_yaml(&starter) {
        Ok(y) => y,
        Err(e) => {
            eprintln!("smokepingconf: {}", e);
            return 1;
        }
    };

    let header = "\
# SmokePing config builder — patch file.
#
# Pin: this patch was initialised against the catalogue snapshot identified
# by `baseVersion`. Running `smokepingconf render <this-file>` applies the
# patch on top of that base. When upstream evolves, `smokepingconf diff-base`
# reports which of your paths drifted.
#
# Example edits — uncomment and adjust:
#
# excluded:
#   - /CDN/Akamai
#
# overrides:
#   /CDN/Cloudflare:
#     host: 1.1.1.1
#
# custom:
#   - parentPath: null
#     node:
#       type: category
#       name: MyStuff
#       menu: My Stuff
#       title: Personal targets

";

    let abs = if Path::new(out).is_absolute() {
        out.to_string()
    } else {
        std::env::current_dir()
            .unwrap()
            .join(out)
            .to_string_lossy()
            .to_string()
    };

    if !force {
        match OpenOptions::new().write(true).create_new(true).open(&abs) {
            Ok(mut f) => {
                let content = format!("{}{}", header, body);
                if let Err(e) = f.write_all(content.as_bytes()) {
                    eprintln!("smokepingconf: {}", e);
                    return 1;
                }
            }
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => {
                eprintln!("init: {} already exists (pass --force to overwrite)", out);
                return 1;
            }
            Err(e) => {
                eprintln!("smokepingconf: {}", e);
                return 1;
            }
        }
    } else {
        let content = format!("{}{}", header, body);
        if let Err(e) = fs::write(&abs, &content) {
            eprintln!("smokepingconf: {}", e);
            return 1;
        }
    }

    eprintln!(
        "init: wrote {} pinned to {} @ {}",
        out, version.date, version.sha
    );
    0
}
