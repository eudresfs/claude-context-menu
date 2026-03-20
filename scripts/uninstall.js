import { spawnSync } from 'node:child_process';
import { intro, outro, confirm, spinner, isCancel, cancel } from '@clack/prompts';

const CLSID   = '{3A8E2F91-6B47-4C5D-9E0A-1F2B3C4D5E6F}';
const BASES   = [
  'HKCU\\Software\\Classes\\Directory\\Background\\shell\\Claude',
  'HKCU\\Software\\Classes\\Directory\\shell\\Claude',
];
const CFG_KEY = 'HKCU\\Software\\ClaudeContextMenu';

async function main() {
  intro('claude-context-menu  ·  uninstall');

  const ok = await confirm({ message: 'Remove "Open with Claude" from the context menu?' });
  if (isCancel(ok) || !ok) { cancel(); process.exit(0); }

  const s = spinner();
  s.start('Removing registry entries...');

  // Verb entries
  for (const base of BASES) {
    spawnSync('reg', ['delete', base, '/f']);
  }

  // COM server registration
  spawnSync('reg', ['delete', `HKCU\\Software\\Classes\\CLSID\\${CLSID}`, '/f']);

  // Config
  spawnSync('reg', ['delete', CFG_KEY, '/f']);

  s.stop('Registry entries removed.');

  outro('Done. The context menu entry has been removed.');
}

main().catch(err => { console.error(err); process.exit(1); });
