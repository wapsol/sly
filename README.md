# Sly

Sly is a self-extensible coding agent for the terminal. It is a fork of the MIT-licensed
[pi](https://github.com/earendil-works/pi) agent harness by earendil-works, reduced to four
model providers: Melious, Anthropic, Hugging Face and OpenRouter.

## Requirements

- Node.js >= 22.19.0 (`node --version`)
- git
- A key for at least one provider (see [Providers](#providers))

## Install from a clone

```bash
git clone git@github.com:wapsol/sly.git
cd sly
npm install --ignore-scripts   # install workspace dependencies, no lifecycle scripts
npm run build                  # refresh model data, then build every package
```

Use `npm run build:offline` instead if the machine has no network access: it rebuilds from the
model data already in the tree.

The build takes a few minutes. It ends with the bundled CLI at
`packages/coding-agent/dist/bundle/cli.js`.

## Run it

From the repository, without installing anything:

```bash
./sly-test.sh              # runs sly from sources, works from any directory
./sly-test.sh --no-env     # same, but with all provider API keys unset
```

To get a `sly` command on your `PATH`, link the built bundle into a directory you already use:

```bash
ln -sf "$PWD/packages/coding-agent/dist/bundle/cli.js" ~/.local/bin/sly
sly --version
```

Alternatively install the built package globally with `npm install -g ./packages/coding-agent`.

## Providers

Set the key for whichever provider you want as an environment variable:

| Provider | Environment variable |
|----------|----------------------|
| Melious | `MELIOUS_API_KEY` |
| Anthropic | `ANTHROPIC_API_KEY` (or `ANTHROPIC_OAUTH_TOKEN`) |
| Hugging Face | `HF_TOKEN` |
| OpenRouter | `OPENROUTER_API_KEY` |

Check that a provider is ready:

```bash
sly auth check --provider melious
```

Pick a provider and model per run:

```bash
sly --provider melious --model glm-5.3-flash
sly --provider anthropic --model claude-opus-5
```

## Configuration

User-level settings, extensions and sessions live in `~/.sly/`. Project-level instructions go in
`sly.md` or `AGENTS.md` at the repository root. Run `sly config` for a TUI that enables or disables package
resources.

## Development

```bash
npm run check    # biome lint + format, type checks, dependency and shrinkwrap checks
./test.sh        # run tests (LLM-dependent tests are skipped without API keys)
npm run build    # rebuild all packages
```

`npm run check` also runs as a pre-commit hook.

## Packages

| Package | Description |
|---------|-------------|
| `packages/coding-agent` | Interactive coding agent CLI |
| `packages/agent` | Agent runtime with tool calling and state management |
| `packages/ai` | Unified multi-provider LLM API |
| `packages/tui` | Terminal UI library with differential rendering |
| `packages/durable` | Durable conversation, task and document runtime |
| `packages/chord` | Application-composition runtime for services, state, RPC and plugins |
| `packages/telemetry` | Vendor-neutral telemetry contracts and adapters |

## Permissions

Sly has no built-in permission system: it runs with the permissions of the user and process that
launched it. For stronger boundaries, see
[packages/coding-agent/docs/containerization.md](packages/coding-agent/docs/containerization.md).

## License

MIT. Sly is built on [pi](https://github.com/earendil-works/pi) by Mario Zechner
(earendil-works), also MIT licensed.

- Copyright (c) 2025 Mario Zechner (earendil-works, the sly coding agent)
- Copyright (c) 2026- Ashant Chalasani

See [LICENSE](LICENSE) for the full text.
