use std::path::Path;
use std::time::Duration;

use crate::types::*;

static BUNDLED_CATALOG_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/catalog.json"));

pub fn bundled_catalog() -> Catalog {
    serde_json::from_str(BUNDLED_CATALOG_JSON).expect("bundled catalog.json is valid")
}

pub fn bundled_version() -> Option<CatalogVersion> {
    bundled_catalog().version
}

pub fn resolve_base(base: Option<&str>, base_url: Option<&str>) -> Result<Catalog, String> {
    if let Some(path) = base {
        let abs = if Path::new(path).is_absolute() {
            path.to_string()
        } else {
            std::env::current_dir()
                .map_err(|e| e.to_string())?
                .join(path)
                .to_string_lossy()
                .to_string()
        };
        let text = std::fs::read_to_string(&abs).map_err(|e| format!("--base {}: {}", path, e))?;
        let cat: Catalog =
            serde_json::from_str(&text).map_err(|e| format!("--base {}: {}", path, e))?;
        return Ok(cat);
    }

    if let Some(url) = base_url {
        let client = reqwest::blocking::Client::builder()
            .timeout(Duration::from_secs(10))
            .build()
            .map_err(|e| format!("--base-url: {}", e))?;
        let resp = client
            .get(url)
            .send()
            .map_err(|e| format!("--base-url {}: {}", url, e))?;
        if !resp.status().is_success() {
            return Err(format!(
                "--base-url {}: HTTP {} {}",
                url,
                resp.status().as_u16(),
                resp.status().canonical_reason().unwrap_or("")
            ));
        }
        let cat: Catalog = resp
            .json()
            .map_err(|e| format!("--base-url {}: {}", url, e))?;
        return Ok(cat);
    }

    Ok(bundled_catalog())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bundled_catalog_loads() {
        let cat = bundled_catalog();
        assert_eq!(cat.schema_ver, 2);
        assert!(!cat.nodes.is_empty());
    }

    #[test]
    fn bundled_version_present() {
        let ver = bundled_version().expect("bundled version should exist");
        assert!(!ver.sha.is_empty());
    }

    #[test]
    fn resolve_base_defaults_to_bundled() {
        let cat = resolve_base(None, None).unwrap();
        assert_eq!(cat.schema_ver, 2);
    }
}
