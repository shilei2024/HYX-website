/**
 * 弘易芯科技官网 - 后台管理 API 服务
 * 零依赖（仅使用 Node.js 内置模块），直接读写 site/data/*.json 实现内容管理
 *
 * 功能：
 *  - 登录认证（Bearer Token，内存会话 + 可持久化的用户文件）
 *  - 内容集合的读取/保存（白名单校验、自动备份、原子写入）
 *  - 图片上传（Base64 JSON 方式，保存至 site/assets/uploads/）
 *  - 静态文件服务（本地开发时可一条命令同时运行前台与后台）
 *
 * 启动：node server/server.js
 * 环境变量：PORT / SITE_DIR / ADMIN_USER / ADMIN_PASSWORD / SESSION_TTL_HOURS / UPLOAD_MAX_MB
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ==================== 基础配置 ====================

/** 服务端口 */
const PORT = parseInt(process.env.PORT || '3000', 10);
/** 站点目录（默认为 server 目录旁的 site/） */
const SITE_DIR = path.resolve(__dirname, process.env.SITE_DIR || path.join('..', 'site'));
/** 初始管理员账号（仅首次生成用户文件时使用） */
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
/** 初始管理员密码（仅首次生成用户文件时使用） */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hyx@2026';
/** 会话有效期（小时） */
const SESSION_TTL_HOURS = parseFloat(process.env.SESSION_TTL_HOURS || '24');
/** 上传文件大小上限（MB） */
const UPLOAD_MAX_MB = parseFloat(process.env.UPLOAD_MAX_MB || '5');
/** 请求体大小上限（字节，需大于上传限制以容纳 Base64 膨胀） */
const BODY_LIMIT = Math.ceil(UPLOAD_MAX_MB * 1024 * 1024 * 1.4) + 1024;

/** 服务端数据目录（用户文件、内容备份，位于站点目录之外避免被公开访问） */
const SERVER_DATA_DIR = path.resolve(__dirname, 'data');
/** 用户信息文件 */
const USERS_FILE = path.join(SERVER_DATA_DIR, 'users.json');
/** 内容备份目录 */
const BACKUP_DIR = path.join(SERVER_DATA_DIR, 'backups');
/** 每个集合保留的备份数量 */
const BACKUP_KEEP = 20;

/** 可管理的内容集合（名称 → 站点内相对路径） */
const COLLECTIONS = {
  'home': { file: 'data/home.json', label: '首页（轮播/关于）' },
  'config': { file: 'data/config.json', label: '站点设置' },
  'brands': { file: 'data/brands.json', label: '代理品牌' },
  'distribution-brands': { file: 'data/distribution-brands.json', label: '分销品牌' },
  'news': { file: 'data/news.json', label: '新闻' },
  'products': { file: 'data/products.json', label: '产品' },
  'diagram-categories': { file: 'data/diagram-categories.json', label: '应用框图' },
  'i18n-zh': { file: 'data/i18n/zh.json', label: '多语言-中文' },
  'i18n-en': { file: 'data/i18n/en.json', label: '多语言-英文' },
  'i18n-ru': { file: 'data/i18n/ru.json', label: '多语言-俄文' }
};

/** 允许上传的图片扩展名 */
const UPLOAD_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'];

// ==================== 工具函数 ====================

/**
 * 生成随机十六进制字符串
 * @param {number} bytes - 随机字节数
 * @returns {string} 十六进制字符串
 */
function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * 密码哈希（salt + sha256）
 * @param {string} password - 明文密码
 * @param {string} salt - 盐值
 * @returns {string} 十六进制哈希
 */
function hashPassword(password, salt) {
  return crypto.createHash('sha256').update(salt + ':' + password, 'utf8').digest('hex');
}

/**
 * 确保目录存在（递归创建）
 * @param {string} dir - 目录路径
 */
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * 读取 JSON 文件（失败返回 null）
 * @param {string} file - 文件绝对路径
 * @returns {Object|null}
 */
function readJSONFile(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * 原子写入文件（先写临时文件再重命名，避免写一半被读到）
 * @param {string} file - 目标文件路径
 * @param {string} content - 写入内容
 */
function atomicWrite(file, content) {
  const tmp = file + '.tmp-' + randomHex(4);
  fs.writeFileSync(tmp, content, 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * 发送 JSON 响应
 * @param {Object} res - ServerResponse
 * @param {number} status - HTTP 状态码
 * @param {Object} obj - 响应对象
 */
function sendJSON(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

/**
 * 读取请求体（带大小限制）
 * @param {Object} req - IncomingMessage
 * @returns {Promise<string>} 请求体字符串
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > BODY_LIMIT) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ==================== 用户与会话 ====================

/** 内存会话表：token → { username, expiresAt } */
const sessions = new Map();

/**
 * 加载用户文件；不存在时用环境变量/默认值创建
 * @returns {{username:string, salt:string, hash:string}}
 */
function loadUsers() {
  let users = readJSONFile(USERS_FILE);
  if (!users || !users.username || !users.hash) {
    const salt = randomHex(16);
    users = {
      username: ADMIN_USER,
      salt,
      hash: hashPassword(ADMIN_PASSWORD, salt),
      createdAt: new Date().toISOString()
    };
    try {
      ensureDir(SERVER_DATA_DIR);
      atomicWrite(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (e) {
      console.warn('[admin] 无法持久化用户文件（可能为只读挂载），将仅使用内存中的账号:', e.message);
    }
  }
  return users;
}

/** 当前用户信息（启动时加载，修改密码后更新） */
let currentUser = loadUsers();

/**
 * 保存用户信息到文件（尽力而为）
 * @param {Object} users - 用户对象
 */
function saveUsers(users) {
  currentUser = users;
  try {
    ensureDir(SERVER_DATA_DIR);
    atomicWrite(USERS_FILE, JSON.stringify(users, null, 2));
  } catch (e) {
    console.warn('[admin] 用户文件保存失败（只读环境下改动重启后失效）:', e.message);
  }
}

/**
 * 校验 Bearer Token
 * @param {Object} req - IncomingMessage
 * @returns {boolean} 是否有效
 */
function checkAuth(req) {
  const header = req.headers['authorization'] || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  const session = sessions.get(match[1]);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(match[1]);
    return false;
  }
  return true;
}

/**
 * 创建新会话
 * @param {string} username - 用户名
 * @returns {{token:string, expiresAt:number}}
 */
function createSession(username) {
  // 清理过期会话
  const now = Date.now();
  for (const [k, v] of sessions) {
    if (v.expiresAt < now) sessions.delete(k);
  }
  const token = randomHex(32);
  const expiresAt = now + SESSION_TTL_HOURS * 3600 * 1000;
  sessions.set(token, { username, expiresAt });
  return { token, expiresAt };
}

// ==================== 登录限流 ====================

/** 失败计数：ip → { count, resetAt } */
const loginAttempts = new Map();

/**
 * 检查某 IP 是否已被限流
 * @param {string} ip - 客户端 IP
 * @returns {boolean} true 表示已超限
 */
function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() > entry.resetAt) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= 5;
}

/**
 * 记录一次登录失败
 * @param {string} ip - 客户端 IP
 */
function recordLoginFailure(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: Date.now() + 10 * 60 * 1000 });
  } else {
    entry.count += 1;
  }
}

// ==================== 集合读写与备份 ====================

/**
 * 获取集合对应站点内文件的绝对路径
 * @param {string} name - 集合名
 * @returns {string|null}
 */
function collectionPath(name) {
  const meta = COLLECTIONS[name];
  if (!meta) return null;
  return path.join(SITE_DIR, meta.file);
}

/**
 * 保存前备份当前文件，并清理过期备份
 * @param {string} name - 集合名
 */
function backupCollection(name) {
  const file = collectionPath(name);
  if (!file || !fs.existsSync(file)) return;
  try {
    ensureDir(BACKUP_DIR);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.copyFileSync(file, path.join(BACKUP_DIR, name + '.' + stamp + '.json'));
    // 仅保留最近 BACKUP_KEEP 份
    const list = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith(name + '.'))
      .sort();
    while (list.length > BACKUP_KEEP) {
      fs.unlinkSync(path.join(BACKUP_DIR, list.shift()));
    }
  } catch (e) {
    console.warn('[admin] 备份失败:', name, e.message);
  }
}

// ==================== 图片上传 ====================

/**
 * 处理图片上传（Base64 JSON），保存到 site/assets/uploads/YYYYMM/
 * @param {Object} body - { filename, contentBase64 }
 * @returns {{ok:boolean, url?:string, error?:string}}
 */
function handleUpload(body) {
  if (!body || typeof body.filename !== 'string' || typeof body.contentBase64 !== 'string') {
    return { ok: false, error: '参数不完整（需要 filename 与 contentBase64）' };
  }
  const ext = path.extname(body.filename).toLowerCase();
  if (!UPLOAD_EXTS.includes(ext)) {
    return { ok: false, error: '不支持的文件类型：' + (ext || '未知') + '，允许：' + UPLOAD_EXTS.join('/') };
  }
  let buffer;
  try {
    buffer = Buffer.from(body.contentBase64, 'base64');
  } catch (e) {
    return { ok: false, error: 'Base64 内容无效' };
  }
  if (!buffer || !buffer.length) return { ok: false, error: '文件内容为空' };
  if (buffer.length > UPLOAD_MAX_MB * 1024 * 1024) {
    return { ok: false, error: '文件超过大小限制 ' + UPLOAD_MAX_MB + 'MB' };
  }
  // SVG 属于文本，追加合法性粗检防止存入脚本
  if (ext === '.svg') {
    const text = buffer.toString('utf8');
    if (/<script[\s>]/i.test(text)) return { ok: false, error: 'SVG 内含脚本，禁止上传' };
  }
  const month = new Date().toISOString().slice(0, 7).replace('-', '');
  const relDir = path.join('assets', 'uploads', month);
  const absDir = path.join(SITE_DIR, relDir);
  ensureDir(absDir);
  const filename = Date.now() + '-' + randomHex(4) + ext;
  fs.writeFileSync(path.join(absDir, filename), buffer);
  // 返回相对站点根的 URL，与前台 resolveAssetUrl 约定一致
  return { ok: true, url: relDir.split(path.sep).join('/') + '/' + filename };
}

// ==================== API 路由 ====================

/**
 * 处理 /api/* 请求
 * @param {Object} req - IncomingMessage
 * @param {Object} res - ServerResponse
 * @param {string} urlObj - 已解析的 URL 对象
 */
async function handleAPI(req, res, urlObj) {
  const pathname = urlObj.pathname;
  const method = req.method || 'GET';
  const ip = req.socket.remoteAddress || 'unknown';

  // 健康检查（无需认证）
  if (pathname === '/api/health') {
    return sendJSON(res, 200, { ok: true, service: 'hyx-admin', time: new Date().toISOString() });
  }

  // 登录（无需认证）
  if (pathname === '/api/auth/login' && method === 'POST') {
    if (isRateLimited(ip)) {
      return sendJSON(res, 429, { ok: false, error: '尝试次数过多，请 10 分钟后再试' });
    }
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: '请求体无效' });
    }
    const users = currentUser;
    const okUser = body && body.username === users.username;
    const okPass = body && hashPassword(String(body.password || ''), users.salt) === users.hash;
    if (okUser && okPass) {
      loginAttempts.delete(ip);
      const { token, expiresAt } = createSession(users.username);
      return sendJSON(res, 200, { ok: true, token, username: users.username, expiresAt });
    }
    recordLoginFailure(ip);
    return sendJSON(res, 401, { ok: false, error: '用户名或密码错误' });
  }

  // 以下接口一律需要认证
  if (!checkAuth(req)) {
    return sendJSON(res, 401, { ok: false, error: '未登录或会话已过期' });
  }

  // 登出
  if (pathname === '/api/auth/logout' && method === 'POST') {
    const match = (req.headers['authorization'] || '').match(/^Bearer\s+(.+)$/i);
    if (match) sessions.delete(match[1]);
    return sendJSON(res, 200, { ok: true });
  }

  // 当前登录信息
  if (pathname === '/api/auth/me' && method === 'GET') {
    const match = (req.headers['authorization'] || '').match(/^Bearer\s+(.+)$/i);
    const session = match ? sessions.get(match[1]) : null;
    return sendJSON(res, 200, { ok: true, username: session ? session.username : '', expiresAt: session ? session.expiresAt : 0 });
  }

  // 修改密码
  if (pathname === '/api/auth/password' && method === 'POST') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: '请求体无效' });
    }
    const users = currentUser;
    if (hashPassword(String(body.oldPassword || ''), users.salt) !== users.hash) {
      return sendJSON(res, 400, { ok: false, error: '原密码不正确' });
    }
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 8) {
      return sendJSON(res, 400, { ok: false, error: '新密码长度至少 8 位' });
    }
    saveUsers({
      username: users.username,
      salt: users.salt,
      hash: hashPassword(newPassword, users.salt),
      createdAt: users.createdAt,
      updatedAt: new Date().toISOString()
    });
    return sendJSON(res, 200, { ok: true });
  }

  // 集合列表
  if (pathname === '/api/data' && method === 'GET') {
    return sendJSON(res, 200, { ok: true, collections: Object.keys(COLLECTIONS).map(k => ({ name: k, label: COLLECTIONS[k].label, file: COLLECTIONS[k].file })) });
  }

  // 集合读取 / 保存
  const dataMatch = pathname.match(/^\/api\/data\/([a-z0-9-]+)$/);
  if (dataMatch) {
    const name = dataMatch[1];
    const file = collectionPath(name);
    if (!file) return sendJSON(res, 404, { ok: false, error: '未知的数据集合：' + name });

    if (method === 'GET') {
      const data = readJSONFile(file);
      if (data === null) return sendJSON(res, 500, { ok: false, error: '文件不存在或 JSON 无效：' + COLLECTIONS[name].file });
      return sendJSON(res, 200, { ok: true, name, data });
    }

    if (method === 'PUT') {
      let body;
      try {
        body = JSON.parse(await readBody(req));
      } catch (e) {
        return sendJSON(res, 400, { ok: false, error: '请求体不是合法 JSON' });
      }
      // body 可能为 {data: ...} 包装或直接为数据对象
      const payload = body && typeof body === 'object' && 'data' in body ? body.data : body;
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return sendJSON(res, 400, { ok: false, error: '数据必须为 JSON 对象' });
      }
      try {
        backupCollection(name);
        ensureDir(path.dirname(file));
        atomicWrite(file, JSON.stringify(payload, null, 2) + '\n');
      } catch (e) {
        return sendJSON(res, 500, { ok: false, error: '保存失败：' + e.message });
      }
      return sendJSON(res, 200, { ok: true, name, savedAt: new Date().toISOString() });
    }
  }

  // 图片上传
  if (pathname === '/api/upload' && method === 'POST') {
    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (e) {
      return sendJSON(res, 400, { ok: false, error: '请求体无效' });
    }
    const result = handleUpload(body);
    return sendJSON(res, result.ok ? 200 : 400, result);
  }

  return sendJSON(res, 404, { ok: false, error: '接口不存在：' + method + ' ' + pathname });
}

// ==================== 静态文件服务 ====================

/** 常见 MIME 类型 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.mp4': 'video/mp4'
};

/**
 * 提供静态文件服务（含路径穿越防护）
 * @param {Object} res - ServerResponse
 * @param {string} pathname - 解码后的请求路径
 */
function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const abs = path.normalize(path.join(SITE_DIR, rel));
  // 防止路径穿越：必须位于站点目录内
  if (!abs.startsWith(SITE_DIR + path.sep) && abs !== SITE_DIR) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  let target = abs;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    // 目录存在但无 index.html 时尝试补 index.html
    const withIndex = path.join(target, 'index.html');
    if (fs.existsSync(withIndex)) {
      target = withIndex;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found');
    }
  }
  const ext = path.extname(target).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  // HTML/JSON 与 /admin/ 后台资源一律不缓存：保证内容修改与后台升级立即生效；其他资源短缓存
  const noCache = ext === '.html' || ext === '.json' || rel === '/admin/' || rel.startsWith('/admin/');
  res.writeHead(200, {
    'Content-Type': mime,
    'Cache-Control': noCache ? 'no-store' : 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff'
  });
  fs.createReadStream(target).pipe(res);
}

// ==================== HTTP 服务器 ====================

/** 创建 HTTP 服务器 */
const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, 'http://localhost');
  try {
    if (urlObj.pathname === '/api' || urlObj.pathname.startsWith('/api/')) {
      await handleAPI(req, res, urlObj);
    } else {
      serveStatic(res, urlObj.pathname);
    }
  } catch (e) {
    console.error('[admin] 请求处理异常:', e);
    if (!res.headersSent) sendJSON(res, 500, { ok: false, error: '服务器内部错误' });
  }
});

// 启动服务
server.listen(PORT, () => {
  console.log('=====================================');
  console.log(' 弘易芯官网后台管理服务已启动');
  console.log(' 站点目录: ' + SITE_DIR);
  console.log(' 前台地址: http://localhost:' + PORT + '/');
  console.log(' 后台地址: http://localhost:' + PORT + '/admin/');
  console.log(' 管理员 : ' + currentUser.username + '（初始密码见环境变量 ADMIN_PASSWORD，默认 hyx@2026，请登录后尽快修改）');
  console.log('=====================================');
});
