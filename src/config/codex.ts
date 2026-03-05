import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import toml from 'toml';

const CODEX_CONFIG_DIR = join(homedir(), '.codex');
const CODEX_CONFIG_PATH = join(CODEX_CONFIG_DIR, 'config.toml');

export function getCodexConfigPath(): string {
  return CODEX_CONFIG_PATH;
}

export function isCodexConfigured(): boolean {
  if (!existsSync(CODEX_CONFIG_PATH)) return false;

  try {
    const content = readFileSync(CODEX_CONFIG_PATH, 'utf-8');
    const parsed = toml.parse(content);
    const notify = parsed.notify;
    if (!Array.isArray(notify)) return false;
    return notify[0] === 'mar' && notify[1] === 'notify-handler';
  } catch {
    return false;
  }
}

export function addCodexNotify(): void {
  if (!existsSync(CODEX_CONFIG_DIR)) {
    mkdirSync(CODEX_CONFIG_DIR, { recursive: true });
  }

  if (!existsSync(CODEX_CONFIG_PATH)) {
    writeFileSync(CODEX_CONFIG_PATH, 'notify = ["mar", "notify-handler"]\n');
    return;
  }

  const content = readFileSync(CODEX_CONFIG_PATH, 'utf-8');

  // Check if notify is already set
  try {
    const parsed = toml.parse(content);
    if (
      Array.isArray(parsed.notify) &&
      parsed.notify[0] === 'mar' &&
      parsed.notify[1] === 'notify-handler'
    ) {
      return; // Already configured
    }
  } catch {
    // Parse error — we'll overwrite the notify line
  }

  // Replace or append notify line
  const notifyLine = 'notify = ["mar", "notify-handler"]';
  if (content.includes('notify')) {
    const updated = content.replace(/^notify\s*=.*$/m, notifyLine);
    writeFileSync(CODEX_CONFIG_PATH, updated);
  } else {
    writeFileSync(
      CODEX_CONFIG_PATH,
      content.trimEnd() + '\n' + notifyLine + '\n'
    );
  }
}
