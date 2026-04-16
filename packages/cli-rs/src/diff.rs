use std::collections::HashMap;

use serde::{Deserialize, Serialize};

use crate::tree::{find_node_mut, fresh_tree};
use crate::types::*;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NodeOverride {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub menu: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<Option<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probe: Option<Option<Probe>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparison_children: Option<Option<Vec<String>>>,
}

#[derive(Debug, Clone)]
pub struct CustomEntry {
    pub parent_id: Option<String>,
    pub node: Node,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PartialRootMeta {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probe: Option<ProbeKind>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub menu: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remark: Option<String>,
}

pub struct TreeDiff {
    pub lang: Option<Language>,
    pub root: Option<PartialRootMeta>,
    pub ex: Option<Vec<String>>,
    pub ov: Option<HashMap<String, NodeOverride>>,
    pub cu: Option<Vec<CustomEntry>>,
}

pub fn apply_diff(diff: &TreeDiff, base: &Catalog) -> WorkingTree {
    let lang = diff.lang.clone().unwrap_or_default();
    let mut tree = fresh_tree(base, lang);

    if let Some(root) = &diff.root {
        if let Some(probe) = &root.probe {
            tree.root.probe = probe.clone();
        }
        if let Some(menu) = &root.menu {
            tree.root.menu = menu.clone();
        }
        if let Some(title) = &root.title {
            tree.root.title = title.clone();
        }
        if let Some(remark) = &root.remark {
            tree.root.remark = Some(remark.clone());
        }
    }

    if let Some(ex) = &diff.ex {
        for id in ex {
            if let Some(n) = find_node_mut(&mut tree.nodes, id) {
                n.included = false;
            }
        }
    }

    if let Some(ov) = &diff.ov {
        for (id, ovr) in ov {
            if let Some(n) = find_node_mut(&mut tree.nodes, id) {
                if let Some(name) = &ovr.name {
                    n.name = name.clone();
                }
                if let Some(menu) = &ovr.menu {
                    n.menu = menu.clone();
                }
                if let Some(title) = &ovr.title {
                    n.title = title.clone();
                }
                if let Some(host_opt) = &ovr.host {
                    n.host = host_opt.clone();
                }
                if let Some(probe_opt) = &ovr.probe {
                    n.probe = probe_opt.clone();
                }
                if let Some(cc_opt) = &ovr.comparison_children {
                    n.comparison_children = cc_opt.clone();
                }
            }
        }
    }

    if let Some(cu) = &diff.cu {
        for entry in cu {
            let node = entry.node.clone();
            if let Some(pid) = &entry.parent_id {
                if let Some(parent) = find_node_mut(&mut tree.nodes, pid) {
                    parent.children.push(node);
                } else {
                    tree.nodes.push(node);
                }
            } else {
                tree.nodes.push(node);
            }
        }
    }

    tree
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tree::find_node;

    static CATALOG_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/catalog.json"));

    fn catalog() -> Catalog {
        serde_json::from_str(CATALOG_JSON).unwrap()
    }

    #[test]
    fn empty_diff_produces_fresh_tree() {
        let cat = catalog();
        let diff = TreeDiff {
            lang: None,
            root: None,
            ex: None,
            ov: None,
            cu: None,
        };
        let tree = apply_diff(&diff, &cat);
        assert_eq!(tree.language, Language::En);
        assert_eq!(tree.nodes.len(), cat.nodes.len());
    }

    #[test]
    fn diff_applies_exclusions() {
        let cat = catalog();
        let diff = TreeDiff {
            lang: None,
            root: None,
            ex: Some(vec!["c:CDN/Cloudflare".to_string()]),
            ov: None,
            cu: None,
        };
        let tree = apply_diff(&diff, &cat);
        let cf = find_node(&tree.nodes, "c:CDN/Cloudflare").unwrap();
        assert!(!cf.included);
    }

    #[test]
    fn diff_applies_overrides() {
        let cat = catalog();
        let mut ov = HashMap::new();
        ov.insert(
            "c:CDN/Cloudflare".to_string(),
            NodeOverride {
                host: Some(Some("1.1.1.1".to_string())),
                ..Default::default()
            },
        );
        let diff = TreeDiff {
            lang: None,
            root: None,
            ex: None,
            ov: Some(ov),
            cu: None,
        };
        let tree = apply_diff(&diff, &cat);
        let cf = find_node(&tree.nodes, "c:CDN/Cloudflare").unwrap();
        assert_eq!(cf.host.as_deref(), Some("1.1.1.1"));
    }

    #[test]
    fn diff_override_clears_host() {
        let cat = catalog();
        let mut ov = HashMap::new();
        ov.insert(
            "c:CDN/Cloudflare".to_string(),
            NodeOverride {
                host: Some(None),
                ..Default::default()
            },
        );
        let diff = TreeDiff {
            lang: None,
            root: None,
            ex: None,
            ov: Some(ov),
            cu: None,
        };
        let tree = apply_diff(&diff, &cat);
        let cf = find_node(&tree.nodes, "c:CDN/Cloudflare").unwrap();
        assert!(cf.host.is_none());
    }

    #[test]
    fn diff_appends_custom_to_root() {
        let cat = catalog();
        let custom = Node {
            id: "x:test-uuid".to_string(),
            source: NodeSource::Custom,
            node_type: NodeType::Category,
            name: "MyStuff".to_string(),
            menu: "My Stuff".to_string(),
            title: "Personal".to_string(),
            included: true,
            children: vec![],
            host: None,
            probe: None,
            comparison_children: None,
            extra_attrs: None,
        };
        let diff = TreeDiff {
            lang: None,
            root: None,
            ex: None,
            ov: None,
            cu: Some(vec![CustomEntry {
                parent_id: None,
                node: custom,
            }]),
        };
        let tree = apply_diff(&diff, &cat);
        assert_eq!(tree.nodes.len(), cat.nodes.len() + 1);
        let last = tree.nodes.last().unwrap();
        assert_eq!(last.name, "MyStuff");
    }

    #[test]
    fn diff_appends_custom_under_parent() {
        let cat = catalog();
        let custom = Node {
            id: "x:test-uuid".to_string(),
            source: NodeSource::Custom,
            node_type: NodeType::Target,
            name: "MyTarget".to_string(),
            menu: "My Target".to_string(),
            title: "Custom target".to_string(),
            included: true,
            children: vec![],
            host: Some("example.com".to_string()),
            probe: None,
            comparison_children: None,
            extra_attrs: None,
        };
        let diff = TreeDiff {
            lang: None,
            root: None,
            ex: None,
            ov: None,
            cu: Some(vec![CustomEntry {
                parent_id: Some("c:CDN".to_string()),
                node: custom,
            }]),
        };
        let tree = apply_diff(&diff, &cat);
        let cdn = find_node(&tree.nodes, "c:CDN").unwrap();
        let last_child = cdn.children.last().unwrap();
        assert_eq!(last_child.name, "MyTarget");
    }

    #[test]
    fn diff_sets_language() {
        let cat = catalog();
        let diff = TreeDiff {
            lang: Some(Language::ZhTw),
            root: None,
            ex: None,
            ov: None,
            cu: None,
        };
        let tree = apply_diff(&diff, &cat);
        assert_eq!(tree.language, Language::ZhTw);
    }
}
