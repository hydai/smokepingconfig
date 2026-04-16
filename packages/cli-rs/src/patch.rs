use std::collections::HashMap;

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

use crate::diff::{CustomEntry, NodeOverride, PartialRootMeta, TreeDiff, apply_diff};
use crate::tree::path_to_id;
use crate::types::*;

pub const PATCH_SCHEMA: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchNode {
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub name: String,
    pub menu: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub included: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probe: Option<Probe>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparison_children: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra: Option<IndexMap<String, String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub children: Option<Vec<PatchNode>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchCustomEntry {
    pub parent_path: Option<String>,
    pub node: PatchNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Patch {
    pub schema: u8,
    pub base_version: CatalogVersion,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<Language>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub root: Option<PartialRootMeta>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub excluded: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overrides: Option<HashMap<String, NodeOverride>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom: Option<Vec<PatchCustomEntry>>,
}

pub struct BaseMismatch {
    pub patch: CatalogVersion,
    pub actual: Option<CatalogVersion>,
}

pub struct DriftReport {
    pub missing_paths: Vec<String>,
    pub base_mismatch: Option<BaseMismatch>,
}

pub fn apply_patch(patch: &Patch, base: &Catalog) -> (WorkingTree, DriftReport) {
    let mut drift = DriftReport {
        missing_paths: Vec::new(),
        base_mismatch: None,
    };

    if let Some(base_ver) = &base.version {
        if base_ver.sha != patch.base_version.sha {
            drift.base_mismatch = Some(BaseMismatch {
                patch: patch.base_version.clone(),
                actual: Some(base_ver.clone()),
            });
        }
    }

    let mut diff = TreeDiff {
        lang: patch.language.clone(),
        root: patch.root.clone(),
        ex: None,
        ov: None,
        cu: None,
    };

    if let Some(excluded) = &patch.excluded {
        let mut ids = Vec::new();
        for p in excluded {
            match path_to_id(&base.nodes, p) {
                Some(id) => ids.push(id),
                None => drift.missing_paths.push(p.clone()),
            }
        }
        if !ids.is_empty() {
            diff.ex = Some(ids);
        }
    }

    if let Some(overrides) = &patch.overrides {
        let mut ov = HashMap::new();
        for (path, ovr) in overrides {
            match path_to_id(&base.nodes, path) {
                Some(id) => {
                    ov.insert(id, ovr.clone());
                }
                None => drift.missing_paths.push(path.clone()),
            }
        }
        if !ov.is_empty() {
            diff.ov = Some(ov);
        }
    }

    if let Some(custom) = &patch.custom {
        let mut cu = Vec::new();
        for entry in custom {
            let mut parent_id: Option<String> = None;
            if let Some(pp) = &entry.parent_path {
                match path_to_id(&base.nodes, pp) {
                    Some(id) => parent_id = Some(id),
                    None => {
                        drift.missing_paths.push(pp.clone());
                    }
                }
            }
            cu.push(CustomEntry {
                parent_id,
                node: from_patch_node(&entry.node),
            });
        }
        if !cu.is_empty() {
            diff.cu = Some(cu);
        }
    }

    let tree = apply_diff(&diff, base);
    (tree, drift)
}

fn from_patch_node(p: &PatchNode) -> Node {
    Node {
        id: format!("x:{}", uuid::Uuid::new_v4()),
        source: NodeSource::Custom,
        node_type: p.node_type.clone(),
        name: p.name.clone(),
        menu: p.menu.clone(),
        title: p.title.clone(),
        included: p.included.unwrap_or(true),
        children: p
            .children
            .as_ref()
            .map(|c| c.iter().map(from_patch_node).collect())
            .unwrap_or_default(),
        host: p.host.clone(),
        probe: p.probe.clone(),
        comparison_children: p.comparison_children.clone(),
        extra_attrs: p.extra.clone(),
    }
}

pub fn patch_to_yaml(patch: &Patch) -> Result<String, String> {
    serde_yaml_ng::to_string(patch).map_err(|e| e.to_string())
}

pub fn patch_from_yaml(text: &str) -> Result<Patch, String> {
    let parsed: serde_yaml_ng::Value = serde_yaml_ng::from_str(text).map_err(|e| e.to_string())?;

    if !parsed.is_mapping() {
        return Err("not a YAML mapping".to_string());
    }

    let schema = parsed
        .get("schema")
        .and_then(|v| v.as_u64())
        .ok_or_else(|| "missing schema".to_string())?;

    if schema != PATCH_SCHEMA as u64 {
        return Err(format!(
            "unsupported schema (got {}, expected {})",
            schema, PATCH_SCHEMA
        ));
    }

    let base_version = parsed.get("baseVersion");
    if base_version.is_none()
        || !base_version
            .unwrap()
            .get("sha")
            .map(|v| v.is_string())
            .unwrap_or(false)
    {
        return Err("missing or malformed baseVersion".to_string());
    }

    serde_yaml_ng::from_str(text).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tree::find_node;

    static CATALOG_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/catalog.json"));

    fn catalog() -> Catalog {
        serde_json::from_str(CATALOG_JSON).unwrap()
    }

    fn version() -> CatalogVersion {
        catalog().version.unwrap()
    }

    fn minimal_patch() -> Patch {
        Patch {
            schema: PATCH_SCHEMA,
            base_version: version(),
            language: None,
            root: None,
            excluded: None,
            overrides: None,
            custom: None,
        }
    }

    #[test]
    fn fresh_tree_produces_minimal_patch_yaml() {
        let patch = minimal_patch();
        let yaml = patch_to_yaml(&patch).unwrap();
        assert!(yaml.contains("schema: 1"));
        assert!(yaml.contains("baseVersion"));
    }

    #[test]
    fn apply_minimal_patch_no_drift() {
        let cat = catalog();
        let patch = minimal_patch();
        let (tree, drift) = apply_patch(&patch, &cat);
        assert!(drift.missing_paths.is_empty());
        assert!(drift.base_mismatch.is_none());
        assert_eq!(tree.nodes.len(), cat.nodes.len());
    }

    #[test]
    fn apply_patch_with_exclusion() {
        let cat = catalog();
        let patch = Patch {
            excluded: Some(vec!["/CDN/Cloudflare".to_string()]),
            ..minimal_patch()
        };
        let (tree, drift) = apply_patch(&patch, &cat);
        assert!(drift.missing_paths.is_empty());
        let cf = find_node(&tree.nodes, "c:CDN/Cloudflare").unwrap();
        assert!(!cf.included);
    }

    #[test]
    fn apply_patch_with_override() {
        let cat = catalog();
        let mut overrides = HashMap::new();
        overrides.insert(
            "/CDN/Cloudflare".to_string(),
            NodeOverride {
                host: Some(Some("1.1.1.1".to_string())),
                ..Default::default()
            },
        );
        let patch = Patch {
            overrides: Some(overrides),
            ..minimal_patch()
        };
        let (tree, _) = apply_patch(&patch, &cat);
        let cf = find_node(&tree.nodes, "c:CDN/Cloudflare").unwrap();
        assert_eq!(cf.host.as_deref(), Some("1.1.1.1"));
    }

    #[test]
    fn missing_paths_reported_as_drift() {
        let cat = catalog();
        let patch = Patch {
            excluded: Some(vec!["/CDN/DoesNotExist".to_string()]),
            ..minimal_patch()
        };
        let (_, drift) = apply_patch(&patch, &cat);
        assert_eq!(drift.missing_paths, vec!["/CDN/DoesNotExist"]);
    }

    #[test]
    fn base_version_mismatch_reported() {
        let cat = catalog();
        let patch = Patch {
            base_version: CatalogVersion {
                date: "2020-01-01".to_string(),
                sha: "aaaaaaa".to_string(),
            },
            ..minimal_patch()
        };
        let (_, drift) = apply_patch(&patch, &cat);
        let mm = drift.base_mismatch.unwrap();
        assert_eq!(mm.patch.sha, "aaaaaaa");
    }

    #[test]
    fn no_base_mismatch_when_sha_matches() {
        let cat = catalog();
        let patch = minimal_patch();
        let (_, drift) = apply_patch(&patch, &cat);
        assert!(drift.base_mismatch.is_none());
    }

    #[test]
    fn yaml_round_trip() {
        let patch = Patch {
            excluded: Some(vec!["/CDN/Akamai".to_string()]),
            ..minimal_patch()
        };
        let yaml = patch_to_yaml(&patch).unwrap();
        let parsed = patch_from_yaml(&yaml).unwrap();
        assert_eq!(parsed.schema, PATCH_SCHEMA);
        assert_eq!(parsed.excluded.as_ref().unwrap(), &["/CDN/Akamai"]);
    }

    #[test]
    fn patch_from_yaml_rejects_wrong_schema() {
        let yaml = "schema: 99\nbaseVersion:\n  date: x\n  sha: y\n";
        let err = patch_from_yaml(yaml).unwrap_err();
        assert!(err.contains("unsupported schema"));
    }

    #[test]
    fn patch_from_yaml_rejects_missing_base_version() {
        let yaml = "schema: 1\n";
        let err = patch_from_yaml(yaml).unwrap_err();
        assert!(err.contains("baseVersion"));
    }

    #[test]
    fn custom_nodes_round_trip_through_yaml() {
        let patch = Patch {
            custom: Some(vec![PatchCustomEntry {
                parent_path: None,
                node: PatchNode {
                    node_type: NodeType::Category,
                    name: "MyStuff".to_string(),
                    menu: "My Stuff".to_string(),
                    title: "Personal".to_string(),
                    included: None,
                    host: None,
                    probe: None,
                    comparison_children: None,
                    extra: None,
                    children: None,
                },
            }]),
            ..minimal_patch()
        };
        let yaml = patch_to_yaml(&patch).unwrap();
        let parsed = patch_from_yaml(&yaml).unwrap();
        let custom = parsed.custom.unwrap();
        assert_eq!(custom.len(), 1);
        assert_eq!(custom[0].node.name, "MyStuff");
    }
}
