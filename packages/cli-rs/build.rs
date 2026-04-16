use std::fs;
use std::path::Path;

fn main() {
    // Prefer the workspace-relative path (normal local/CI builds). Fall back to
    // a crate-local copy for cross builds, which mount only the crate directory
    // into the Docker container — the parent `../core/` path is not visible
    // there. CI pre-stages `catalog.json` into the crate root for cross jobs.
    let workspace_src = Path::new("../core/src/catalog.json");
    let local_src = Path::new("catalog.json");

    let src = if workspace_src.exists() {
        println!("cargo:rerun-if-changed=../core/src/catalog.json");
        workspace_src
    } else if local_src.exists() {
        println!("cargo:rerun-if-changed=catalog.json");
        local_src
    } else {
        panic!(
            "catalog.json not found — run `npm -w @smokepingconf/core run prebuild` \
             from the repo root, or stage catalog.json into packages/cli-rs/"
        );
    };

    let out_dir = std::env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("catalog.json");
    fs::copy(src, &dest).expect("failed to copy catalog.json into OUT_DIR");
}
