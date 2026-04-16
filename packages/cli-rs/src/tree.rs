#![allow(dead_code)]

use crate::types::*;

pub fn fresh_tree(base: &Catalog, language: Language) -> WorkingTree {
    WorkingTree {
        schema_ver: base.schema_ver,
        root: base.root.clone(),
        nodes: base.nodes.clone(),
        version: base.version.clone(),
        language,
    }
}

pub fn find_node<'a>(nodes: &'a [Node], id: &str) -> Option<&'a Node> {
    for n in nodes {
        if n.id == id {
            return Some(n);
        }
        if let Some(hit) = find_node(&n.children, id) {
            return Some(hit);
        }
    }
    None
}

pub fn find_node_mut<'a>(nodes: &'a mut [Node], id: &str) -> Option<&'a mut Node> {
    for n in nodes {
        if n.id == id {
            return Some(n);
        }
        if let Some(hit) = find_node_mut(&mut n.children, id) {
            return Some(hit);
        }
    }
    None
}

pub fn walk_nodes<F>(nodes: &[Node], visit: &mut F)
where
    F: FnMut(&Node),
{
    for n in nodes {
        visit(n);
        walk_nodes(&n.children, visit);
    }
}

pub fn id_to_path(nodes: &[Node], id: &str) -> Option<String> {
    fn walk(arr: &[Node], prefix: &str, id: &str) -> Option<String> {
        for n in arr {
            let path = format!("{}/{}", prefix, n.name);
            if n.id == id {
                return Some(path);
            }
            if let Some(sub) = walk(&n.children, &path, id) {
                return Some(sub);
            }
        }
        None
    }
    walk(nodes, "", id)
}

pub fn path_to_id(nodes: &[Node], path: &str) -> Option<String> {
    if path.is_empty() || !path.starts_with('/') {
        return None;
    }
    let segments: Vec<&str> = path[1..].split('/').collect();
    if segments.iter().any(|s| s.is_empty()) {
        return None;
    }
    let mut current = nodes;
    let mut matched: Option<&Node> = None;
    for seg in &segments {
        matched = current.iter().find(|n| n.name == *seg);
        match matched {
            Some(n) => current = &n.children,
            None => return None,
        }
    }
    matched.map(|n| n.id.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    static CATALOG_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/catalog.json"));

    fn catalog() -> Catalog {
        serde_json::from_str(CATALOG_JSON).unwrap()
    }

    #[test]
    fn fresh_tree_clones_with_language() {
        let cat = catalog();
        let tree = fresh_tree(&cat, Language::En);
        assert_eq!(tree.schema_ver, cat.schema_ver);
        assert_eq!(tree.nodes.len(), cat.nodes.len());
        assert_eq!(tree.language, Language::En);
    }

    #[test]
    fn fresh_tree_independent_clones() {
        let cat = catalog();
        let mut t1 = fresh_tree(&cat, Language::En);
        let t2 = fresh_tree(&cat, Language::En);
        t1.nodes[0].name = "MUTATED".to_string();
        assert_ne!(t1.nodes[0].name, t2.nodes[0].name);
    }

    #[test]
    fn find_node_top_level() {
        let cat = catalog();
        let node = find_node(&cat.nodes, "c:CDN").unwrap();
        assert_eq!(node.name, "CDN");
    }

    #[test]
    fn find_node_nested() {
        let cat = catalog();
        let node = find_node(&cat.nodes, "c:CDN/Cloudflare").unwrap();
        assert_eq!(node.name, "Cloudflare");
    }

    #[test]
    fn find_node_missing() {
        let cat = catalog();
        assert!(find_node(&cat.nodes, "c:DoesNotExist").is_none());
    }

    #[test]
    fn walk_visits_all() {
        let cat = catalog();
        let mut count = 0;
        walk_nodes(&cat.nodes, &mut |_| count += 1);
        assert!(count > 20);
    }

    #[test]
    fn id_to_path_top_level() {
        let cat = catalog();
        assert_eq!(id_to_path(&cat.nodes, "c:CDN"), Some("/CDN".to_string()));
    }

    #[test]
    fn id_to_path_nested() {
        let cat = catalog();
        assert_eq!(
            id_to_path(&cat.nodes, "c:CDN/Cloudflare"),
            Some("/CDN/Cloudflare".to_string())
        );
    }

    #[test]
    fn id_to_path_missing() {
        let cat = catalog();
        assert!(id_to_path(&cat.nodes, "c:NoSuch").is_none());
    }

    #[test]
    fn path_to_id_top_level() {
        let cat = catalog();
        assert_eq!(path_to_id(&cat.nodes, "/CDN"), Some("c:CDN".to_string()));
    }

    #[test]
    fn path_to_id_nested() {
        let cat = catalog();
        assert_eq!(
            path_to_id(&cat.nodes, "/CDN/Cloudflare"),
            Some("c:CDN/Cloudflare".to_string())
        );
    }

    #[test]
    fn path_to_id_missing() {
        let cat = catalog();
        assert!(path_to_id(&cat.nodes, "/CDN/DoesNotExist").is_none());
    }

    #[test]
    fn path_to_id_no_leading_slash() {
        let cat = catalog();
        assert!(path_to_id(&cat.nodes, "CDN").is_none());
    }

    #[test]
    fn path_to_id_empty_segment() {
        let cat = catalog();
        assert!(path_to_id(&cat.nodes, "/CDN//Cloudflare").is_none());
    }

    #[test]
    fn path_to_id_empty_string() {
        let cat = catalog();
        assert!(path_to_id(&cat.nodes, "").is_none());
    }

    #[test]
    fn path_to_id_root_only() {
        let cat = catalog();
        assert!(path_to_id(&cat.nodes, "/").is_none());
    }

    #[test]
    fn id_to_path_round_trip() {
        let cat = catalog();
        walk_nodes(&cat.nodes, &mut |n| {
            if n.source == NodeSource::Curated {
                let path = id_to_path(&cat.nodes, &n.id).unwrap();
                let id = path_to_id(&cat.nodes, &path).unwrap();
                assert_eq!(id, n.id, "round-trip failed for {}", n.id);
            }
        });
    }
}
