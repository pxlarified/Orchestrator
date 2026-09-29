const path = require("node:path");
const { writePrivateFileAtomic } = require("./atomic-file.cjs");

function launcherExecutable(app, {
  environment = process.env,
  platform = process.platform,
} = {}) {
  if (platform === "linux") {
    const stableLauncher = environment.CODEX_WEB_GPT_LAUNCHER_EXECUTABLE?.trim();
    if (stableLauncher && path.isAbsolute(stableLauncher)) return stableLauncher;
    const appImage = environment.CODEX_WEB_GPT_APPIMAGE?.trim() || environment.APPIMAGE?.trim();
    if (appImage && path.isAbsolute(appImage)) return appImage;
  }
  return app.getPath("exe");
}

function powershellLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function posixShellLiteral(value) {
  return `'${String(value).replaceAll("'", `'"'"'`)}'`;
}

function launchScriptPath(coreHome, platform = process.platform) {
  return path.join(coreHome, "runtime", platform === "win32" ? "launch-with-codex.ps1" : "launch-with-codex.sh");
}

function launchScript(executable, platform = process.platform) {
  if (platform === "win32") {
    return [
      "$ErrorActionPreference = 'Stop'",
      `Start-Process -FilePath ${powershellLiteral(executable)} -ArgumentList '--hidden' -WindowStyle Hidden`,
      "",
    ].join("\r\n");
  }
  return [
    "#!/bin/sh",
    `nohup ${posixShellLiteral(executable)} --hidden >/dev/null 2>&1 &`,
    "",
  ].join("\n");
}

function launchHookCommand(scriptPath, platform = process.platform) {
  if (platform === "win32") {
    if (/[\r\n"]/u.test(scriptPath)) throw new Error("Launch with Codex script path is invalid");
    return `powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${scriptPath}"`;
  }
  return posixShellLiteral(scriptPath);
}

function ensureLaunchWithCodexScript({
  app,
  coreHome,
  environment = process.env,
  platform = process.platform,
}) {
  if (!coreHome || !path.isAbsolute(coreHome)) {
    throw new Error("Launch with Codex requires an absolute runtime home");
  }
  const executable = launcherExecutable(app, { environment, platform });
  if (!executable || !path.isAbsolute(executable)) {
    throw new Error("Launch with Codex could not resolve the launcher executable");
  }
  const scriptPath = launchScriptPath(coreHome, platform);
  writePrivateFileAtomic(scriptPath, launchScript(executable, platform), { mode: 0o700 });
  return {
    command: launchHookCommand(scriptPath, platform),
    executable,
    scriptPath,
  };
}

module.exports = {
  ensureLaunchWithCodexScript,
  launchHookCommand,
  launcherExecutable,
  launchScript,
  launchScriptPath,
};
