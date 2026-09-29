import { createHash } from "node:crypto";
import { realpathSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { getStaticTOMLValue, parseTOML, type AST } from "toml-eslint-parser";
import {
  getCodexConfigPath,
  snapshotFile,
  writeFileSnapshot,
} from "./codex-integration-shared";

const MATCHER = "^startup$";
const TIMEOUT_SECONDS = 5;

function canonicalJson(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, canonicalJson(item)]),
  );
}

function canonicalConfigPath(configPath: string): string {
  const absolute = resolve(configPath);
  try {
    return realpathSync.native(absolute);
  } catch {
    try {
      return join(realpathSync.native(dirname(absolute)), basename(absolute));
    } catch {
      return absolute;
    }
  }
}

function lineEnding(text: string): "\n" | "\r\n" | "\r" {
  return text.includes("\r\n") ? "\r\n" : text.includes("\n") ? "\n" : text.includes("\r") ? "\r" : "\n";
}

function appendBlock(text: string, block: string): string {
  if (text.length === 0) return block;
  const ending = lineEnding(text);
  if (text.endsWith(`${ending}${ending}`)) return `${text}${block}`;
  if (text.endsWith(ending)) return `${text}${ending}${block}`;
  return `${text}${ending}${ending}${block}`;
}

export function codexLaunchWithCodexHookHash(command: string): string {
  const identity = canonicalJson({
    event_name: "session_start",
    matcher: MATCHER,
    hooks: [{
      type: "command",
      command,
      timeout: TIMEOUT_SECONDS,
      async: true,
    }],
  });
  return `sha256:${createHash("sha256").update(JSON.stringify(identity)).digest("hex")}`;
}

function hookBlock(command: string, ending: string): string {
  return [
    "# Managed by codex-chatgpt-web: launch the desktop app when Codex starts.",
    "[[hooks.SessionStart]]",
    `matcher = ${JSON.stringify(MATCHER)}`,
    "",
    "[[hooks.SessionStart.hooks]]",
    'type = "command"',
    `command = ${JSON.stringify(command)}`,
    `timeout = ${TIMEOUT_SECONDS}`,
    "async = true",
  ].join(ending);
}

function stateBlock(stateKey: string, trustedHash: string, enabled: boolean, ending: string): string {
  return [
    `[hooks.state.${JSON.stringify(stateKey)}]`,
    `enabled = ${enabled ? "true" : "false"}`,
    `trusted_hash = ${JSON.stringify(trustedHash)}`,
    "# End codex-chatgpt-web Launch with Codex hook.",
  ].join(ending);
}

function stateTable(ast: AST.TOMLProgram, stateKey: string): AST.TOMLTable | undefined {
  return ast.body[0].body.find((node): node is AST.TOMLTable =>
    node.type === "TOMLTable"
    && node.resolvedKey.length === 3
    && node.resolvedKey[0] === "hooks"
    && node.resolvedKey[1] === "state"
    && node.resolvedKey[2] === stateKey);
}

function inlineSessionStartArray(ast: AST.TOMLProgram): AST.TOMLArray | undefined {
  const visit = (value: AST.TOMLContentNode, path: string[]): AST.TOMLArray | undefined => {
    if (path.length === 2 && path[0] === "hooks" && path[1] === "SessionStart" && value.type === "TOMLArray") {
      return value;
    }
    if (value.type === "TOMLInlineTable") {
      for (const entry of value.body) {
        const found = visit(entry.value, [...path, ...getStaticTOMLValue(entry.key)]);
        if (found) return found;
      }
    }
    return undefined;
  };
  for (const node of ast.body[0].body) {
    if (node.type === "TOMLTable") {
      if (node.resolvedKey.some(part => typeof part !== "string")) continue;
      for (const entry of node.body) {
        const found = visit(entry.value, [...node.resolvedKey as string[], ...getStaticTOMLValue(entry.key)]);
        if (found) return found;
      }
    } else {
      const found = visit(node.value, getStaticTOMLValue(node.key));
      if (found) return found;
    }
  }
  return undefined;
}

type CommandHook = {
  type?: unknown;
  command?: unknown;
  timeout?: unknown;
  async?: unknown;
};

type SessionStartGroup = {
  matcher?: unknown;
  hooks?: unknown;
};

type HookDocument = {
  hooks?: {
    SessionStart?: unknown;
    state?: Record<string, { enabled?: unknown; trusted_hash?: unknown }>;
  };
};

function parseDocument(text: string): HookDocument {
  return Bun.TOML.parse(text.replace(/\r\n?/g, "\n")) as HookDocument;
}

function sessionStartGroups(document: HookDocument): SessionStartGroup[] {
  const groups = document.hooks?.SessionStart;
  if (groups === undefined) return [];
  if (!Array.isArray(groups)) throw new Error("Codex SessionStart hooks must be an array");
  return groups as SessionStartGroup[];
}

function matchingGroupIndex(groups: SessionStartGroup[], command: string): number | undefined {
  const indexes = groups.flatMap((group, index) => {
    if (!Array.isArray(group.hooks)) return [];
    return group.hooks.some(hook => (hook as CommandHook)?.command === command) ? [index] : [];
  });
  if (indexes.length > 1) throw new Error("Codex config contains duplicate Launch with Codex hooks");
  return indexes[0];
}

function verifyManagedGroup(group: SessionStartGroup, command: string): void {
  if (group.matcher !== MATCHER || !Array.isArray(group.hooks) || group.hooks.length !== 1) {
    throw new Error("Launch with Codex hook changed after setup; refusing to overwrite it");
  }
  const hook = group.hooks[0] as CommandHook;
  if (hook.type !== "command"
    || hook.command !== command
    || hook.timeout !== TIMEOUT_SECONDS
    || hook.async !== true) {
    throw new Error("Launch with Codex hook changed after setup; refusing to overwrite it");
  }
}

export function setCodexLaunchWithCodexHook(command: string, enabled: boolean): { changed: boolean; enabled: boolean } {
  if (!command.trim() || /[\r\n]/.test(command)) throw new Error("Launch with Codex hook command is invalid");
  const configPath = getCodexConfigPath();
  const snapshot = snapshotFile(configPath, { followSymlink: true });
  const original = snapshot.exists ? snapshot.data!.toString("utf8") : "";
  const bom = original.startsWith("\uFEFF") ? "\uFEFF" : "";
  let text = bom ? original.slice(1) : original;
  let document = parseDocument(text);
  const groups = sessionStartGroups(document);
  let groupIndex = matchingGroupIndex(groups, command);
  const ending = lineEnding(text);

  if (groupIndex === undefined) {
    if (!enabled) return { changed: false, enabled: false };
    groupIndex = groups.length;
    const ast = parseTOML(text.replace(/\r(?!\n)/g, "\n"), { tomlVersion: "1.0" });
    const inline = inlineSessionStartArray(ast);
    if (inline) {
      const end = inline.range[1] - 1;
      const last = inline.elements.at(-1);
      const comma = last && !ast.tokens.some(token => token.value === "," && token.range[0] >= last.range[1] && token.range[1] <= end)
        ? "," : "";
      const item = `${comma} { matcher = ${JSON.stringify(MATCHER)}, hooks = [{ type = "command", command = ${JSON.stringify(command)}, timeout = ${TIMEOUT_SECONDS}, async = true }] } `;
      text = text.slice(0, end) + item + text.slice(end);
    } else {
      text = appendBlock(text, hookBlock(command, ending));
    }
    document = parseDocument(text);
  } else {
    verifyManagedGroup(groups[groupIndex]!, command);
  }

  const stateKey = `${canonicalConfigPath(configPath)}:session_start:${groupIndex}:0`;
  const trustedHash = codexLaunchWithCodexHookHash(command);
  const currentState = document.hooks?.state?.[stateKey];
  if (currentState?.enabled === enabled && currentState.trusted_hash === trustedHash) {
    return { changed: text !== (bom ? original.slice(1) : original), enabled };
  }

  const block = stateBlock(stateKey, trustedHash, enabled, ending);
  const ast = parseTOML(text.replace(/\r(?!\n)/g, "\n"), { tomlVersion: "1.0" });
  const table = stateTable(ast, stateKey);
  if (table) {
    text = text.slice(0, table.range[0]) + block + text.slice(table.range[1]);
  } else if (currentState !== undefined) {
    throw new Error("Launch with Codex hook trust state uses an unsupported inline form");
  } else {
    text = appendBlock(text, block);
  }

  const next = `${bom}${text}`;
  if (next === original) return { changed: false, enabled };
  writeFileSnapshot(snapshot, next);
  return { changed: true, enabled };
}
