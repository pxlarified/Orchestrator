import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexLaunchWithCodexHookHash, setCodexLaunchWithCodexHook } from "../src/codex-launch-hook";

let home = "";
let previousCodexHome: string | undefined;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "codex-launch-with-codex-"));
  previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = home;
});

afterEach(() => {
  if (previousCodexHome === undefined) delete process.env.CODEX_HOME;
  else process.env.CODEX_HOME = previousCodexHome;
  rmSync(home, { recursive: true, force: true });
});

function configPath(): string {
  return join(home, "config.toml");
}

function readConfig(): string {
  return readFileSync(configPath(), "utf8");
}

test("installs, disables, and re-enables the trusted startup hook without duplicating it", () => {
  const command = "'/opt/codex-web-gpt/launch-with-codex.sh'";
  expect(setCodexLaunchWithCodexHook(command, true)).toEqual({ changed: true, enabled: true });

  let parsed = Bun.TOML.parse(readConfig()) as any;
  expect(parsed.hooks.SessionStart).toEqual([{
    matcher: "^startup$",
    hooks: [{ type: "command", command, timeout: 5, async: true }],
  }]);
  const stateKey = Object.keys(parsed.hooks.state)[0]!;
  expect(stateKey).toEndWith(":session_start:0:0");
  expect(parsed.hooks.state[stateKey]).toEqual({
    enabled: true,
    trusted_hash: codexLaunchWithCodexHookHash(command),
  });

  expect(setCodexLaunchWithCodexHook(command, false)).toEqual({ changed: true, enabled: false });
  parsed = Bun.TOML.parse(readConfig()) as any;
  expect(parsed.hooks.SessionStart).toHaveLength(1);
  expect(parsed.hooks.state[stateKey].enabled).toBe(false);

  expect(setCodexLaunchWithCodexHook(command, true)).toEqual({ changed: true, enabled: true });
  parsed = Bun.TOML.parse(readConfig()) as any;
  expect(parsed.hooks.SessionStart).toHaveLength(1);
  expect(setCodexLaunchWithCodexHook(command, true)).toEqual({ changed: false, enabled: true });
});

test("preserves unrelated SessionStart hooks and supports inline arrays", () => {
  const command = "'/opt/codex-web-gpt/launch-with-codex.sh'";
  writeFileSync(configPath(), [
    'model = "gpt-5.6-sol"',
    "[hooks]",
    'SessionStart = [{ matcher = "^resume$", hooks = [{ type = "command", command = "other", timeout = 2 }] }]',
    "",
  ].join("\n"));

  setCodexLaunchWithCodexHook(command, true);
  const parsed = Bun.TOML.parse(readConfig()) as any;
  expect(parsed.model).toBe("gpt-5.6-sol");
  expect(parsed.hooks.SessionStart).toHaveLength(2);
  expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe("other");
  expect(parsed.hooks.SessionStart[1]).toEqual({
    matcher: "^startup$",
    hooks: [{ type: "command", command, timeout: 5, async: true }],
  });
  expect(Object.keys(parsed.hooks.state)[0]).toEndWith(":session_start:1:0");
});

test("preserves BOM and CRLF while updating Launch with Codex state", () => {
  const command = "powershell.exe -File \"C:\\Program Files\\Codex Web GPT\\launch.ps1\"";
  writeFileSync(configPath(), '\uFEFFmodel = "gpt-5.6-sol"\r\n');
  setCodexLaunchWithCodexHook(command, true);
  const text = readConfig();
  expect(text.startsWith("\uFEFF")).toBe(true);
  expect(text.replaceAll("\r\n", "")).not.toContain("\n");
  expect((Bun.TOML.parse(text.slice(1).replaceAll("\r\n", "\n")) as any).model).toBe("gpt-5.6-sol");
});

test("refuses to overwrite a modified or duplicated managed hook", () => {
  const command = "'/opt/codex-web-gpt/launch-with-codex.sh'";
  setCodexLaunchWithCodexHook(command, true);
  writeFileSync(configPath(), readConfig().replace("timeout = 5", "timeout = 4"));
  expect(() => setCodexLaunchWithCodexHook(command, false)).toThrow("changed after setup");

  writeFileSync(configPath(), [
    "[[hooks.SessionStart]]",
    'matcher = "^startup$"',
    "[[hooks.SessionStart.hooks]]",
    'type = "command"',
    `command = ${JSON.stringify(command)}`,
    "timeout = 5",
    "async = true",
    "[[hooks.SessionStart]]",
    'matcher = "^startup$"',
    "[[hooks.SessionStart.hooks]]",
    'type = "command"',
    `command = ${JSON.stringify(command)}`,
    "timeout = 5",
    "async = true",
    "",
  ].join("\n"));
  expect(() => setCodexLaunchWithCodexHook(command, true)).toThrow("duplicate Launch with Codex hooks");
});
