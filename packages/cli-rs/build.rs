use std::fs;
use std::path::Path;

fn main() {
    let src = Path::new("../core/src/catalog.json");
    let out_dir = std::env::var("OUT_DIR").unwrap();
    let dest = Path::new(&out_dir).join("catalog.json");
    fs::copy(src, &dest).expect(
        "failed to copy catalog.json — run `npm -w @smokepingconf/core run prebuild` first",
    );
    println!("cargo:rerun-if-changed=../core/src/catalog.json");
}
