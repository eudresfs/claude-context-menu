import { spawnSync }   from 'node:child_process';
import { existsSync }  from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { intro, outro, log } from '@clack/prompts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLSID = '{3A8E2F91-6B47-4C5D-9E0A-1F2B3C4D5E6F}';
const DLL   = resolve(__dirname, '../prebuilt/claude-context-menu.dll');

function findInPath(cmd) {
  const r = spawnSync('where', [cmd], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.trim().split(/\r?\n/)[0].trim();
}

function regExists(key) {
  return spawnSync('reg', ['query', key], { encoding: 'utf8' }).status === 0;
}

function main() {
  intro('claude-context-menu  ·  doctor');

  // claude CLI
  const claude = findInPath('claude');
  claude
    ? log.success(`claude found: ${claude}`)
    : log.error('claude not found in PATH');

  // powershell
  const pwsh = findInPath('pwsh');
  const ps   = findInPath('powershell');
  if      (pwsh) log.success(`pwsh found: ${pwsh}`);
  else if (ps)   log.success(`powershell found: ${ps}`);
  else           log.error('PowerShell not found');

  // windows terminal (optional)
  const wt = findInPath('wt');
  wt ? log.success(`Windows Terminal found: ${wt}`)
     : log.info('Windows Terminal not found  (optional)');

  // DLL
  existsSync(DLL)
    ? log.success(`DLL found: ${DLL}`)
    : log.warn('DLL not found – modern context menu unavailable (run build or CI)');

  // COM registration
  regExists(`HKCU\\Software\\Classes\\CLSID\\${CLSID}`)
    ? log.success('CLSID registered  (modern menu active)')
    : log.warn('CLSID not registered  – run install');

  // Verb entries
  const bgKey  = 'HKCU\\Software\\Classes\\Directory\\Background\\shell\\Claude';
  const dirKey = 'HKCU\\Software\\Classes\\Directory\\shell\\Claude';

  regExists(bgKey)
    ? log.success('Verb registered  (folder background)')
    : log.warn('Verb missing  (folder background)  – run install');

  regExists(dirKey)
    ? log.success('Verb registered  (folder click)')
    : log.warn('Verb missing  (folder click)  – run install');

  // Config
  regExists('HKCU\\Software\\ClaudeContextMenu')
    ? log.success('Config key found')
    : log.warn('Config key missing  – run install');

  outro('Done.');
}

main();
