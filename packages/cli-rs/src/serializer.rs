use crate::types::*;

pub fn serialize_catalog(catalog: &Catalog) -> String {
    let mut lines: Vec<String> = Vec::new();
    lines.push("*** Targets ***".to_string());
    lines.push(String::new());
    lines.push(format!("probe = {:?}", catalog.root.probe));
    lines.push(String::new());
    lines.push(format!("menu = {}", catalog.root.menu));
    lines.push(format!("title = {}", catalog.root.title));
    if let Some(ref remark) = catalog.root.remark {
        lines.push(format!("remark = {}", remark));
    }
    lines.push(String::new());
    for node in &catalog.nodes {
        if !node.included {
            continue;
        }
        write_node(node, 1, &mut lines);
    }
    let mut out = lines.join("\n");
    out.push('\n');
    out
}

fn write_node(node: &Node, depth: usize, lines: &mut Vec<String>) {
    lines.push(format!("{} {}", "+".repeat(depth), node.name));
    lines.push(String::new());
    lines.push(format!("menu = {}", node.menu));
    lines.push(format!("title = {}", node.title));

    if node.node_type == NodeType::Target {
        if let Some(ref host) = node.host {
            lines.push(format!("host = {}", host));
        }
    }
    if node.node_type == NodeType::Category {
        if let Some(ref cc) = node.comparison_children {
            if !cc.is_empty() {
                lines.push(format!("host = {}", cc.join(" ")));
            }
        }
    }

    if let Some(ref probe) = node.probe {
        write_probe(probe, lines);
    }

    if let Some(ref extras) = node.extra_attrs {
        for (k, v) in extras {
            lines.push(format!("{} = {}", k, v));
        }
    }

    lines.push(String::new());

    for child in &node.children {
        if !child.included {
            continue;
        }
        write_node(child, depth + 1, lines);
    }
}

fn write_probe(probe: &Probe, lines: &mut Vec<String>) {
    match probe {
        Probe::FPing => {
            lines.push("probe = FPing".to_string());
        }
        Probe::DNS {
            lookup,
            record_type,
        } => {
            lines.push("probe = DNS".to_string());
            if let Some(l) = lookup {
                lines.push(format!("lookup = {}", l));
            }
            if let Some(rt) = record_type {
                lines.push(format!("recordtype = {:?}", rt));
            }
        }
        Probe::EchoPingHttp { url } => {
            lines.push("probe = EchoPingHttp".to_string());
            if !url.is_empty() {
                lines.push(format!("url = {}", url));
            }
        }
        Probe::EchoPingHttps { url } => {
            lines.push("probe = EchoPingHttps".to_string());
            if !url.is_empty() {
                lines.push(format!("url = {}", url));
            }
        }
        Probe::EchoPingPlugin { pingport } => {
            lines.push("probe = EchoPingPlugin".to_string());
            lines.push(format!("pingport = {}", pingport));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    static CATALOG_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/catalog.json"));

    fn catalog() -> Catalog {
        serde_json::from_str(CATALOG_JSON).unwrap()
    }

    #[test]
    fn emits_targets_header() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.starts_with("*** Targets ***\n"));
    }

    #[test]
    fn emits_root_probe() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.contains("probe = FPing"));
    }

    #[test]
    fn emits_root_menu_and_title() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.contains("menu = Top"));
        assert!(out.contains("title = Network Latency Grapher"));
    }

    #[test]
    fn emits_nested_categories() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.contains("+ CDN"));
        assert!(out.contains("++ Cloudflare"));
    }

    #[test]
    fn skips_excluded_nodes() {
        let mut cat = catalog();
        // CDN is nodes[0], Cloudflare is CDN's first child
        cat.nodes[0].children[0].included = false;
        let out = serialize_catalog(&cat);
        // Cloudflare should not appear as a second-level section
        let has_cloudflare_section = out.lines().any(|l| l.trim() == "++ Cloudflare");
        assert!(!has_cloudflare_section);
    }

    #[test]
    fn emits_host_for_targets() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.contains("host = cloudflare.com"));
    }

    #[test]
    fn emits_comparison_children() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.contains("host = /Asia/Taiwan/HiNet"));
    }

    #[test]
    fn emits_dns_probe() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.contains("probe = DNS"));
    }

    #[test]
    fn ends_with_newline() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        assert!(out.ends_with('\n'));
    }

    #[test]
    fn round_trip_structure() {
        let cat = catalog();
        let out = serialize_catalog(&cat);
        let lines: Vec<&str> = out.lines().collect();
        assert_eq!(lines[0], "*** Targets ***");
        assert_eq!(lines[2], "probe = FPing");
        // Verify the count is stable (468 lines in TypeScript output)
        assert_eq!(lines.len(), 468);
    }
}
