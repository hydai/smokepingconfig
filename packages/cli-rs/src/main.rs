mod base_resolver;
mod commands;
mod diff;
mod patch;
mod serializer;
mod tree;
mod types;

use std::process;

use clap::{Parser, Subcommand};

use base_resolver::bundled_version;

const CLI_VERSION: &str = "0.1.0";

fn full_version() -> String {
    let cat_part = match bundled_version() {
        Some(v) => format!("bundled catalog {} @ {}", v.date, v.sha),
        None => "bundled catalog unknown".to_string(),
    };
    format!("smokepingconf v{}\n{}", CLI_VERSION, cat_part)
}

#[derive(Parser)]
#[command(
    name = "smokepingconf",
    about = "SmokePing config builder — render Targets files from a committable patch YAML on top of a versioned base catalogue",
    version = CLI_VERSION,
    disable_version_flag = true,
)]
struct Cli {
    /// Print CLI version and bundled catalog stamp
    #[arg(short = 'v', long = "version")]
    version: bool,

    #[command(subcommand)]
    command: Option<Commands>,
}

#[derive(Subcommand)]
enum Commands {
    /// Render a Targets file from a patch YAML + base catalogue
    Render {
        /// Path to the patch YAML file
        patch: String,

        /// Local catalog.json path (overrides --base-url/bundled)
        #[arg(short = 'b', long)]
        base: Option<String>,

        /// Fetch catalog.json over HTTP(S)
        #[arg(short = 'u', long)]
        base_url: Option<String>,

        /// Behaviour when patch references paths missing from the base or pinned sha differs: ignore | warn | error
        #[arg(long, default_value = "warn")]
        on_drift: String,

        /// Write Targets to this file instead of stdout
        #[arg(short = 'o', long)]
        out: Option<String>,
    },

    /// Report drift between a patch and its resolved base catalogue
    DiffBase {
        /// Path to the patch YAML file
        patch: String,

        /// Local catalog.json path (overrides --base-url/bundled)
        #[arg(short = 'b', long)]
        base: Option<String>,

        /// Fetch catalog.json over HTTP(S)
        #[arg(short = 'u', long)]
        base_url: Option<String>,

        /// Exit non-zero if drift is detected: ignore | warn | error
        #[arg(long, default_value = "warn")]
        on_drift: String,
    },

    /// Write a minimal starter patch.yaml pinned to the bundled base
    Init {
        /// Output path for the starter patch
        #[arg(short = 'o', long, default_value = "patch.yaml")]
        out: String,

        /// Overwrite an existing file
        #[arg(short = 'f', long)]
        force: bool,
    },
}

fn main() {
    let cli = Cli::parse();

    if cli.version {
        println!("{}", full_version());
        process::exit(0);
    }

    let command = match cli.command {
        Some(c) => c,
        None => {
            // No subcommand and no --version: print help
            Cli::parse_from(["smokepingconf", "--help"]);
            process::exit(0);
        }
    };

    let exit_code = match command {
        Commands::Render {
            patch,
            base,
            base_url,
            on_drift,
            out,
        } => commands::render::run_render(
            &patch,
            base.as_deref(),
            base_url.as_deref(),
            &on_drift,
            out.as_deref(),
        ),
        Commands::DiffBase {
            patch,
            base,
            base_url,
            on_drift,
        } => commands::diff_base::run_diff_base(
            &patch,
            base.as_deref(),
            base_url.as_deref(),
            &on_drift,
        ),
        Commands::Init { out, force } => commands::init::run_init(&out, force),
    };

    process::exit(exit_code);
}
