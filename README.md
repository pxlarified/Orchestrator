<h1 align="center">
  <br>
  ChatGPT Web for Codex
  <br>
</h1>

<h4 align="center">Use your ChatGPT Web models with Codex's native interface, tools, and tasks.</h4>

<p align="center">
  <img alt="Bun" src="https://img.shields.io/badge/Bun-1.4.2-000000?style=flat-square&logo=bun&logoColor=white">
  <img alt="Version" src="https://img.shields.io/badge/version-6.1.3-blue?style=flat-square">
  <img alt="Platforms" src="https://img.shields.io/badge/platforms-Windows%20%7C%20macOS%20%7C%20Linux-555555?style=flat-square">
</p>

## Overview

Use the ChatGPT Web models available on your account, including Pro, from Codex’s native model picker—with ChatGPT Web’s separate usage limits, without spending your Work or Codex quota. Keep the same interface, tasks, images, and streaming.

Full harness mode connects ChatGPT to the current task’s files, terminal, tools, and approvals through MCP. Conversations stay tied to your Codex task, so you can keep working as the context grows.

## Features

- Select the ChatGPT Web models available on your account from Codex's native model picker.
- Use ChatGPT Web's separate usage limits while keeping tasks, images, and streaming in Codex.
- Connect local files, terminal commands, tools, and approvals through the Full harness MCP setup.
- Choose automatic browser operation or send prompts manually with Zero Risk mode.
- Keep conversations tied to the current Codex task as the context grows.
- Install the desktop launcher on Windows, macOS, or Linux with its browser and runtime included.

<p align="center">
  <img src="assets/demo.gif" width="960" alt="A live ChatGPT Web turn using the native Codex harness">
</p>

## Requirements

- Codex and a ChatGPT account with access to the models you want to use.
- Windows x64, macOS 13+ (Apple silicon or Intel), or Linux x64 for the packaged launcher.
- ChatGPT Developer Mode and permission to use MCP connectors for Full harness mode.
- Bun 1.4.2 when running from source.

<div id="get-started"><a id="quick-start"></a></div>

## Setup

**Available models:** Free/Go → **Luna / Think**. Accounts with reasoning controls → **Instant–High**, plus **Extra High** and **Pro** when available. The launcher detects what your account can use.

1. **Install the launcher** using the download for your system below.
2. **Sign in to ChatGPT** in the embedded browser and run the browser smoke test.
3. **Install models** and restart Codex once. In automatic mode, choose a model ending in **(Web)**. Pro versions have separate entries; Sol reasoning is selected through Effort. Zero Risk keeps its dedicated entry.
4. **For coding with tools**, open **MCP** in the launcher and complete the Full harness setup below.

The app includes its browser and runtime. No separate Chrome, Node, or Bun installation is needed.

| Platform | Download |
| --- | --- |
| Windows x64 | [Installer](https://github.com/miuuyy/codex-chatgpt-web/releases/download/v6.1.3/codex-web-gpt-6.1.3-win-x64.exe) |
| macOS Apple silicon | [Disk image](https://github.com/miuuyy/codex-chatgpt-web/releases/download/v6.1.3/codex-web-gpt-6.1.3-mac-arm64.dmg) |
| macOS Intel | [Disk image](https://github.com/miuuyy/codex-chatgpt-web/releases/download/v6.1.3/codex-web-gpt-6.1.3-mac-x64.dmg) |
| Linux x64 | [AppImage](https://github.com/miuuyy/codex-chatgpt-web/releases/download/v6.1.3/codex-web-gpt-6.1.3-linux-x64.AppImage) |

[All releases](https://github.com/miuuyy/codex-chatgpt-web/releases)

### Terminal install, updates & repair

Quit the launcher before updating. These installers select the platform and architecture, verify the published checksums, and preserve your ChatGPT profile and launcher settings.

**macOS / Linux**

```bash
curl -fsSL https://github.com/miuuyy/codex-chatgpt-web/releases/latest/download/install-launcher.sh | sh
```

**Windows PowerShell**

```powershell
irm https://github.com/miuuyy/codex-chatgpt-web/releases/latest/download/install-launcher.ps1 | iex
```

## Configuration

<a id="modes"></a>

Automatic modes offer Luna/Think when the account has no reasoning selector; otherwise Instant–High, with Extra High and Pro available independently when exposed by the account.

| Mode | Sending messages | Local Codex tools |
| --- | --- | --- |
| **Browser-only** | Automatic | No |
| **Full harness (With Automation)** | Automatic | Yes, through MCP |
| **Zero Risk** | Paste and send manually | Yes, through a separate MCP connector |

Zero Risk does not read or operate the ChatGPT page. Choose the model and `Codex Zero Risk` connector yourself, paste and send the prepared prompt, then confirm **Sent** in the launcher. Automatic models ending in **(Web)** expose their supported Effort choices in Codex. Instant and each Pro version have separate entries to preserve their context budgets; older saved model entries keep their original fixed mode.

<a id="full-harness"></a>

### Full harness

Full mode connects ChatGPT's tool calls back to the current Codex task through the official
[OpenAI tunnel-client](https://github.com/openai/tunnel-client). The tunnel is outbound: it does
not expose a public IP, open an inbound port, or require router forwarding.

The launcher's **MCP** page guides the complete setup. For the exact clicks, see the
[video walkthroughs](TROUBLESHOOTING.md).

> **Limits**
>
> See [Limits](https://github.com/miuuyy/codex-chatgpt-web/discussions/309) for the current
> ChatGPT message allowances for **GPT-5.6 Sol Pro** and **GPT-6 Astra**. Context limits depend on
> the account type and selected effort. Plus Medium/High uses a measured 90,000-token window, or
> up to 270,000 tokens with experimental **3× context** enabled, with native Codex compaction
> supported throughout.

1. Finish the required setup, open **MCP**, create the Tunnel and regular API key, then press
   **Connect harness**.
2. Enable ChatGPT **Developer Mode** and create a new Tunnel connector named exactly
   **Codex Native2**, with **Authentication: None** and **Allow all actions**.
3. Run **Verify runtime** to confirm that **Codex Native2** is attached and available.

Write/modify actions also require the ChatGPT workspace and its administrator policy to permit
them. See
[developer mode and MCP apps](https://help.openai.com/en/articles/12584461-developer-mode-and-mcp-apps-in-chatgpt).
Unexpected approval prompts fail closed unless `--auto-approve-tool-calls` is explicitly enabled;
that option clicks **Allow once**, never a permanent grant.

## Diagnostics & subagents

<a id="operations"></a>

Use **Activity** for safe local diagnostics and **Settings → Run doctor** for end-to-end health.
Settings can also cancel a retained browser turn or remove the Codex integration before uninstall.
**Save chats in ChatGPT** keeps task conversations in ChatGPT history. Off by default; independent of **New browser chat for each turn**.
Set `CODEX_CHATGPT_WEB_BROWSER_DIAGNOSTICS=1` only when every browser checkpoint needs a screenshot.

New installs use **Compatibility V1** for cross-backend subagents. **Native** preserves Codex's own
feature settings and enables plaintext Web-to-Web V2 delegation. Restart Codex and start a new task
after changing the protocol:

```bash
codex-chatgpt-web subagents status
codex-chatgpt-web subagents compatibility-v1
codex-chatgpt-web subagents native
```

## Security & limitations

<a id="limitations-and-security"></a>

- This is unofficial browser automation, not an OpenAI API. ChatGPT UI changes can break selectors;
  drift fails explicitly instead of silently switching model or transport.
- Browser state is a sensitive login artifact, and the loopback listener is reachable by processes
  running as the same local user. Never share the launcher profile; use a trusted workstation.
- Release packages currently target macOS 13+ (arm64/x64), Windows x64, and Linux x64. Runtime,
  tests, and packaging are gated on all three in CI; account-bound browser and MCP flows use the
  separate [release validation](docs/release-validation.md).
- Builds are not yet platform-signed, so Gatekeeper or SmartScreen may warn. The installers verify
  the published SHA-256 manifest before installation.

Read the complete [architecture](docs/architecture.md) and
[security model](docs/security-model.md) before enabling full mode. Report vulnerabilities through
[SECURITY.md](SECURITY.md).

Temporary Chat is a [ChatGPT privacy mode](https://help.openai.com/en/articles/8914046-temporary-chat-faq); prompts are still processed by OpenAI.

Validation coverage: [release validation](docs/release-validation.md).

This is independent software and is not affiliated with or endorsed by OpenAI. Use it only with
your own account and in accordance with applicable [Terms of Use](https://openai.com/policies/terms-of-use/)
and workspace policies; it does not bypass authentication or access controls.

## Development

<a id="development"></a>

```bash
git clone https://github.com/miuuyy/codex-chatgpt-web.git && \
cd codex-chatgpt-web && \
bun run app
```

This source path requires Bun 1.4.2. The command installs locked dependencies and opens the app.

```bash
bun run app
bun run dev:launcher
bun run src/cli.ts dev status
bun run dev:chat compaction-lab "Reply with exactly: DEV READY"
bun run verify
bun run smoke:subagents
bun run app:package
```

`dev:launcher` uses a separate profile and account under `~/.codex-chatgpt-web-dev`. `dev:chat` exercises the real browser and compaction paths with explicit simulated tool results, without changing your normal Codex route. See the [DEV chat harness](docs/dev-chat.md) for setup and commands.

---

[Troubleshooting](TROUBLESHOOTING.md) · [Security](SECURITY.md) · [Contributing](CONTRIBUTING.md) · [MIT license](LICENSE) · [CI](https://github.com/miuuyy/codex-chatgpt-web/actions/workflows/ci.yml)
