# smokeping-config

A self-contained CLI for building [SmokePing](https://oss.oetiker.ch/smokeping/)
`Targets` configuration files from a committable patch YAML layered on top of
a versioned base catalogue.

Single static binary — no Node.js, no Perl, no system libraries beyond what
every OS ships. Catalogue is embedded at compile time so the tool works
offline.

## Install

From crates.io:

```sh
cargo install smokeping-config
```

Or download a prebuilt binary from the [GitHub Releases][releases] for Linux
(x86_64 / aarch64, musl-static), macOS (x86_64 / aarch64), or Windows
(x86_64).

[releases]: https://github.com/hydai/smokepingconfig/releases

## Usage

Three subcommands: `init`, `render`, `diff-base`.

```sh
# Scaffold a starter patch.yaml pinned to the bundled catalogue snapshot.
smokeping-config init

# Edit patch.yaml to exclude targets, override fields, or add custom nodes.
# Then render the SmokePing Targets file:
smokeping-config render patch.yaml --out Targets

# Check whether an existing patch still applies cleanly after the bundled
# catalogue has evolved (useful in CI):
smokeping-config diff-base patch.yaml --on-drift error
```

### Base catalogue resolution

By default the tool uses the catalogue it was compiled with. You can override:

- `--base <file>` — a local `catalog.json`
- `--base-url <url>` — fetch `catalog.json` over HTTP(S) (10-second timeout)

### Drift handling

If your patch references paths that no longer exist in the resolved base, or
its pinned `baseVersion` does not match, both `render` and `diff-base` let
you decide what to do with `--on-drift <mode>`:

- `ignore` — silent, exit 0
- `warn` — print to stderr, exit 0 (default)
- `error` — print to stderr, exit 1

## Patch file format

```yaml
schema: 1
baseVersion:
  date: "2026-04-16"
  sha: "e068c92"

# Remove curated targets by SmokePing path
excluded:
  - /CDN/Akamai

# Override fields on curated nodes (null clears a field)
overrides:
  /CDN/Cloudflare:
    host: 1.1.1.1

# Add your own categories / targets
custom:
  - parentPath: null
    node:
      type: category
      name: MyStuff
      menu: My Stuff
      title: Personal targets
      children:
        - type: target
          name: HomeRouter
          menu: Home Router
          title: Home
          host: 192.168.1.1
```

## Exit codes

- `0` — success (or drift seen but the selected mode tolerates it)
- `1` — drift in `error` mode, file I/O error, malformed patch
- `2` — invalid flag value (e.g., unknown `--on-drift` mode)

## Project

This is the CLI half of a small monorepo that also contains the curated
catalogue and a SvelteKit web editor: <https://github.com/hydai/smokepingconfig>.

Licensed under MIT.
