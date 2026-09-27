# Sly

Sly is an extensible AI agent that works from your terminal. Give it a goal and a working folder, and it can inspect files, run commands, edit content, and work through multi-step tasks.

Use Sly for software development, research notes, writing projects, data files, or hobby work. You can use Sly as is, prompt it to adapt itself to your workflow, or build other applications powered by Sly using the SDK.

## Start using Sly

New to Sly? Follow the [Quickstart](quickstart.md) to install Sly, connect a model, and complete your first task.

If Sly is already installed, choose what you want to do:

- [Use Sly interactively](usage.md) to add files, run commands, direct ongoing work, and export results.
- [Choose a model](models.md) or connect a subscription, API key, local model, or compatible endpoint.
- [Continue or branch a session](sessions.md) to resume work or explore another approach without losing history.
- [Configure Sly](configuration.md) for your preferences, working folders, instructions, and reusable resources.
- [Understand how Sly works](how-pi-works.md), including tools, context, sessions, and the agent loop.

## Customize Sly

Sly can reuse prompts, load specialized instructions, add executable integrations, change its terminal interface, connect model services, and distribute these resources as packages.
Use the [Quickstart customization chooser](quickstart.md#choose-how-to-customize-pi) to select the smallest mechanism that meets your need.

## Automate or embed Sly

- Use [print mode](cli.md#invocation-and-output) for one-off and scripted tasks.
- Use [JSON event stream mode](json.md) to consume structured events from one run.
- Use [RPC mode](rpc.md) to control a separate Sly process.
- Use the [TypeScript SDK](sdk.md) to run Sly inside an application.

## Find reference and setup information

Use the reference pages to look up [CLI options](cli.md), [settings](settings.md), [provider authentication](providers.md), [keybindings](keybindings.md), and [environment variables](environment-variables.md).

For platform-specific help, see [Terminal Setup](terminal-setup.md), [Windows](windows.md), [tmux](tmux.md), [Termux on Android](termux.md), or [Containerization](containerization.md).

## Work safely

Sly's tools and extensions run with the permissions of the Sly process. Project trust controls which project resources Sly loads, but it does not sandbox tool calls. Review [Security](security.md) before using untrusted files, repositories, extensions, or unattended automation.
