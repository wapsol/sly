# Quickstart

This page gets you from install to a useful first sly session.

## Install

Sly is distributed as an npm package:

```bash
npm install -g --ignore-scripts @earendil-works/pi-coding-agent
```

`--ignore-scripts` disables dependency lifecycle scripts during install. Sly does not require install scripts for normal npm installs.

### Uninstall

Use the package manager that installed pi. The curl installer uses npm globally, so curl and npm installs are removed with npm:

```bash
# curl installer or npm install -g
npm uninstall -g @earendil-works/pi-coding-agent

# pnpm
pnpm remove -g @earendil-works/pi-coding-agent

# Yarn
yarn global remove @earendil-works/pi-coding-agent

# Bun
bun uninstall -g @earendil-works/pi-coding-agent
```

Uninstalling sly leaves settings, credentials, sessions, and installed sly packages in `~/.sly/agent/`.

Then start sly in the project directory you want it to work on:

```bash
cd /path/to/project
sly
```

## Authenticate

Sly can use subscription providers through `/login`, or API-key providers through environment variables or the auth file.

### Option 1: subscription login

Start sly and run:

```text
/login
```

Then select a provider. Built-in subscription logins include Claude Pro/Max, ChatGPT Plus/Pro (Codex), and GitHub Copilot.

### Option 2: API key

Set an API key before launching pi:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
sly
```

You can also run `/login` and select an API-key provider to store the key in `~/.sly/agent/auth.json`.

See [Providers](providers.md) for all supported providers, environment variables, and cloud-provider setup.

## First session

Once sly starts, type a request and press Enter:

```text
Summarize this repository and tell me how to run its checks.
```

By default, sly gives the model four tools:

- `read` - read files
- `write` - create or overwrite files
- `edit` - patch files
- `bash` - run shell commands

Additional built-in read-only tools (`grep`, `find`, `ls`) are available through tool options. Sly runs in your current working directory and can modify files there. Use git or another checkpointing workflow if you want easy rollback.

## Give sly project instructions

Sly loads context files at startup. Add an `AGENTS.md` file to tell it how to work in a project:

```markdown
# Project Instructions

- Run `npm run check` after code changes.
- Do not run production migrations locally.
- Keep responses concise.
```

Sly loads:

- `~/.sly/agent/AGENTS.md` for global instructions
- `sly.md` or `AGENTS.md` from parent directories and the current directory

Each directory contributes its first match of `sly.override.md`, `sly.md`, `AGENTS.override.md`, `AGENTS.md`. `CLAUDE.md` is not read.

Restart sly, or run `/reload`, after changing context files.

## Common things to try

### Reference files

Type `@` in the editor to fuzzy-search files, or pass files on the command line:

```bash
sly @README.md "Summarize this"
sly @src/app.ts @src/app.test.ts "Review these together"
```

Images or text can be pasted with Ctrl+V (Alt+V on Windows); images can also be dragged into supported terminals.

### Run shell commands

In interactive mode:

```text
!npm run lint
```

The command output is sent to the model. Use `!!command` to run a command without adding its output to the model context.

### Switch models

Use `/model` or Ctrl+L to choose a model for the current session. Press Ctrl+S in the model picker to save the highlighted model as the startup default. Use `/thinking` to choose a thinking level for the current session, or Ctrl+S in that picker to save the startup default thinking level. Use Shift+Tab to cycle thinking level. Use Ctrl+P / Shift+Ctrl+P to cycle through scoped models.

### Continue later

Sessions are saved automatically:

```bash
sly -c                  # Continue most recent session
sly -r                  # Browse previous sessions
sly --name "my task"    # Set session display name at startup
sly --session <path|id> # Open a specific session
```

Inside sly, use `/resume`, `/new`, `/tree`, `/fork`, and `/clone` to manage sessions.

### Non-interactive mode

For one-shot prompts:

```bash
sly -p "Summarize this codebase"
cat README.md | sly -p "Summarize this text"
sly -p @screenshot.png "What's in this image?"
```

Use `--mode json` for JSON event output or `--mode rpc` for process integration.

## Next steps

- [Using Sly](usage.md) - interactive mode, slash commands, sessions, context files, and CLI reference.
- [Providers](providers.md) - authentication and model setup.
- [Settings](settings.md) - global and project configuration.
- [Keybindings](keybindings.md) - shortcuts and customization.
- [Sly Packages](packages.md) - install shared extensions, skills, prompts, and themes.

Platform notes: [Windows](windows.md), [Termux](termux.md), [tmux](tmux.md), [Terminal setup](terminal-setup.md), [Shell aliases](shell-aliases.md).
