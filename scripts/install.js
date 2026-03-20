import { spawnSync } from 'node:child_process';
import { existsSync }  from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  intro, outro, text, select, spinner,
  isCancel, cancel, note, log,
} from '@clack/prompts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const CLSID   = '{3A8E2F91-6B47-4C5D-9E0A-1F2B3C4D5E6F}';
const DLL     = resolve(__dirname, '../prebuilt/claude-context-menu.dll');
const BASES   = [
  'HKCU\\Software\\Classes\\Directory\\Background\\shell\\Claude',
  'HKCU\\Software\\Classes\\Directory\\shell\\Claude',
];
const CFG_KEY = 'HKCU\\Software\\ClaudeContextMenu';

// ── helpers ───────────────────────────────────────────────────────────────────

function findInPath(cmd) {
  const r = spawnSync('where', [cmd], { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout.trim().split(/\r?\n/)[0].trim();
}

function detectShell() {
  const pwsh = findInPath('pwsh');
  if (pwsh) return { exe: pwsh, label: 'PowerShell 7+ (pwsh)' };
  const ps   = findInPath('powershell');
  if (ps)   return { exe: ps,   label: 'Windows PowerShell 5' };
  return null;
}

function reg(...args) {
  const r = spawnSync('reg', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr.trim() || 'reg command failed');
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  intro('claude-context-menu  ·  install');

  const shell = detectShell();
  if (!shell) {
    cancel('PowerShell not found. Please install it and try again.');
    process.exit(1);
  }

  const claudePath = findInPath('claude');
  if (!claudePath) {
    cancel('claude not found in PATH. Install Claude CLI first.');
    process.exit(1);
  }

  const wtPath   = findInPath('wt');
  const hasDll   = existsSync(DLL);

  if (!hasDll) {
    log.warn('Prebuilt DLL not found – will install classic menu only.');
  }

  // ── prompts ──

  const label = await text({
    message: 'Label shown in context menu',
    placeholder: 'Open with Claude',
    defaultValue: 'Open with Claude',
  });
  if (isCancel(label)) { cancel(); process.exit(0); }

  const extraFlags = await text({
    message: 'Extra Claude flags  (leave empty for none)',
    placeholder: 'e.g. --model opus',
    defaultValue: '',
  });
  if (isCancel(extraFlags)) { cancel(); process.exit(0); }

  let useWt = false;
  if (wtPath) {
    const choice = await select({
      message: 'Open terminal in',
      options: [
        { value: 'ps', label: shell.label },
        { value: 'wt', label: 'Windows Terminal  (new tab)' },
      ],
    });
    if (isCancel(choice)) { cancel(); process.exit(0); }
    useWt = choice === 'wt';
  }

  // ── build classic-menu command (used as fallback when DLL absent) ──

  const flags     = extraFlags.trim().split(/\s+/).filter(Boolean);
  const claudeCmd = ['claude', ...flags].join(' ');
  const command   = useWt
    ? `wt.exe new-tab -d "%V" "${shell.exe}" -NoExit -Command "${claudeCmd}"`
    : `"${shell.exe}" -NoExit -Command "Set-Location '%V'; ${claudeCmd}"`;

  // ── write registry ──

  const s = spinner();
  s.start('Writing registry entries...');

  try {
    if (hasDll) {
      // Register the COM server (per-user, no admin needed)
      reg('add', `HKCU\\Software\\Classes\\CLSID\\${CLSID}`,
          '/ve', '/d', 'ClaudeContextMenuCommand', '/f');
      reg('add', `HKCU\\Software\\Classes\\CLSID\\${CLSID}\\InProcServer32`,
          '/ve', '/d', DLL, '/f');
      reg('add', `HKCU\\Software\\Classes\\CLSID\\${CLSID}\\InProcServer32`,
          '/v', 'ThreadingModel', '/t', 'REG_SZ', '/d', 'Apartment', '/f');

      // Persist config so the DLL can read it at invoke time
      reg('add', CFG_KEY, '/v', 'Label',              '/t', 'REG_SZ',    '/d', label,         '/f');
      reg('add', CFG_KEY, '/v', 'Shell',              '/t', 'REG_SZ',    '/d', shell.exe,      '/f');
      reg('add', CFG_KEY, '/v', 'ExtraFlags',         '/t', 'REG_SZ',    '/d', extraFlags,     '/f');
      reg('add', CFG_KEY, '/v', 'ClaudePath',         '/t', 'REG_SZ',    '/d', claudePath,     '/f');
      reg('add', CFG_KEY, '/v', 'UseWindowsTerminal', '/t', 'REG_DWORD', '/d', useWt ? '1' : '0', '/f');
      if (useWt && wtPath) {
        reg('add', CFG_KEY, '/v', 'WtPath', '/t', 'REG_SZ', '/d', wtPath, '/f');
      }

      // Register verbs with ExplorerCommandHandler (modern + classic menu)
      for (const base of BASES) {
        reg('add', base, '/ve', '/d', label, '/f');
        reg('add', base, '/v', 'MUIVerb',                '/t', 'REG_SZ', '/d', label,      '/f');
        reg('add', base, '/v', 'Icon',                   '/t', 'REG_SZ', '/d', `${claudePath},0`, '/f');
        reg('add', base, '/v', 'ExplorerCommandHandler', '/t', 'REG_SZ', '/d', CLSID,      '/f');
      }
    } else {
      // Fallback: classic menu only via plain command key
      for (const base of BASES) {
        reg('add', base, '/ve', '/d', label, '/f');
        reg('add', base, '/v', 'Icon', '/t', 'REG_SZ', '/d', `${claudePath},0`, '/f');
        reg('add', `${base}\\command`, '/ve', '/d', command, '/f');
      }
    }

    s.stop('Registry entries written.');
  } catch (err) {
    s.stop('Failed to write registry.');
    cancel(err.message);
    process.exit(1);
  }

  note(
    [
      `Shell  : ${shell.label}`,
      `Claude : ${claudePath}`,
      `Mode   : ${hasDll ? 'Modern + Classic menu (DLL)' : 'Classic menu only (no DLL)'}`,
    ].join('\n'),
    'Configuration'
  );

  outro(`Done. Right-click a folder and look for "${label}"`);
}

main().catch(err => { console.error(err); process.exit(1); });
