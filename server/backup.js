'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { REPO_DIR, getStorageConfig, validateStorage, assertSeparateDirectories } = require('./storage');

function getBackupConfig(env = process.env) {
  const storage = getStorageConfig(env);
  const backupDir = path.resolve(env.HYX_BACKUP_DIR || path.join(REPO_DIR, '..', 'hyx-website-backups'));
  assertSeparateDirectories(backupDir, [REPO_DIR, storage.siteDir, storage.dataDir]);
  const keepDays = Number(env.BACKUP_KEEP_DAYS || '30');
  if (!Number.isInteger(keepDays) || keepDays < 1) throw new Error('BACKUP_KEEP_DAYS 必须为正整数');
  const time = env.BACKUP_TIME || '03:00';
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('BACKUP_TIME 必须为 HH:MM（24 小时制）');
  const timezone = env.TZ || 'Asia/Shanghai';
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  return { ...storage, backupDir, keepDays, time, timezone, formatter };
}

function scheduledDay(config, now = new Date()) {
  const parts = Object.fromEntries(config.formatter.formatToParts(now).map(part => [part.type, part.value]));
  if (parts.hour + ':' + parts.minute < config.time) return null;
  return parts.year + '-' + parts.month + '-' + parts.day;
}

function runTar(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('tar', args, { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    let errorText = '';
    child.stderr.on('data', chunk => { errorText = (errorText + chunk.toString()).slice(-8000); });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('tar 备份失败（' + code + '）：' + errorText)));
  });
}

async function backup(config = getBackupConfig()) {
  // Never archive an uninitialized/empty mount and then rotate valid historical backups away.
  for (const required of ['.initialized.json', 'content', 'uploads', 'server-data']) {
    if (!fs.existsSync(path.join(config.dataDir, required))) throw new Error('持久化数据未就绪：' + required);
  }
  validateStorage(config, { requireUsers: true });
  fs.mkdirSync(config.backupDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(config.backupDir, 0o700);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archive = path.join(config.backupDir, 'hyx-' + stamp + '-' + crypto.randomBytes(4).toString('hex') + '.tar.gz');
  const temporary = archive + '.partial';
  try {
    fs.writeFileSync(temporary, '', { flag: 'wx', mode: 0o600 });
    await runTar(['-czf', temporary, '-C', config.dataDir, '.']);
    fs.chmodSync(temporary, 0o600);
    fs.renameSync(temporary, archive);
  } catch (error) {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
    throw error;
  }
  const completedAt = new Date();
  const cutoff = completedAt.getTime() - config.keepDays * 86400000;
  // Only rotate our own completed archives, never unrelated files or directories.
  for (const entry of fs.readdirSync(config.backupDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/^hyx-\d{4}-\d{2}-\d{2}T[\d-]+Z-[a-f0-9]{8}\.tar\.gz$/.test(entry.name)) continue;
    const file = path.join(config.backupDir, entry.name);
    try {
      if (fs.statSync(file).mtimeMs < cutoff) fs.unlinkSync(file);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const status = path.join(config.backupDir, 'last-success.json');
  const statusTemp = status + '.tmp-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(statusTemp, JSON.stringify({ completedAt: completedAt.toISOString(), archive: path.basename(archive) }, null, 2), { mode: 0o600 });
  fs.renameSync(statusTemp, status);
  console.log('[backup] 完成：' + archive);
  return archive;
}

async function schedule(config = getBackupConfig()) {
  let lastDay = null;
  const status = path.join(config.backupDir, 'last-success.json');
  if (fs.existsSync(status)) {
    try {
      const saved = JSON.parse(fs.readFileSync(status, 'utf8'));
      if (!fs.existsSync(path.join(config.backupDir, path.basename(saved.archive)))) throw new Error('归档不存在');
      lastDay = scheduledDay({ ...config, time: '00:00' }, new Date(saved.completedAt));
    } catch (error) {
      console.warn('[backup] 成功记录无效，将重新备份：' + error.message);
    }
  }
  console.log('[backup] 每日 ' + config.time + '（' + config.timezone + '）备份，保留 ' + config.keepDays + ' 天');
  // Catch up on startup if today's scheduled time has passed; retry failures every minute.
  const tick = async () => {
    const day = scheduledDay(config);
    if (!lastDay || (day && day > lastDay)) {
      try {
        await backup(config);
        lastDay = scheduledDay({ ...config, time: '00:00' });
      } catch (error) {
        console.error('[backup] ' + error.message);
      }
    }
    setTimeout(tick, 60000);
  };
  await tick();
}

function checkHealth(config = getBackupConfig()) {
  const saved = JSON.parse(fs.readFileSync(path.join(config.backupDir, 'last-success.json'), 'utf8'));
  const age = Date.now() - new Date(saved.completedAt).getTime();
  if (!Number.isFinite(age) || age < -60000 || age > 36 * 3600000 || !fs.existsSync(path.join(config.backupDir, path.basename(saved.archive)))) {
    throw new Error('最近 36 小时没有可用的成功备份');
  }
}

module.exports = { getBackupConfig, scheduledDay, backup, checkHealth };

if (require.main === module) {
  const config = getBackupConfig();
  if (process.argv.includes('--health')) {
    checkHealth(config);
    process.exit(0);
  }
  const task = process.argv.includes('--schedule') ? schedule(config) : backup(config);
  task.catch(error => { console.error('[backup] ' + error.message); process.exitCode = 1; });
}
