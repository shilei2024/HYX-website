'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const crypto = require('crypto');
const { REPO_DIR, getStorageConfig, initializeStorage } = require('../server/storage');
const { getBackupConfig, scheduledDay, backup, checkHealth } = require('../server/backup');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hyx-persistence-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const site = path.join(root, 'site');
  fs.mkdirSync(path.join(site, 'data'), { recursive: true });
  fs.mkdirSync(path.join(site, 'admin'), { recursive: true });
  fs.writeFileSync(path.join(site, 'index.html'), '<h1>官网</h1>');
  fs.writeFileSync(path.join(site, 'admin', 'index.html'), '<h1>内容管理后台</h1>');
  fs.writeFileSync(path.join(site, 'data', 'news.json'), JSON.stringify({ news: [] }));
  const env = {
    ...process.env, SITE_DIR: site, HYX_DATA_DIR: path.join(root, 'runtime'),
    HYX_BACKUP_DIR: path.join(root, 'archives'), BACKUP_KEEP_DAYS: '30',
    BACKUP_TIME: '03:00', TZ: 'Asia/Shanghai', ADMIN_USER: 'test-admin', ADMIN_PASSWORD: 'test-password', PORT: '0'
  };
  const config = getStorageConfig(env);
  config.legacyServerDirs = [];
  return { root, site, env, config };
}

async function startServer(env) {
  const child = spawn(process.execPath, [path.join(REPO_DIR, 'server/server.js')], { env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const exited = new Promise(resolve => child.once('exit', resolve));
  let output = '';
  const url = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { child.kill(); reject(new Error('服务器启动超时：' + output)); }, 10000);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error('服务器退出 ' + code + ': ' + output)); });
    child.stderr.on('data', chunk => { output += chunk; });
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/前台地址: (http:\/\/localhost:\d+\/)/);
      if (match) { clearTimeout(timer); resolve(match[1]); }
    });
  });
  let stopped = false;
  return { url, stop: async () => { if (!stopped) { stopped = true; child.kill(); await exited; } } };
}

async function login(url, password = 'test-password') {
  const response = await fetch(url + 'api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test-admin', password })
  });
  assert.equal(response.status, 200);
  return (await response.json()).token;
}

function seedTestAccount(config) {
  fs.writeFileSync(path.join(config.serverDataDir, 'users.json'), JSON.stringify({ username: 'test-admin', salt: 'test-salt', hash: crypto.createHash('sha256').update('test-salt:test-password').digest('hex') }));
}

test('首次迁移保留现有内容、上传图片、原账号及历史备份，不覆盖目标已有文件', t => {
  const { root, site, config } = fixture(t);
  const legacy = path.join(root, 'legacy');
  const fallback = path.join(root, 'fallback');
  for (const directory of [legacy, fallback, path.join(legacy, 'backups'), path.join(site, 'assets/uploads/202610'), config.contentDir]) fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(config.contentDir, 'news.json'), '{"news":[{"title":"已存在的运营内容"}]}');
  fs.writeFileSync(path.join(legacy, 'users.json'), 'original-account');
  fs.writeFileSync(path.join(fallback, 'users.json'), 'old-local-account');
  fs.writeFileSync(path.join(legacy, 'backups/news.old.json'), 'historical-backup');
  fs.writeFileSync(path.join(site, 'assets/uploads/202610/photo.png'), 'original-image');
  config.legacyServerDirs = [legacy, fallback];
  initializeStorage(config);
  assert.match(fs.readFileSync(path.join(config.contentDir, 'news.json'), 'utf8'), /已存在的运营内容/);
  assert.equal(fs.readFileSync(path.join(config.uploadsDir, '202610/photo.png'), 'utf8'), 'original-image');
  assert.equal(fs.readFileSync(path.join(config.serverDataDir, 'users.json'), 'utf8'), 'original-account');
  assert.equal(fs.readFileSync(path.join(config.serverDataDir, 'backups/news.old.json'), 'utf8'), 'historical-backup');
  assert.equal(fs.readFileSync(path.join(site, 'data/news.json'), 'utf8'), '{"news":[]}');
  assert.ok(fs.existsSync(path.join(site, 'assets/uploads/202610/photo.png')));
});

test('重启及代码更新不会覆盖运营内容，也不会从旧目录重新带回已删除图片', t => {
  const { site, config } = fixture(t);
  fs.mkdirSync(path.join(site, 'assets/uploads'), { recursive: true });
  fs.writeFileSync(path.join(site, 'assets/uploads/removed.png'), 'old-image');
  initializeStorage(config);
  fs.writeFileSync(path.join(config.contentDir, 'news.json'), '{"news":[{"title":"线上最新内容"}]}');
  fs.unlinkSync(path.join(config.uploadsDir, 'removed.png'));
  fs.writeFileSync(path.join(site, 'data/news.json'), '{"news":[{"title":"代码中的初始内容"}]}');
  initializeStorage(config);
  assert.match(fs.readFileSync(path.join(config.contentDir, 'news.json'), 'utf8'), /线上最新内容/);
  assert.equal(fs.existsSync(path.join(config.uploadsDir, 'removed.png')), false);
});

test('数据/备份目录不能与仓库或站点重叠，备份配置需要有效时间和保留天数', t => {
  const { env, site, root } = fixture(t);
  assert.throws(() => getStorageConfig({ ...env, HYX_DATA_DIR: path.join(REPO_DIR, 'unsafe-data') }), /必须/);
  assert.throws(() => getStorageConfig({ ...env, HYX_DATA_DIR: path.join(site, 'data') }), /必须/);
  assert.throws(() => getStorageConfig({ ...env, HYX_DATA_DIR: root }), /必须/);
  assert.throws(() => getBackupConfig({ ...env, HYX_BACKUP_DIR: path.join(env.HYX_DATA_DIR, 'backups') }), /必须/);
  assert.throws(() => getBackupConfig({ ...env, BACKUP_KEEP_DAYS: '0' }), /正整数/);
  assert.throws(() => getBackupConfig({ ...env, BACKUP_TIME: '24:00' }), /HH:MM/);
});

test('备份时间按北京时间判断，不受主机时区影响', t => {
  const { env } = fixture(t);
  const config = getBackupConfig(env);
  assert.equal(scheduledDay(config, new Date('2026-10-09T18:59:00Z')), null);
  assert.equal(scheduledDay(config, new Date('2026-10-09T19:00:00Z')), '2026-10-10');
  assert.equal(scheduledDay(config, new Date('2026-10-10T15:59:00Z')), '2026-10-10');
  assert.equal(scheduledDay(config, new Date('2026-10-10T16:00:00Z')), null);
});

test('备份健康检查仅接受存在且 36 小时内完成的归档', async t => {
  const { env, config } = fixture(t);
  initializeStorage(config);
  seedTestAccount(config);
  const options = getBackupConfig(env);
  const archive = await backup(options);
  assert.doesNotThrow(() => checkHealth(options));
  const status = path.join(options.backupDir, 'last-success.json');
  fs.writeFileSync(status, JSON.stringify({ archive: path.basename(archive), completedAt: new Date(Date.now() - 37 * 3600000).toISOString() }));
  assert.throws(() => checkHealth(options), /36 小时/);
  fs.writeFileSync(status, JSON.stringify({ archive: 'missing.tar.gz', completedAt: new Date().toISOString() }));
  assert.throws(() => checkHealth(options), /36 小时/);
});

test('仅成功备份后清理过期归档，保留无关文件，失败不更新成功记录', async t => {
  const { env, config, root } = fixture(t);
  initializeStorage(config);
  seedTestAccount(config);
  const backupConfig = getBackupConfig(env);
  fs.mkdirSync(backupConfig.backupDir, { recursive: true });
  const expired = path.join(backupConfig.backupDir, 'hyx-2000-01-01T00-00-00-000Z-00000000.tar.gz');
  const unrelated = path.join(backupConfig.backupDir, 'other-backup.tar.gz');
  for (const file of [expired, unrelated]) { fs.writeFileSync(file, 'old'); fs.utimesSync(file, new Date(0), new Date(0)); }
  const archive = await backup(backupConfig);
  assert.ok(fs.existsSync(archive));
  assert.equal(fs.existsSync(expired), false);
  assert.ok(fs.existsSync(unrelated));
  const status = fs.readFileSync(path.join(backupConfig.backupDir, 'last-success.json'), 'utf8');
  fs.writeFileSync(expired, 'keep-on-failure');
  fs.utimesSync(expired, new Date(0), new Date(0));
  const result = spawnSync(process.execPath, [path.join(REPO_DIR, 'server/backup.js')], { env: { ...env, PATH: root }, windowsHide: true, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /tar|ENOENT/);
  assert.ok(fs.existsSync(expired));
  assert.equal(fs.readFileSync(path.join(backupConfig.backupDir, 'last-success.json'), 'utf8'), status);
  assert.equal(fs.readdirSync(backupConfig.backupDir).some(name => name.endsWith('.partial')), false);
});

test('定时服务启动后补做当日备份，重启后不会重复已完成的当日任务', async t => {
  const { env, config } = fixture(t);
  initializeStorage(config);
  seedTestAccount(config);
  const scheduledEnv = { ...env, BACKUP_TIME: '00:00' };
  async function runScheduler(expectBackup) {
    const child = spawn(process.execPath, [path.join(REPO_DIR, 'server/backup.js'), '--schedule'], {
      env: scheduledEnv, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
    });
    const exited = new Promise(resolve => child.once('exit', resolve));
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('定时备份启动超时')), 5000);
        child.once('error', error => { clearTimeout(timer); reject(error); });
        child.stderr.on('data', chunk => { clearTimeout(timer); reject(new Error(chunk.toString())); });
        child.stdout.on('data', chunk => {
          const text = chunk.toString();
          if ((expectBackup && text.includes('[backup] 完成')) || (!expectBackup && text.includes('[backup] 每日'))) {
            clearTimeout(timer);
            resolve();
          }
        });
      });
      if (!expectBackup) await new Promise(resolve => setTimeout(resolve, 200));
    } finally {
      child.kill();
      await exited;
    }
  }
  await runScheduler(true);
  const archives = () => fs.readdirSync(env.HYX_BACKUP_DIR).filter(name => name.endsWith('.tar.gz'));
  const first = archives();
  assert.equal(first.length, 1);
  await runScheduler(false);
  assert.deepEqual(archives(), first);
});

test('完整流程：后台保存/上传 → 官网读取 → 重启保留 → 全量备份 → 恢复到新目录', async t => {
  const { env, site, config, root } = fixture(t);
  initializeStorage(config);
  let server = await startServer(env);
  t.after(async () => server.stop());
  const token = await login(server.url);
  const headers = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token };
  const news = { news: [{ id: 'test-news', title: '服务器运营内容' }] };
  assert.equal((await fetch(server.url + 'api/data/news')).status, 401);
  assert.equal((await fetch(server.url + 'api/data/news', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(news) })).status, 401);
  const saved = await fetch(server.url + 'api/data/news', { method: 'PUT', headers, body: JSON.stringify(news) });
  assert.equal(saved.status, 200);
  assert.deepEqual(await (await fetch(server.url + 'data/news.json')).json(), news);
  assert.equal(fs.readFileSync(path.join(site, 'data/news.json'), 'utf8'), '{"news":[]}');
  const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7u0AAAAASUVORK5CYII=', 'base64');
  const uploaded = await fetch(server.url + 'api/upload', { method: 'POST', headers, body: JSON.stringify({ filename: 'photo.png', contentBase64: image.toString('base64') }) });
  assert.equal(uploaded.status, 200);
  const imageUrl = (await uploaded.json()).url;
  assert.match(imageUrl, /^assets\/uploads\/\d{6}\//);
  assert.deepEqual(Buffer.from(await (await fetch(server.url + imageUrl)).arrayBuffer()), image);
  assert.equal(fs.existsSync(path.join(site, imageUrl)), false);
  assert.match((await fetch(server.url + imageUrl)).headers.get('Content-Security-Policy'), /sandbox/);
  const dangerousSvg = await fetch(server.url + 'api/upload', { method: 'POST', headers, body: JSON.stringify({ filename: 'logo.svg', contentBase64: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64') }) });
  assert.equal(dangerousSvg.status, 400);
  assert.equal((await fetch(server.url + 'server-data/users.json')).status, 404);
  assert.equal((await fetch(server.url + 'data/%2e%2e%2fserver-data/users.json')).status, 403);
  assert.equal((await fetch(server.url + 'admin/')).status, 200);
  const changed = await fetch(server.url + 'api/auth/password', { method: 'POST', headers, body: JSON.stringify({ oldPassword: 'test-password', newPassword: 'changed-test-password' }) });
  assert.equal(changed.status, 200);
  await server.stop();
  fs.writeFileSync(path.join(site, 'data/news.json'), '{"news":[{"title":"代码更新"}]}');
  server = await startServer(env);
  await login(server.url, 'changed-test-password');
  assert.deepEqual(await (await fetch(server.url + 'data/news.json')).json(), news);
  assert.deepEqual(Buffer.from(await (await fetch(server.url + imageUrl)).arrayBuffer()), image);
  const archive = await backup(getBackupConfig(env));
  const restored = path.join(root, 'restored');
  fs.mkdirSync(restored);
  const unpacked = spawnSync('tar', ['-xzf', archive, '-C', restored], { windowsHide: true, encoding: 'utf8' });
  assert.equal(unpacked.status, 0, unpacked.stderr);
  assert.ok(fs.existsSync(path.join(restored, '.initialized.json')));
  assert.ok(fs.readdirSync(path.join(restored, 'server-data/backups')).some(name => name.startsWith('news.')));
  await server.stop();
  server = await startServer({ ...env, HYX_DATA_DIR: restored });
  await login(server.url, 'changed-test-password');
  assert.deepEqual(await (await fetch(server.url + 'data/news.json')).json(), news);
  assert.deepEqual(Buffer.from(await (await fetch(server.url + imageUrl)).arrayBuffer()), image);
  await server.stop();
});

test('持久化目录或运营文件缺失时拒绝启动/备份，不创建空目录或覆盖有效历史', async t => {
  const { env, config } = fixture(t);
  initializeStorage(config);
  seedTestAccount(config);
  const archive = await backup(getBackupConfig(env));
  fs.rmSync(config.uploadsDir, { recursive: true });
  assert.throws(() => initializeStorage(config), /目录缺失/);
  await assert.rejects(backup(getBackupConfig(env)), /未就绪/);
  assert.equal(fs.existsSync(config.uploadsDir), false);
  assert.ok(fs.existsSync(archive));
  fs.mkdirSync(config.uploadsDir);
  fs.unlinkSync(path.join(config.contentDir, 'news.json'));
  assert.throws(() => initializeStorage(config), /运营文件缺失/);
  await assert.rejects(backup(getBackupConfig(env)), /运营文件缺失/);
});

test('账号文件损坏时不会重置账号，首次生产部署拒绝默认密码', async t => {
  const { env, config } = fixture(t);
  initializeStorage(config);
  fs.writeFileSync(path.join(config.serverDataDir, 'users.json'), 'broken-account');
  await assert.rejects(startServer(env), /账号文件无效/);
  assert.equal(fs.readFileSync(path.join(config.serverDataDir, 'users.json'), 'utf8'), 'broken-account');
  fs.unlinkSync(path.join(config.serverDataDir, 'users.json'));
  await assert.rejects(startServer({ ...env, NODE_ENV: 'production', ADMIN_PASSWORD: 'hyx@2026' }), /首次生产部署/);
  assert.equal(fs.existsSync(path.join(config.serverDataDir, 'users.json')), false);
});

test('密码持久化失败返回错误，旧密码仍有效，不残留临时文件', async t => {
  const { env, config } = fixture(t);
  initializeStorage(config);
  const server = await startServer(env);
  t.after(() => server.stop());
  const token = await login(server.url);
  const file = path.join(config.serverDataDir, 'users.json');
  const original = fs.readFileSync(file);
  fs.unlinkSync(file);
  fs.mkdirSync(file);
  const response = await fetch(server.url + 'api/auth/password', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ oldPassword: 'test-password', newPassword: 'should-not-be-saved' }) });
  assert.equal(response.status, 500);
  await login(server.url);
  assert.equal(fs.readdirSync(config.serverDataDir).some(name => name.includes('.tmp-')), false);
  fs.rmdirSync(file);
  fs.writeFileSync(file, original);
  await server.stop();
});
