import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const BRANCH = process.env.AUTO_BRANCH || 'main';
const DEBOUNCE_MS = Number(process.env.AUTO_DEBOUNCE_MS || 5000);
const IGNORE = new Set(['.git', 'node_modules', 'dist']);
let timer = null;
let pending = new Set();

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
}

function setupWatcher(dir) {
  try {
    fs.watch(dir, (event, filename) => {
      if (!filename) return;
      const full = path.join(dir, filename);
      if (IGNORE.has(filename)) return;
      schedule(full);
    });
  } catch (e) {
    log(`watch error on ${dir}: ${e.message}`);
  }
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory() && e.name !== 'legacy') setupWatcher(full);
  }
}

function schedule(file) {
  pending.add(file);
  clearTimeout(timer);
  timer = setTimeout(commit, DEBOUNCE_MS);
}

const PRETTIER = 'node_modules/.bin/prettier';
const SHFMT = process.env.SHFMT_PATH || '/tmp/opencode/shfmt';
const BLACK = process.env.BLACK_PATH || '/home/okkyparantika/.local/bin/black';
const PRETTIER_EXTS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.json',
  '.css',
  '.html',
  '.yml',
  '.yaml',
  '.md',
]);

function run(cmd, args) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8' });
}

function beautify(changed) {
  const prettierFiles = [];
  const shFiles = [];
  const pyFiles = [];
  for (const f of changed) {
    const ext = f.slice(f.lastIndexOf('.')).toLowerCase();
    if (PRETTIER_EXTS.has(ext)) prettierFiles.push(f);
    else if (ext === '.sh') shFiles.push(f);
    else if (ext === '.py') pyFiles.push(f);
  }
  if (prettierFiles.length) {
    const r = run(PRETTIER, ['--write', ...prettierFiles]);
    if (r.status !== 0) log(`prettier: ${(r.stderr || r.stdout).slice(0, 500)}`);
  }
  if (shFiles.length) {
    const r = run(SHFMT, ['-i', '2', '-w', ...shFiles]);
    if (r.status !== 0) log(`shfmt: ${(r.stderr || r.stdout).slice(0, 500)}`);
  }
  if (pyFiles.length) {
    const r = run(BLACK, ['--quiet', ...pyFiles]);
    if (r.status !== 0) log(`black: ${(r.stderr || r.stdout).slice(0, 500)}`);
  }
}

function commit() {
  const changed = [...pending];
  pending.clear();
  if (!changed.length) return;

  const status = spawnSync('git', ['status', '--porcelain'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).stdout.trim();
  if (!status) {
    log('nothing to commit');
    return;
  }

  beautify(changed);

  const lint = spawnSync('npm', ['run', 'lint', '--silent'], { cwd: ROOT, encoding: 'utf8' });
  if (lint.status !== 0) {
    log(`LINT FAILED - skipping commit\n${(lint.stdout || lint.stderr).slice(0, 2000)}`);
    return;
  }

  const add = spawnSync('git', ['add', '-A'], { cwd: ROOT, encoding: 'utf8' });
  const files = status
    .split('\n')
    .map((l) => l.slice(3).trim())
    .filter(Boolean)
    .slice(0, 8)
    .join(', ');
  const msg = `auto: ${files} (${new Date().toISOString()})`;
  const commitRes = spawnSync('git', ['commit', '-m', msg], { cwd: ROOT, encoding: 'utf8' });
  log(commitRes.stdout.trim() || commitRes.stderr.trim());
  if (commitRes.status !== 0) {
    log(`commit failed (${commitRes.status})`);
    return;
  }
  const push = spawn('git', ['push', 'origin', BRANCH], { cwd: ROOT });
  push.on('error', (e) => log(`push error: ${e.message}`));
  push.on('close', (code) => log(code === 0 ? 'pushed' : `push exit ${code}`));
}

log(`auto-commit watcher started in ${ROOT} (branch ${BRANCH}, debounce ${DEBOUNCE_MS}ms)`);
setupWatcher(ROOT);
