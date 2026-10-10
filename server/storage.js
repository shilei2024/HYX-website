'use strict';

const fs = require('fs');
const path = require('path');

const REPO_DIR = path.resolve(__dirname, '..');

// Resolve existing ancestors too, so a symlink cannot put runtime data back in the repository.
function physicalPath(directory) {
  let current = path.resolve(directory);
  const suffix = [];
  while (!fs.existsSync(current)) {
    suffix.unshift(path.basename(current));
    const parent = path.dirname(current);
    if (parent === current) throw new Error('无法解析目录：' + directory);
    current = parent;
  }
  return path.join(fs.realpathSync(current), ...suffix);
}

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function assertSeparateDirectories(directory, others) {
  const resolved = physicalPath(directory);
  for (const other of others) {
    const otherResolved = physicalPath(other);
    if (contains(otherResolved, resolved) || contains(resolved, otherResolved)) {
      throw new Error('持久化/备份目录必须与代码、站点及其他数据目录分开：' + directory + ' / ' + other);
    }
  }
}

function getStorageConfig(env = process.env) {
  const siteDir = path.resolve(__dirname, env.SITE_DIR || '../site');
  const dataDir = path.resolve(env.HYX_DATA_DIR || path.join(REPO_DIR, '..', 'hyx-website-data'));
  assertSeparateDirectories(dataDir, [REPO_DIR, siteDir]);
  return {
    siteDir,
    dataDir,
    contentDir: path.join(dataDir, 'content'),
    uploadsDir: path.join(dataDir, 'uploads'),
    serverDataDir: path.join(dataDir, 'server-data'),
    legacyServerDirs: [path.join(REPO_DIR, 'server-data'), path.join(__dirname, 'data')]
  };
}

// Migration only copies missing files. Existing production files always take precedence.
function copyMissing(source, target) {
  if (!fs.existsSync(source)) return;
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name);
    const to = path.join(target, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyMissing(from, to);
    } else if (entry.isFile() && !fs.existsSync(to)) {
      fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL);
    } else if (entry.isSymbolicLink()) {
      throw new Error('迁移目录包含符号链接，请先确认实际文件并解除链接：' + from);
    }
  }
}

function contentFiles(directory, prefix = '') {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('运营数据不能包含符号链接：' + entry.name);
    const relative = prefix + entry.name;
    if (entry.isDirectory()) files.push(...contentFiles(path.join(directory, entry.name), relative + '/'));
    else if (entry.isFile() && entry.name.endsWith('.json')) files.push(relative);
  }
  return files;
}

function validateStorage(config, { requireUsers = false } = {}) {
  for (const directory of [config.contentDir, config.uploadsDir, config.serverDataDir]) {
    if (!fs.existsSync(directory) || !fs.lstatSync(directory).isDirectory()) throw new Error('持久化目录缺失或无效：' + directory);
  }
  const marker = JSON.parse(fs.readFileSync(path.join(config.dataDir, '.initialized.json'), 'utf8'));
  const expected = marker.contentFiles || contentFiles(path.join(config.siteDir, 'data'));
  if (!Array.isArray(expected) || expected.length === 0) throw new Error('运营数据清单为空，不能启动或备份');
  for (const relative of new Set([...expected, ...contentFiles(config.contentDir)])) {
    if (typeof relative !== 'string' || relative.includes('..') || path.isAbsolute(relative)) throw new Error('运营文件清单无效');
    const file = path.join(config.contentDir, relative);
    if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) throw new Error('运营文件缺失：' + relative);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('运营 JSON 必须为对象：' + relative);
  }
  if (requireUsers) {
    const users = JSON.parse(fs.readFileSync(path.join(config.serverDataDir, 'users.json'), 'utf8'));
    if (!users.username || !users.salt || !users.hash) throw new Error('账号文件缺失或无效，不能备份');
  }
}

function initializeStorage(config = getStorageConfig()) {
  const marker = path.join(config.dataDir, '.initialized.json');
  if (fs.existsSync(marker)) {
    validateStorage(config);
    fs.chmodSync(config.serverDataDir, 0o700);
    return config;
  }
  fs.mkdirSync(config.dataDir, { recursive: true });
  for (const directory of [config.contentDir, config.uploadsDir, config.serverDataDir]) {
    fs.mkdirSync(directory, { recursive: true });
  }
  copyMissing(path.join(config.siteDir, 'data'), config.contentDir);
  copyMissing(path.join(config.siteDir, 'assets', 'uploads'), config.uploadsDir);
  for (const legacy of config.legacyServerDirs) copyMissing(legacy, config.serverDataDir);
  fs.chmodSync(config.serverDataDir, 0o700);
  const files = contentFiles(config.contentDir);
  if (files.length === 0) throw new Error('初始内容为空，请检查 SITE_DIR 与迁移源');
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(config.contentDir, file), 'utf8'));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('运营 JSON 必须为对象：' + file);
  }
  fs.writeFileSync(marker, JSON.stringify({ version: 1, initializedAt: new Date().toISOString(), contentFiles: files }, null, 2), { flag: 'wx' });
  console.log('[storage] 运营数据已迁移至 ' + config.dataDir + '（原文件保留，已有数据不覆盖）');
  return config;
}

module.exports = { REPO_DIR, getStorageConfig, initializeStorage, validateStorage, assertSeparateDirectories };

if (require.main === module) initializeStorage();
