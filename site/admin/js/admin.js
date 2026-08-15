/**
 * 弘易芯科技官网 - 后台管理 SPA
 * 前后端约定：
 *  - API 前缀 /api/*，认证方式 Bearer Token（localStorage 存储）
 *  - 内容集合（site/data/*.json）整体读取、整体保存
 *  - 图片上传 POST /api/upload {filename, contentBase64} → {url}
 *
 * 本文件包含：API 封装、通用 CRUD 引擎（schema 驱动）、
 * 各内容模块定义、仪表盘/站点设置/多语言/修改密码等特殊页面、hash 路由。
 */
(function () {
  'use strict';

  // ==================== 基础工具 ====================

  var TOKEN_KEY = 'hyx_admin_token';
  var USERNAME_KEY = 'hyx_admin_username';

  /** HTML 转义，防止内容注入破坏页面 */
  function esc(v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /** 显示 toast 提示（type: success | error | info） */
  function toast(msg, type) {
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'admin-toast ' + type;
    el.textContent = msg;
    document.getElementById('toast-wrap').appendChild(el);
    setTimeout(function () { el.remove(); }, 3200);
  }

  /** 相对路径图片转为可预览地址（admin 位于站点 /admin/ 下） */
  function previewSrc(url) {
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/')) return url;
    return '../' + String(url).replace(/^\//, '');
  }

  /** 确认对话框（Promise 化） */
  function confirmDialog(msg) {
    return window.confirm(msg);
  }

  // ==================== API 封装 ====================

  /**
   * 调用后台 API
   * @param {string} path - 如 /api/data/news
   * @param {Object} opts - { method, body } body 为对象时自动 JSON 序列化
   * @returns {Promise<Object>} 响应 JSON；ok=false 或 401 时抛错
   */
  async function api(path, opts) {
    opts = opts || {};
    var headers = { 'Content-Type': 'application/json' };
    var token = localStorage.getItem(TOKEN_KEY);
    if (token) headers['Authorization'] = 'Bearer ' + token;
    var init = { method: opts.method || 'GET', headers: headers };
    if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
    var res = await fetch(path, init);
    // 401 处理：登录接口的 401 属于"账号密码错误"，走正常错误分支；
    // 其余接口的 401 表示会话过期，清除本地状态并提示重新登录
    if (res.status === 401 && path !== '/api/auth/login') {
      logout(false);
      throw new Error('登录已过期，请重新登录');
    }
    var data = null;
    try { data = await res.json(); } catch (e) { /* 忽略非 JSON 响应 */ }
    if (!res.ok || (data && data.ok === false)) {
      throw new Error((data && data.error) || ('请求失败（HTTP ' + res.status + '）'));
    }
    return data;
  }

  /** 集合内存缓存（页面切换与字段联动复用） */
  var collectionCache = {};

  /**
   * 读取集合（带缓存；force=true 强制刷新）
   * @returns {Promise<Object>} 集合数据对象
   */
  async function loadCollection(name, force) {
    if (!force && collectionCache[name]) return collectionCache[name];
    var res = await api('/api/data/' + name);
    collectionCache[name] = res.data;
    return res.data;
  }

  /**
   * 保存集合并刷新缓存
   * @param {string} name - 集合名
   * @param {Object} [data] - 可选：保存指定数据（缺省使用缓存）
   */
  async function saveCollection(name, data) {
    if (data !== undefined) collectionCache[name] = data;
    await api('/api/data/' + name, { method: 'PUT', body: collectionCache[name] });
  }

  /**
   * 上传图片文件
   * @param {File} file - 用户选择的文件
   * @returns {Promise<string>} 站点内相对路径（如 assets/uploads/202608/xx.png）
   */
  function uploadImage(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var base64 = String(reader.result).replace(/^data:[^,]*,/, '');
        api('/api/upload', { method: 'POST', body: { filename: file.name, contentBase64: base64 } })
          .then(function (res) { resolve(res.url); })
          .catch(reject);
      };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsDataURL(file);
    });
  }

  // ==================== 登录 / 登出 ====================

  /** 进入登录视图 */
  function showLogin() {
    document.getElementById('login-view').classList.remove('d-none');
    document.getElementById('app-view').classList.add('d-none');
  }

  /** 进入应用视图并加载当前页面 */
  function showApp() {
    document.getElementById('login-view').classList.add('d-none');
    document.getElementById('app-view').classList.remove('d-none');
    document.getElementById('current-username').textContent = localStorage.getItem(USERNAME_KEY) || '';
    if (!location.hash || location.hash === '#/') location.hash = '#/dashboard';
    route();
  }

  /**
   * 登出
   * @param {boolean} callApi - 是否调用登出接口
   */
  function logout(callApi) {
    var doLocal = function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USERNAME_KEY);
      collectionCache = {};
      showLogin();
    };
    if (callApi === false) { doLocal(); return; }
    api('/api/auth/logout', { method: 'POST' }).catch(function () {}).then(doLocal);
  }

  /** 绑定登录表单 */
  function bindLogin() {
    document.getElementById('login-form').addEventListener('submit', async function (e) {
      e.preventDefault();
      var errEl = document.getElementById('login-error');
      var btn = document.getElementById('login-submit');
      errEl.classList.add('d-none');
      btn.disabled = true;
      btn.textContent = '登录中...';
      try {
        var res = await api('/api/auth/login', {
          method: 'POST',
          body: {
            username: document.getElementById('login-username').value.trim(),
            password: document.getElementById('login-password').value
          }
        });
        localStorage.setItem(TOKEN_KEY, res.token);
        localStorage.setItem(USERNAME_KEY, res.username);
        showApp();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.classList.remove('d-none');
      } finally {
        btn.disabled = false;
        btn.textContent = '登 录';
      }
    });
  }

  // ==================== 字段渲染器 ====================

  /**
   * 生成单个表单字段的 HTML
   * @param {Object} f - 字段 schema
   * @param {*} value - 当前值
   * @returns {string} HTML
   */
  function renderField(f, value) {
    var label = '<label class="form-label">' + esc(f.label) + (f.required ? '<span class="required-star">*</span>' : '') + '</label>';
    var name = 'f_' + f.key.replace(/\./g, '__');
    var hint = f.hint ? '<div class="form-text">' + esc(f.hint) + '</div>' : '';

    // 多语言字段（{zh,en,ru}）
    if (f.type === 'lang' || f.type === 'langTextarea') {
      var v = (value && typeof value === 'object') ? value : {};
      var langs = [
        { code: 'zh', badge: '中', cls: 'b-zh' },
        { code: 'en', badge: 'EN', cls: 'b-en' },
        { code: 'ru', badge: 'RU', cls: 'b-ru' }
      ];
      var rows = langs.map(function (l) {
        var input = f.type === 'langTextarea'
          ? '<textarea class="form-control" rows="' + (f.rows || 3) + '" data-field="' + name + '" data-lang="' + l.code + '">' + esc(v[l.code] || '') + '</textarea>'
          : '<input type="text" class="form-control" data-field="' + name + '" data-lang="' + l.code + '" value="' + esc(v[l.code] || '') + '">';
        return '<div class="lang-row"><span class="lang-badge ' + l.cls + '">' + l.badge + '</span><div class="flex-grow-1">' + input + '</div></div>';
      }).join('');
      return '<div class="mb-3" data-type="lang">' + label + rows + hint + '</div>';
    }

    // 图片字段（上传或填写路径）
    if (f.type === 'image') {
      var url = value || '';
      return '<div class="mb-3" data-type="image">' + label +
        '<div class="image-field">' +
        '<img class="thumb-lg" data-preview="' + name + '" src="' + esc(previewSrc(url)) + '" alt="">' +
        '<input type="file" accept="image/*" class="form-control form-control-sm" data-upload="' + name + '">' +
        '<input type="text" class="form-control form-control-sm" data-field="' + name + '" value="' + esc(url) + '" placeholder="图片路径，如 assets/uploads/xx.png 或 https://...">' +
        '</div>' + hint + '</div>';
    }

    // 下拉选择（选项来自其他集合）
    if (f.type === 'select') {
      var options = (f.options || []).map(function (o) {
        var sel = String(value) === String(o.value) ? ' selected' : '';
        return '<option value="' + esc(o.value) + '"' + sel + '>' + esc(o.label) + '</option>';
      }).join('');
      return '<div class="mb-3">' + label + '<select class="form-select" data-field="' + name + '">' + options + '</select>' + hint + '</div>';
    }

    // 标签数组（逗号分隔）
    if (f.type === 'tags') {
      var text = Array.isArray(value) ? value.join(', ') : (value || '');
      return '<div class="mb-3">' + label +
        '<input type="text" class="form-control" data-field="' + name + '" value="' + esc(text) + '" placeholder="多个内容用英文逗号分隔">' + hint + '</div>';
    }

    // 多行文本
    if (f.type === 'textarea') {
      return '<div class="mb-3">' + label +
        '<textarea class="form-control" rows="' + (f.rows || 4) + '" data-field="' + name + '">' + esc(value || '') + '</textarea>' + hint + '</div>';
    }

    // 数字 / 日期 / 普通文本
    var type = f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text');
    return '<div class="mb-3">' + label +
      '<input type="' + type + '" class="form-control" data-field="' + name + '" value="' + esc(value === undefined || value === null ? (f.default || '') : value) + '" placeholder="' + esc(f.placeholder || '') + '">' + hint + '</div>';
  }

  /**
   * 从表单 DOM 收集字段值
   * @param {HTMLElement} formEl - 表单容器
   * @param {Object} fields - 字段 schema 数组
   * @param {Object} base - 编辑前的原始对象（用于保留未展示字段）
   * @returns {Object} 收集结果；required 缺失时抛错
   */
  function collectFields(formEl, fields, base) {
    var result = base ? JSON.parse(JSON.stringify(base)) : {};
    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var name = 'f_' + f.key.replace(/\./g, '__');
      var el = formEl.querySelector('[data-field="' + name + '"]');
      if (!el) continue;

      if (f.type === 'lang' || f.type === 'langTextarea') {
        var obj = {};
        var empty = true;
        formEl.querySelectorAll('[data-field="' + name + '"][data-lang]').forEach(function (input) {
          var val = input.value.trim();
          if (val) { obj[input.getAttribute('data-lang')] = val; empty = false; }
        });
        if (f.required && empty) throw new Error('【' + f.label + '】至少填写一种语言');
        result[f.key] = obj;
      } else if (f.type === 'tags') {
        result[f.key] = el.value.split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
      } else if (f.type === 'number') {
        result[f.key] = el.value === '' ? null : parseInt(el.value, 10);
      } else {
        result[f.key] = el.value.trim();
        if (f.required && !result[f.key]) throw new Error('【' + f.label + '】为必填项');
      }
    }
    return result;
  }

  /**
   * 绑定图片字段的上传交互（委托到容器级，一次绑定）
   * @param {HTMLElement} container - 页面容器
   */
  function bindImageUploads(container) {
    container.addEventListener('change', async function (e) {
      var input = e.target.closest('[data-upload]');
      if (!input) return;
      var file = input.files && input.files[0];
      if (!file) return;
      try {
        var url = await uploadImage(file);
        var name = input.getAttribute('data-upload');
        var urlInput = container.querySelector('[data-field="' + name + '"]');
        var preview = container.querySelector('[data-preview="' + name + '"]');
        if (urlInput) urlInput.value = url;
        if (preview) preview.src = previewSrc(url);
        toast('图片上传成功', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
    // 手动修改路径输入时同步预览
    container.addEventListener('input', function (e) {
      var urlInput = e.target.closest('.image-field input[type=text][data-field]');
      if (!urlInput) return;
      var wrap = urlInput.closest('.image-field');
      var preview = wrap && wrap.querySelector('img');
      if (preview) preview.src = previewSrc(urlInput.value);
    });
  }

  // ==================== 通用列表 CRUD 引擎 ====================

  /** 当前打开的列表页上下文（供弹窗保存使用） */
  var editorCtx = null;

  /**
   * 渲染通用列表页
   * @param {Object} page - 页面 schema
   */
  async function renderListPage(page) {
    var container = document.getElementById('page-container');
    var data = await loadCollection(page.collection);
    var list = (data && data[page.section]) || [];

    var rows = list.map(function (item, idx) {
      var cells = page.columns.map(function (col) {
        var val = col.render ? col.render(item) : esc(item[col.key]);
        return '<td>' + val + '</td>';
      }).join('');
      return '<tr>' + cells +
        '<td class="text-nowrap">' +
        '<button class="btn btn-sm btn-outline-secondary me-1" data-act="up" data-idx="' + idx + '" ' + (idx === 0 ? 'disabled' : '') + '>↑</button>' +
        '<button class="btn btn-sm btn-outline-secondary me-1" data-act="down" data-idx="' + idx + '" ' + (idx === list.length - 1 ? 'disabled' : '') + '>↓</button>' +
        '<button class="btn btn-sm btn-outline-primary me-1" data-act="edit" data-idx="' + idx + '">编辑</button>' +
        '<button class="btn btn-sm btn-outline-danger" data-act="del" data-idx="' + idx + '">删除</button>' +
        '</td></tr>';
    }).join('');

    container.innerHTML =
      '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h1 class="page-title">' + esc(page.title) + '</h1>' +
      '<button class="btn btn-primary" id="list-add">＋ 新增' + esc(page.itemName) + '</button>' +
      '</div>' +
      '<div class="card card-shadow"><div class="table-responsive">' +
      '<table class="table table-hover mb-0"><thead><tr>' +
      page.columns.map(function (c) { return '<th>' + esc(c.label) + '</th>'; }).join('') +
      '<th>操作</th></tr></thead><tbody>' + (rows || '<tr><td colspan="99" class="text-center text-muted py-4">暂无数据，点击右上角新增</td></tr>') + '</tbody>' +
      '</table></div></div>' +
      (page.footNote ? '<div class="text-muted small mt-2">' + page.footNote + '</div>' : '');

    // 预处理动态下拉选项（如新闻分类/产品分类）
    await prepareSelectOptions(page);

    // 行操作（事件委托）
    container.querySelectorAll('[data-act]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        var act = btn.getAttribute('data-act');
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        var fresh = await loadCollection(page.collection);
        var arr = (fresh && fresh[page.section]) || [];
        if (act === 'edit') {
          openEditor(page, arr[idx], idx);
        } else if (act === 'del') {
          if (!confirmDialog('确定删除该' + page.itemName + '？删除后立即对前台生效。')) return;
          arr.splice(idx, 1);
          await saveCollection(page.collection);
          toast('已删除', 'success');
          renderListPage(page);
        } else if (act === 'up' && idx > 0) {
          var t = arr[idx - 1]; arr[idx - 1] = arr[idx]; arr[idx] = t;
          await saveCollection(page.collection);
          renderListPage(page);
        } else if (act === 'down' && idx < arr.length - 1) {
          var t2 = arr[idx + 1]; arr[idx + 1] = arr[idx]; arr[idx] = t2;
          await saveCollection(page.collection);
          renderListPage(page);
        }
      });
    });

    document.getElementById('list-add').addEventListener('click', function () {
      openEditor(page, null, -1);
    });
  }

  /**
   * 为 select 字段准备动态选项（optionsFrom 指向另一集合的某节数据）
   */
  async function prepareSelectOptions(page) {
    for (var i = 0; i < (page.fields || []).length; i++) {
      var f = page.fields[i];
      if (f.type === 'select' && f.optionsFrom) {
        var src = await loadCollection(f.optionsFrom.collection);
        var items = (src && src[f.optionsFrom.section]) || [];
        f.options = items.map(function (it) {
          return { value: it[f.optionsFrom.value], label: it[f.optionsFrom.label] + (it[f.optionsFrom.labelEn] ? ' / ' + it[f.optionsFrom.labelEn] : '') };
        });
      }
    }
  }

  /**
   * 打开编辑弹窗
   * @param {Object} page - 页面 schema
   * @param {Object|null} item - 编辑对象；null 表示新增
   * @param {number} idx - 数组下标；-1 表示新增
   */
  function openEditor(page, item, idx) {
    editorCtx = { page: page, idx: idx };
    var isNew = idx < 0;
    var draft = isNew ? (page.defaults ? JSON.parse(JSON.stringify(page.defaults)) : {}) : item;
    if (isNew && page.autoDate) draft[page.autoDate] = new Date().toISOString().slice(0, 10);

    document.getElementById('editor-title').textContent = (isNew ? '新增' : '编辑') + page.itemName;
    var form = document.getElementById('editor-form');
    form.innerHTML = page.fields.map(function (f) { return renderField(f, draft[f.key]); }).join('');
    window._editorModal = window._editorModal || new bootstrap.Modal(document.getElementById('editor-modal'));
    window._editorModal.show();
  }

  /** 弹窗保存按钮逻辑 */
  async function saveEditor() {
    if (!editorCtx) return;
    var page = editorCtx.page;
    var idx = editorCtx.idx;
    var data = await loadCollection(page.collection);
    var arr = data[page.section] = data[page.section] || [];
    try {
      var formEl = document.getElementById('editor-form');
      var base = idx >= 0 ? arr[idx] : {};
      var result = collectFields(formEl, page.fields, base);
      if (page.autoId) {
        if (idx < 0 || result[page.autoId] === undefined || result[page.autoId] === null || result[page.autoId] === '') {
          var maxId = 0;
          arr.forEach(function (it) { if (typeof it.id === 'number' && it.id > maxId) maxId = it.id; });
          result[page.autoId] = maxId + 1;
        }
      }
      if (idx < 0) arr.unshift(result); else arr[idx] = result;
      await saveCollection(page.collection);
      window._editorModal.hide();
      toast('保存成功，前台已生效', 'success');
      // config 等特殊页面注册了刷新回调，优先执行；否则刷新列表
      if (typeof window._afterEditorSave === 'function') window._afterEditorSave();
      else renderListPage(page);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ==================== 单对象页引擎（如"关于区块"） ====================

  /**
   * 渲染单对象编辑页
   * @param {Object} page - { title, collection, section, fields, intro }
   */
  async function renderSinglePage(page) {
    var container = document.getElementById('page-container');
    var data = await loadCollection(page.collection);
    var obj = (data && data[page.section]) || {};
    container.innerHTML =
      '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h1 class="page-title">' + esc(page.title) + '</h1>' +
      '<button class="btn btn-primary" id="single-save">保存修改</button></div>' +
      (page.intro ? '<div class="text-muted small mb-3">' + page.intro + '</div>' : '') +
      '<div class="card card-shadow"><div class="card-body" id="single-form">' +
      page.fields.map(function (f) { return renderField(f, obj[f.key]); }).join('') +
      '</div></div>';

    document.getElementById('single-save').addEventListener('click', async function () {
      try {
        var result = collectFields(document.getElementById('single-form'), page.fields, obj);
        data[page.section] = result;
        await saveCollection(page.collection);
        toast('保存成功，前台已生效', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // ==================== 内容模块 Schema ====================

  /** 各管理页面定义 */
  var PAGES = {

    // ---- 首页轮播 ----
    hero: {
      title: '轮播图片（首页英雄区）', collection: 'home', section: 'slides',
      itemName: '轮播图', type: 'list', autoId: 'id',
      fields: [
        { key: 'image', label: '背景图片', type: 'image', required: true, hint: '建议 1920×640 以上横图' },
        { key: 'title', label: '大标题', type: 'lang' },
        { key: 'description', label: '描述文字', type: 'langTextarea', rows: 3 },
        { key: 'link', label: '按钮链接', type: 'text', placeholder: '留空则不显示按钮，如 products/brands.html' }
      ],
      columns: [
        { label: '预览', render: function (s) { return '<img class="thumb" src="' + esc(previewSrc(s.image)) + '">'; } },
        { label: '标题(中)', render: function (s) { return esc(s.title && s.title.zh); } },
        { label: '标题(EN)', render: function (s) { return esc(s.title && s.title.en); } }
      ],
      footNote: '提示：第一张为默认展示图，可用 ↑↓ 调整顺序；前台首页 zh/en/ru 三个语言版本共用图片，文字按语言显示。'
    },

    // ---- 首页关于区块 ----
    about: {
      title: '关于区块（首页）', collection: 'home', section: 'about', type: 'single',
      intro: '首页"关于我们"区块的图片与文字，按语言分别维护。',
      fields: [
        { key: 'image', label: '配图', type: 'image', required: true },
        { key: 'title', label: '标题', type: 'lang', required: true },
        { key: 'subtitle', label: '副标题', type: 'lang' },
        { key: 'text', label: '正文', type: 'langTextarea', rows: 4 },
        { key: 'link', label: '按钮链接', type: 'text', default: 'about/index.html' },
        { key: 'linkText', label: '按钮文字', type: 'lang' }
      ]
    },

    // ---- 代理品牌 ----
    brands: {
      title: '代理品牌', collection: 'brands', section: 'brands',
      itemName: '品牌', type: 'list', autoId: 'id',
      fields: [
        { key: 'name', label: '品牌名称（中文）', type: 'text', required: true },
        { key: 'nameEn', label: '品牌名称（英文）', type: 'text' },
        { key: 'logo', label: '品牌 Logo', type: 'image', required: true },
        { key: 'url', label: '官网链接', type: 'text', placeholder: 'https://...' },
        { key: 'description', label: '简短说明（中文）', type: 'textarea', rows: 2 },
        { key: 'descriptionEn', label: '简短说明（英文）', type: 'textarea', rows: 2 }
      ],
      columns: [
        { label: 'Logo', render: function (b) { return '<img class="thumb" src="' + esc(previewSrc(b.logo)) + '">'; } },
        { label: '名称', key: 'name' },
        { label: '英文名', key: 'nameEn' },
        { label: '官网', render: function (b) { return b.url ? '<a href="' + esc(b.url) + '" target="_blank">链接 ↗</a>' : '-'; } }
      ]
    },

    // ---- 分销品牌 ----
    distribution: {
      title: '分销品牌', collection: 'distribution-brands', section: 'brands',
      itemName: '品牌', type: 'list', autoId: 'id',
      fields: [
        { key: 'name', label: '品牌名称（中文）', type: 'text', required: true },
        { key: 'nameEn', label: '品牌名称（英文）', type: 'text' },
        { key: 'logo', label: '品牌 Logo', type: 'image' },
        { key: 'url', label: '官网链接', type: 'text' },
        { key: 'description', label: '简短说明（中文）', type: 'textarea', rows: 2 },
        { key: 'descriptionEn', label: '简短说明（英文）', type: 'textarea', rows: 2 }
      ],
      columns: [
        { label: 'Logo', render: function (b) { return b.logo ? '<img class="thumb" src="' + esc(previewSrc(b.logo)) + '">' : '-'; } },
        { label: '名称', key: 'name' },
        { label: '英文名', key: 'nameEn' }
      ]
    },

    // ---- 新闻 ----
    news: {
      title: '新闻管理', collection: 'news', section: 'news',
      itemName: '新闻', type: 'list', autoId: 'id', autoDate: 'date',
      defaults: { type: 'company' },
      fields: [
        { key: 'type', label: '分类', type: 'select', required: true, optionsFrom: { collection: 'news', section: 'types', value: 'id', label: 'name', labelEn: 'nameEn' } },
        { key: 'date', label: '发布日期', type: 'date', required: true },
        { key: 'image', label: '封面图', type: 'image', hint: '新闻列表与详情页顶部展示' },
        { key: 'title', label: '标题（中文）', type: 'text', required: true },
        { key: 'titleEn', label: '标题（英文）', type: 'text' },
        { key: 'summary', label: '摘要（中文）', type: 'textarea', rows: 2 },
        { key: 'summaryEn', label: '摘要（英文）', type: 'textarea', rows: 2 },
        { key: 'content', label: '正文（中文）', type: 'textarea', rows: 10, hint: '支持 HTML 标签（如 <p>、<strong>、<img>）' },
        { key: 'contentEn', label: '正文（英文）', type: 'textarea', rows: 10, hint: '支持 HTML 标签' }
      ],
      columns: [
        { label: '日期', key: 'date' },
        { label: '标题', key: 'title' },
        { label: '分类', render: function (n) { return esc(n.type); } }
      ],
      footNote: '提示：新增新闻后前台"新闻中心"与首页"新闻动态"立即显示；俄文页面暂时回退显示中文/英文内容。'
    },

    // ---- 新闻分类 ----
    'news-types': {
      title: '新闻分类', collection: 'news', section: 'types',
      itemName: '分类', type: 'list',
      fields: [
        { key: 'id', label: '分类 ID（英文）', type: 'text', required: true, hint: '如 company / industry，创建后不建议修改' },
        { key: 'name', label: '分类名称（中文）', type: 'text', required: true },
        { key: 'nameEn', label: '分类名称（英文）', type: 'text' }
      ],
      columns: [
        { label: 'ID', key: 'id' },
        { label: '名称', key: 'name' },
        { label: '英文名', key: 'nameEn' }
      ],
      footNote: '注意：新闻列表侧栏目前固定展示"全部/公司动态/行业新闻/服务客户"，自定义新分类的新闻可在"全部"列表中显示。'
    },

    // ---- 产品列表 ----
    products: {
      title: '产品列表', collection: 'products', section: 'products',
      itemName: '产品', type: 'list', autoId: 'id',
      fields: [
        { key: 'name', label: '产品名称（中文）', type: 'text', required: true },
        { key: 'nameEn', label: '产品名称（英文）', type: 'text' },
        { key: 'category', label: '所属分类', type: 'select', required: true, optionsFrom: { collection: 'products', section: 'categories', value: 'id', label: 'name', labelEn: 'nameEn' } },
        { key: 'image', label: '产品图', type: 'image' },
        { key: 'description', label: '描述（中文）', type: 'textarea', rows: 2 },
        { key: 'descriptionEn', label: '描述（英文）', type: 'textarea', rows: 2 },
        { key: 'features', label: '产品特点', type: 'tags', hint: '如：高容量, 高耐压, 小型化' }
      ],
      columns: [
        { label: '图片', render: function (p) { return p.image ? '<img class="thumb" src="' + esc(previewSrc(p.image)) + '">' : '-'; } },
        { label: '名称', key: 'name' },
        { label: '分类', render: function (p) { return esc(p.category); } }
      ]
    },

    // ---- 产品分类 ----
    'product-categories': {
      title: '产品分类', collection: 'products', section: 'categories',
      itemName: '分类', type: 'list',
      fields: [
        { key: 'id', label: '分类 ID（英文）', type: 'text', required: true, hint: '如 capacitor / resistor，创建后不建议修改' },
        { key: 'name', label: '分类名称（中文）', type: 'text', required: true },
        { key: 'nameEn', label: '分类名称（英文）', type: 'text' },
        { key: 'parent', label: '上级分类', type: 'select', options: [{ value: '', label: '（无 / 顶级）' }, { value: 'distribution', label: '分销品牌 distribution' }, { value: 'authorized', label: '代理品牌 authorized' }] },
        { key: 'description', label: '描述（中文）', type: 'textarea', rows: 2 },
        { key: 'descriptionEn', label: '描述（英文）', type: 'textarea', rows: 2 }
      ],
      columns: [
        { label: 'ID', key: 'id' },
        { label: '名称', key: 'name' },
        { label: '英文名', key: 'nameEn' },
        { label: '上级', render: function (c) { return esc(c.parent || '顶级'); } }
      ]
    },

    // ---- 应用框图 ----
    diagrams: {
      title: '应用框图', collection: 'diagram-categories', section: 'categories',
      itemName: '框图', type: 'list',
      fields: [
        { key: 'id', label: 'ID（英文）', type: 'text', required: true },
        { key: 'name', label: '分类名称（中文）', type: 'text', required: true },
        { key: 'subName', label: '子标题（中文）', type: 'text' },
        { key: 'nameEn', label: '分类名称（英文）', type: 'text' },
        { key: 'subNameEn', label: '子标题（英文）', type: 'text' },
        { key: 'image', label: '框图图片', type: 'image', required: true }
      ],
      columns: [
        { label: '缩略图', render: function (c) { return '<img class="thumb" src="' + esc(previewSrc(c.image)) + '">'; } },
        { label: '名称', key: 'name' },
        { label: '子标题', key: 'subName' }
      ]
    }
  };

  // ==================== 特殊页面：仪表盘 ====================

  /** 渲染仪表盘（内容统计 + 快捷入口） */
  async function renderDashboard() {
    var container = document.getElementById('page-container');
    var names = ['home', 'news', 'brands', 'distribution-brands', 'products', 'diagram-categories'];
    var stats = [];
    try {
      await Promise.all(names.map(function (n) { return loadCollection(n, true); }));
      stats = [
        { label: '轮播图', num: ((collectionCache.home || {}).slides || []).length, hash: '#/hero', icon: '🖼️' },
        { label: '新闻', num: ((collectionCache.news || {}).news || []).length, hash: '#/news', icon: '📰' },
        { label: '代理品牌', num: ((collectionCache.brands || {}).brands || []).length, hash: '#/brands', icon: '🤝' },
        { label: '分销品牌', num: ((collectionCache['distribution-brands'] || {}).brands || []).length, hash: '#/distribution', icon: '📦' },
        { label: '产品', num: ((collectionCache.products || {}).products || []).length, hash: '#/products', icon: '🔧' },
        { label: '应用框图', num: ((collectionCache['diagram-categories'] || {}).categories || []).length, hash: '#/diagrams', icon: '📊' }
      ];
    } catch (e) {
      container.innerHTML = '<div class="alert alert-danger">数据加载失败：' + esc(e.message) + '</div>';
      return;
    }
    container.innerHTML =
      '<h1 class="page-title mb-3">仪表盘</h1>' +
      '<div class="row g-3 mb-4">' +
      stats.map(function (s) {
        return '<div class="col-6 col-md-4 col-lg-2"><a class="card card-shadow stat-card" href="' + s.hash + '">' +
          '<div class="card-body text-center"><div>' + s.icon + '</div>' +
          '<div class="stat-num">' + s.num + '</div><div class="stat-label">' + esc(s.label) + '</div>' +
          '</div></a></div>';
      }).join('') +
      '</div>' +
      '<div class="card card-shadow"><div class="card-body">' +
      '<h6 class="fw-bold mb-2">使用说明</h6>' +
      '<ul class="mb-0 small text-muted">' +
      '<li>左侧菜单管理各栏目内容，保存后<b>前台立即生效</b>（无需重启或发布）。</li>' +
      '<li>图片类字段可直接上传新图（自动保存到站点 assets/uploads/ 目录），也可填写已有路径或外链。</li>' +
      '<li>多语言文案（导航、按钮、栏目标题等界面文字）在「多语言文案」中维护。</li>' +
      '<li>每次保存都会自动备份上一版本（服务器 server/data/backups/），误删可找管理员恢复。</li>' +
      '</ul></div></div>';
  }

  // ==================== 特殊页面：站点设置 ====================

  /** 站点设置表单分组定义 */
  var CONFIG_GROUPS = [
    {
      title: '基本信息', path: 'site',
      fields: [
        { key: 'name', label: '公司全称', type: 'text', required: true },
        { key: 'nameEn', label: '公司全称（英文）', type: 'text' },
        { key: 'nameShort', label: '品牌简称（导航栏显示）', type: 'text' },
        { key: 'description', label: '公司简介（页脚显示）', type: 'textarea', rows: 2 },
        { key: 'logo', label: 'Logo', type: 'image' }
      ]
    },
    {
      title: '联系方式', path: 'contact',
      fields: [
        { key: 'phone', label: '联系电话（纯数字）', type: 'text' },
        { key: 'phoneDisplay', label: '联系电话（展示格式）', type: 'text' },
        { key: 'contactPerson', label: '联系人', type: 'text' },
        { key: 'salesEmail', label: '销售邮箱', type: 'text' },
        { key: 'irEmail', label: '投资者邮箱', type: 'text' },
        { key: 'addressFull', label: '完整地址', type: 'text' }
      ]
    },
    {
      title: '页脚与备案', path: 'footer',
      fields: [
        { key: 'copyright', label: '版权文字', type: 'text' },
        { key: 'icp', label: 'ICP 备案号', type: 'text' },
        { key: 'icpUrl', label: 'ICP 备案链接', type: 'text' },
        { key: 'policeBeiAn', label: '公安备案号', type: 'text' },
        { key: 'policeUrl', label: '公安备案链接', type: 'text' }
      ]
    }
  ];

  /** 办公地点字段 */
  var LOCATION_FIELDS = [
    { key: 'name', label: '名称（中文）', type: 'text', required: true },
    { key: 'nameEn', label: '名称（英文）', type: 'text' },
    { key: 'address', label: '地址', type: 'text' },
    { key: 'phone', label: '电话', type: 'text' },
    { key: 'email', label: '邮箱', type: 'text' }
  ];

  /** 渲染站点设置页（分组表单 + 办公地点列表编辑） */
  async function renderConfigPage() {
    var container = document.getElementById('page-container');
    var config = await loadCollection('config');

    var groupsHTML = CONFIG_GROUPS.map(function (g, gi) {
      var obj = config[g.path] || {};
      return '<div class="card card-shadow mb-3"><div class="card-header bg-white fw-bold">' + esc(g.title) + '</div>' +
        '<div class="card-body" data-group="' + gi + '">' +
        g.fields.map(function (f) { return renderField(f, obj[f.key]); }).join('') +
        '</div></div>';
    }).join('');

    var locations = config.locations || [];
    var locRows = locations.map(function (loc, idx) {
      return '<tr><td>' + esc(loc.name) + '</td><td>' + esc(loc.address) + '</td><td>' + esc(loc.phone || '') + '</td>' +
        '<td class="text-nowrap">' +
        '<button class="btn btn-sm btn-outline-primary me-1" data-loc-edit="' + idx + '">编辑</button>' +
        '<button class="btn btn-sm btn-outline-danger" data-loc-del="' + idx + '">删除</button></td></tr>';
    }).join('');

    container.innerHTML =
      '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h1 class="page-title">站点设置</h1>' +
      '<button class="btn btn-primary" id="config-save">保存全部修改</button></div>' +
      groupsHTML +
      '<div class="card card-shadow mb-3"><div class="card-header bg-white fw-bold d-flex justify-content-between align-items-center">办公地点' +
      '<button class="btn btn-sm btn-primary" id="loc-add">＋ 新增地点</button></div>' +
      '<div class="card-body p-0"><table class="table table-hover mb-0"><thead><tr><th>名称</th><th>地址</th><th>电话</th><th>操作</th></tr></thead>' +
      '<tbody>' + (locRows || '<tr><td colspan="4" class="text-center text-muted py-3">暂无</td></tr>') + '</tbody></table></div></div>';

    // 保存全部
    document.getElementById('config-save').addEventListener('click', async function () {
      try {
        CONFIG_GROUPS.forEach(function (g, gi) {
          var el = container.querySelector('[data-group="' + gi + '"]');
          config[g.path] = collectFields(el, g.fields, config[g.path] || {});
        });
        await saveCollection('config');
        toast('站点设置已保存，前台已生效', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });

    // 办公地点：编辑/删除/新增（复用弹窗引擎，页面级伪造一个 list page）
    var fakeLocPage = {
      title: '办公地点', collection: 'config', section: 'locations',
      itemName: '办公地点', fields: LOCATION_FIELDS,
      columns: [{ label: '名称', key: 'name' }]
    };
    container.querySelectorAll('[data-loc-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openEditor(fakeLocPage, locations[parseInt(btn.getAttribute('data-loc-edit'), 10)], parseInt(btn.getAttribute('data-loc-edit'), 10));
      });
    });
    container.querySelectorAll('[data-loc-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirmDialog('确定删除该办公地点？')) return;
        locations.splice(parseInt(btn.getAttribute('data-loc-del'), 10), 1);
        await saveCollection('config');
        toast('已删除', 'success');
        renderConfigPage();
      });
    });
    document.getElementById('loc-add').addEventListener('click', function () {
      openEditor(fakeLocPage, null, -1);
    });
    // 弹窗保存后如果当前在 config 页，刷新列表显示
    window._afterEditorSave = function () { renderConfigPage(); };
  }

  // ==================== 特殊页面：多语言文案 ====================

  /**
   * 将嵌套对象扁平化为 [{path, value}]（仅字符串叶子）
   */
  function flattenI18n(obj, prefix, out) {
    out = out || [];
    Object.keys(obj || {}).forEach(function (k) {
      var v = obj[k];
      var p = prefix ? prefix + '.' + k : k;
      if (typeof v === 'string') out.push({ path: p, value: v });
      else if (v && typeof v === 'object' && !Array.isArray(v)) flattenI18n(v, p, out);
    });
    return out;
  }

  /**
   * 将扁平键值重装为嵌套对象（值为空的行跳过，让前台回退到内置默认文案）
   */
  function rebuildI18n(rows) {
    var root = {};
    rows.forEach(function (r) {
      if (!r.path) return;
      var value = (r.value || '').trim();
      if (!value) return;
      var parts = r.path.split('.');
      var node = root;
      for (var i = 0; i < parts.length - 1; i++) {
        if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
        node = node[parts[i]];
      }
      node[parts[parts.length - 1]] = value;
    });
    return root;
  }

  /** 当前 i18n 页选中的语言 */
  var i18nLang = 'zh';

  /** 渲染多语言文案编辑页 */
  async function renderI18nPage() {
    var container = document.getElementById('page-container');
    var collectionName = 'i18n-' + i18nLang;
    var data = await loadCollection(collectionName);
    var rows = flattenI18n(data);

    // 按一级 key 分组
    var groups = {};
    rows.forEach(function (r) {
      var top = r.path.split('.')[0];
      (groups[top] = groups[top] || []).push(r);
    });

    var langTabs = ['zh', 'en', 'ru'].map(function (l) {
      return '<button class="nav-link ' + (l === i18nLang ? 'active' : '') + '" data-lang-tab="' + l + '">' +
        ({ zh: '中文', en: 'English', ru: 'Русский' })[l] + '</button>';
    }).join('');

    var groupNames = { nav: '导航菜单', products: '产品中心', diagrams: '应用框图', news: '新闻中心', contact: '联系我们', footer: '页脚', legal: '法律条款', home: '首页文案', common: '通用', success: '提交成功页', search: '搜索页', about: '关于我们' };

    var groupsHTML = Object.keys(groups).map(function (g, gi) {
      var items = groups[g].map(function (r) {
        var long = r.value.length > 60;
        var input = long
          ? '<textarea class="form-control form-control-sm" rows="3" data-i18n-row="' + esc(r.path) + '">' + esc(r.value) + '</textarea>'
          : '<input type="text" class="form-control form-control-sm" data-i18n-row="' + esc(r.path) + '" value="' + esc(r.value) + '">';
        return '<div class="mb-2"><div class="i18n-key mb-1">' + esc(r.path) + '</div>' + input + '</div>';
      }).join('');
      return '<div class="accordion-item">' +
        '<h2 class="accordion-header"><button class="accordion-button ' + (gi === 0 ? '' : 'collapsed') + '" type="button" data-bs-toggle="collapse" data-bs-target="#i18n-g' + gi + '">' +
        (groupNames[g] || g) + ' <span class="badge bg-secondary ms-2">' + groups[g].length + '</span></button></h2>' +
        '<div id="i18n-g' + gi + '" class="accordion-collapse collapse ' + (gi === 0 ? 'show' : '') + '"><div class="accordion-body">' + items + '</div></div>' +
        '</div>';
    }).join('');

    container.innerHTML =
      '<div class="d-flex justify-content-between align-items-center mb-3">' +
      '<h1 class="page-title">多语言文案</h1>' +
      '<button class="btn btn-primary" id="i18n-save">保存当前语言</button></div>' +
      '<div class="text-muted small mb-3">此处维护界面固定文案（导航、按钮、栏目标题等）。保存后前台对应语言页面立即生效；输入框留空表示清空该文案（前台将回退显示内置默认值）。</div>' +
      '<ul class="nav nav-tabs mb-3">' + langTabs + '</ul>' +
      '<div class="accordion i18n-group">' + groupsHTML + '</div>';

    // 切换语言
    container.querySelectorAll('[data-lang-tab]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        i18nLang = btn.getAttribute('data-lang-tab');
        renderI18nPage();
      });
    });

    // 保存
    document.getElementById('i18n-save').addEventListener('click', async function () {
      var newRows = [];
      container.querySelectorAll('[data-i18n-row]').forEach(function (input) {
        newRows.push({ path: input.getAttribute('data-i18n-row'), value: input.value });
      });
      try {
        await saveCollection(collectionName, rebuildI18n(newRows));
        toast('多语言文案已保存，前台已生效', 'success');
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // ==================== 特殊页面：修改密码 ====================

  /** 渲染修改密码页 */
  function renderPasswordPage() {
    var container = document.getElementById('page-container');
    container.innerHTML =
      '<h1 class="page-title mb-3">修改密码</h1>' +
      '<div class="card card-shadow" style="max-width:480px"><div class="card-body">' +
      '<div class="mb-3"><label class="form-label">原密码</label><input type="password" class="form-control" id="pw-old"></div>' +
      '<div class="mb-3"><label class="form-label">新密码（至少 8 位）</label><input type="password" class="form-control" id="pw-new"></div>' +
      '<div class="mb-3"><label class="form-label">确认新密码</label><input type="password" class="form-control" id="pw-new2"></div>' +
      '<button class="btn btn-primary" id="pw-save">修改密码</button>' +
      '</div></div>';
    document.getElementById('pw-save').addEventListener('click', async function () {
      var oldPw = document.getElementById('pw-old').value;
      var newPw = document.getElementById('pw-new').value;
      var newPw2 = document.getElementById('pw-new2').value;
      if (newPw !== newPw2) { toast('两次输入的新密码不一致', 'error'); return; }
      try {
        await api('/api/auth/password', { method: 'POST', body: { oldPassword: oldPw, newPassword: newPw } });
        toast('密码修改成功，请牢记新密码', 'success');
        container.querySelectorAll('input').forEach(function (i) { i.value = ''; });
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  // ==================== 路由 ====================

  /** hash 路由分发 */
  function route() {
    var hash = (location.hash || '#/dashboard').replace(/^#\//, '');
    var page = PAGES[hash];
    var container = document.getElementById('page-container');

    // 侧栏高亮
    document.querySelectorAll('.sidebar .nav-link').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-page') === hash);
    });
    document.getElementById('sidebar').classList.remove('show');

    // 清理 config 页挂载的回调
    if (hash !== 'config') window._afterEditorSave = null;

    if (hash === 'dashboard') return renderDashboard();
    if (hash === 'config') return renderConfigPage();
    if (hash === 'i18n') return renderI18nPage();
    if (hash === 'password') return renderPasswordPage();
    if (page) {
      if (page.type === 'single') return renderSinglePage(page);
      return renderListPage(page);
    }
    container.innerHTML = '<div class="alert alert-warning">页面不存在：' + esc(hash) + '</div>';
  }

  // ==================== 初始化 ====================

  /** 应用入口 */
  function init() {
    bindLogin();
    bindImageUploads(document.getElementById('page-container'));
    bindImageUploads(document.getElementById('editor-form'));

    document.getElementById('editor-save').addEventListener('click', saveEditor);
    document.getElementById('logout-btn').addEventListener('click', function () { logout(true); });
    document.getElementById('sidebar-toggle').addEventListener('click', function () {
      document.getElementById('sidebar').classList.toggle('show');
    });
    window.addEventListener('hashchange', route);

    // 已有 token 则校验有效性
    if (localStorage.getItem(TOKEN_KEY)) {
      api('/api/auth/me')
        .then(function () { showApp(); })
        .catch(function () { showLogin(); });
    } else {
      showLogin();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
