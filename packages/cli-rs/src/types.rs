#![allow(clippy::upper_case_acronyms)]

use indexmap::IndexMap;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProbeKind {
    FPing,
    DNS,
    EchoPingHttp,
    EchoPingHttps,
    EchoPingPlugin,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum DnsRecordType {
    A,
    AAAA,
    MX,
    TXT,
    NS,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum Probe {
    FPing,
    DNS {
        #[serde(skip_serializing_if = "Option::is_none")]
        lookup: Option<String>,
        #[serde(skip_serializing_if = "Option::is_none")]
        #[serde(rename = "recordType")]
        record_type: Option<DnsRecordType>,
    },
    EchoPingHttp {
        url: String,
    },
    EchoPingHttps {
        url: String,
    },
    EchoPingPlugin {
        pingport: u16,
    },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeSource {
    Curated,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum NodeType {
    Category,
    Target,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Node {
    pub id: String,
    pub source: NodeSource,
    #[serde(rename = "type")]
    pub node_type: NodeType,
    pub name: String,
    pub menu: String,
    pub title: String,
    pub included: bool,
    pub children: Vec<Node>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probe: Option<Probe>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub comparison_children: Option<Vec<String>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub extra_attrs: Option<IndexMap<String, String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RootMeta {
    pub probe: ProbeKind,
    pub menu: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub remark: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CatalogVersion {
    pub date: String,
    pub sha: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Catalog {
    pub schema_ver: u8,
    pub root: RootMeta,
    pub nodes: Vec<Node>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<CatalogVersion>,
}

#[derive(Debug, Clone, PartialEq, Eq, Default, Serialize, Deserialize)]
pub enum Language {
    #[default]
    #[serde(rename = "en")]
    En,
    #[serde(rename = "zh-TW")]
    ZhTw,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkingTree {
    pub schema_ver: u8,
    pub root: RootMeta,
    pub nodes: Vec<Node>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<CatalogVersion>,
    pub language: Language,
}

#[cfg(test)]
mod tests {
    use super::*;

    static CATALOG_JSON: &str = include_str!(concat!(env!("OUT_DIR"), "/catalog.json"));

    #[test]
    fn deserialize_catalog_json() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        assert_eq!(catalog.schema_ver, 2);
        assert_eq!(catalog.root.probe, ProbeKind::FPing);
        assert_eq!(catalog.root.menu, "Top");
        assert!(!catalog.nodes.is_empty());
    }

    #[test]
    fn catalog_version_populated() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        let version = catalog.version.as_ref().expect("version should be present");
        assert!(version.date.len() == 10, "date should be YYYY-MM-DD format");
        assert!(
            version.sha.len() == 7 || version.sha == "unknown",
            "sha should be 7-char hex or 'unknown'"
        );
    }

    #[test]
    fn first_node_is_cdn_category() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        let cdn = &catalog.nodes[0];
        assert_eq!(cdn.id, "c:CDN");
        assert_eq!(cdn.node_type, NodeType::Category);
        assert_eq!(cdn.source, NodeSource::Curated);
        assert!(cdn.included);
        assert!(!cdn.children.is_empty());
    }

    #[test]
    fn cloudflare_target_has_host() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        let cf = &catalog.nodes[0].children[0];
        assert_eq!(cf.id, "c:CDN/Cloudflare");
        assert_eq!(cf.node_type, NodeType::Target);
        assert_eq!(cf.host.as_deref(), Some("cloudflare.com"));
        assert!(cf.children.is_empty());
    }

    #[test]
    fn dns_probes_node_has_probe() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        let dns_probes = catalog
            .nodes
            .iter()
            .find(|n| n.name == "DNSProbes")
            .unwrap();
        let probe = dns_probes
            .probe
            .as_ref()
            .expect("DNSProbes should have a probe");
        assert!(matches!(probe, Probe::DNS { .. }));
    }

    #[test]
    fn comparison_children_parsed() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        let asia = catalog.nodes.iter().find(|n| n.name == "Asia").unwrap();
        let cc = asia
            .comparison_children
            .as_ref()
            .expect("Asia should have comparisonChildren");
        assert!(!cc.is_empty());
        assert!(cc[0].starts_with('/'));
    }

    #[test]
    fn round_trip_json() {
        let catalog: Catalog = serde_json::from_str(CATALOG_JSON).unwrap();
        let json = serde_json::to_string(&catalog).unwrap();
        let catalog2: Catalog = serde_json::from_str(&json).unwrap();
        assert_eq!(catalog.schema_ver, catalog2.schema_ver);
        assert_eq!(catalog.nodes.len(), catalog2.nodes.len());
    }
}
