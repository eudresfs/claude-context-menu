#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const scripts = {
  install:   resolve(__dirname, '../scripts/install.js'),
  uninstall: resolve(__dirname, '../scripts/uninstall.js'),
  doctor:    resolve(__dirname, '../scripts/doctor.js'),
};

const cmd = process.argv[2];

if (scripts[cmd]) {
  spawnSync(process.execPath, [scripts[cmd]], { stdio: 'inherit' });
} else {
  console.log('Usage: npx claude-context-menu install | uninstall | doctor');
}
