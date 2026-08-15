/**
 * 弘易芯科技官网 - 数据渲染器
 * 动态渲染产品、新闻、联系方式等数据
 * 生产环境版本：从 data/ 目录加载 JSON 数据
 */

(function () {
  'use strict';

  // 获取基础路径
  function getBasePath() {
    return window.HYXData?.basePath || './';
  }

  // 统一请求选项：禁用缓存，保证后台修改后前台立即生效
  function fetchOptions() {
    return { cache: 'no-store' };
  }

  // 加载产品数据
  async function loadProducts() {
    try {
      const response = await fetch(getBasePath() + 'data/products.json', fetchOptions());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load products:', error);
      return { categories: [], products: [] };
    }
  }

  // 加载代理品牌数据
  async function loadBrands() {
    try {
      const response = await fetch(getBasePath() + 'data/brands.json', fetchOptions());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load brands:', error);
      return { brands: [] };
    }
  }

  // 加载分销品牌数据
  async function loadDistributionBrands() {
    try {
      const response = await fetch(getBasePath() + 'data/distribution-brands.json', fetchOptions());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load distribution brands:', error);
      return { brands: [] };
    }
  }

  // 加载新闻数据
  async function loadNews() {
    try {
      const response = await fetch(getBasePath() + 'data/news.json', fetchOptions());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load news:', error);
      return { types: [], news: [] };
    }
  }

  // 加载首页数据（英雄区轮播 + 关于区块，可在后台管理）
  async function loadHome() {
    try {
      const response = await fetch(getBasePath() + 'data/home.json', fetchOptions());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load home:', error);
      return { slides: [], about: null };
    }
  }

  // 从 {zh, en, ru} 对象中按当前语言取文案
  function pickLangText(obj) {
    if (!obj || typeof obj !== 'object') return '';
    const lang = window.HYXData && window.HYXData.lang ? window.HYXData.lang : 'zh';
    return obj[lang] || obj.zh || obj.en || obj.ru || '';
  }

  // 计算图片地址（相对路径基于站点根）
  function resolveAssetUrl(url) {
    if (!url) return '';
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('/')) return url;
    return getBasePath().replace(/\/?$/, '/') + url.replace(/^\//, '');
  }

  // 渲染首页英雄区轮播（数据来自 home.json，后台可改图片与文字）
  async function renderHeroCarousel(container) {
    const data = await loadHome();
    const slides = data.slides || [];
    if (!container) return;
    if (!slides.length) {
      container.innerHTML = '<div class="carousel-item active" style="height:420px;background-color:#0d2a4d;"></div>';
      return;
    }
    const indicators = slides.map((s, i) =>
      `<button type="button" data-bs-target="#mainCarousel" data-bs-slide-to="${i}" ${i === 0 ? 'class="active" aria-current="true"' : ''}></button>`
    ).join('');
    const items = slides.map((s, i) => {
      const bg = resolveAssetUrl(s.image);
      const link = s.link || '';
      const title = pickLangText(s.title);
      const desc = pickLangText(s.description);
      const caption = `
        <div class="container">
          <div class="carousel-caption">
            ${title ? `<h2>${title}</h2>` : ''}
            ${desc ? `<p>${desc}</p>` : ''}
            ${link ? `<a href="${link}" class="btn btn-light mt-2">${t('home.learnMore')}</a>` : ''}
          </div>
        </div>`;
      return `
        <div class="carousel-item ${i === 0 ? 'active' : ''}" style="background-image:linear-gradient(135deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.25) 100%)${bg ? `, url('${bg}')` : ''};">
          ${caption}
        </div>`;
    }).join('');
    container.innerHTML = `
      <div id="mainCarousel" class="carousel slide" data-bs-ride="carousel">
        <div class="carousel-indicators">${indicators}</div>
        <div class="carousel-inner">${items}</div>
        <button class="carousel-control-prev" type="button" data-bs-target="#mainCarousel" data-bs-slide="prev">
          <span class="carousel-control-prev-icon"></span>
        </button>
        <button class="carousel-control-next" type="button" data-bs-target="#mainCarousel" data-bs-slide="next">
          <span class="carousel-control-next-icon"></span>
        </button>
      </div>`;
  }

  // 渲染首页「关于我们」区块（数据来自 home.json）
  async function renderHomeAbout(container) {
    if (!container) return;
    const data = await loadHome();
    const about = data.about;
    if (!about) { container.innerHTML = ''; return; }
    const img = resolveAssetUrl(about.image);
    const link = about.link || 'about/index.html';
    container.innerHTML = `
      <div class="row align-items-center">
        <div class="col-lg-6">
          <h2 class="section-title">${pickLangText(about.title)}</h2>
          <p class="section-subtitle">${pickLangText(about.subtitle)}</p>
          <p class="intro-text">${pickLangText(about.text)}</p>
          <a href="${link}" class="btn btn-hyx-primary">${pickLangText(about.linkText)}</a>
        </div>
        <div class="col-lg-6 mt-4 mt-lg-0">
          <img src="${img}" alt="${pickLangText(about.title)}" class="img-fluid rounded-10 shadow">
        </div>
      </div>`;
  }

  function t(key) {
    return (window.HYXUtils?.getT || window.HYXUtils?.t || (k => k))(key);
  }

  function c(key) {
    return (window.HYXUtils?.c || (() => ''))(key);
  }

  function localized(obj, field) {
    return (window.HYXUtils?.localized || (() => ''))(obj, field);
  }

  // 渲染分销品牌卡片（与代理品牌页面格式一致：Logo + 名称 + 官网链接 + 简短说明）
  function renderDistributionBrandCards(container, brands) {
    if (!brands || brands.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-5"><p>暂无分销品牌数据</p></div>';
      return;
    }
    const lang = window.HYXData && window.HYXData.lang ? window.HYXData.lang : 'zh';
    const nameKey = lang === 'zh' ? 'name' : 'nameEn';
    const descKey = lang === 'zh' ? 'description' : 'descriptionEn';
    const basePath = getBasePath();
    const cards = brands.map(b => {
      const name = b[nameKey] || b.name;
      const desc = b[descKey] || b.description || '';
      const url = b.url || '#';
      const logo = b.logo || '';
      const logoSrc = (logo && logo.startsWith('http')) ? logo : (basePath + logo);
      return `
        <div class="col-xl-2 col-lg-3 col-md-4 col-sm-6">
          <div class="card brand-card h-100">
            <div class="brand-logo-wrap">
              <img src="${logoSrc}" class="brand-logo" alt="${name}" onerror="this.style.display='none'; var s=this.nextElementSibling; if(s){ s.style.display='block'; s.classList.remove('d-none'); }">
              <span class="d-none fw-bold text-secondary">${name}</span>
            </div>
            <div class="card-body">
              <h5 class="card-title">${name}</h5>
              <p class="card-text">${desc}</p>
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="brand-link">访问官网 &#8594;</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
    container.innerHTML = `<div class="row g-4">${cards}</div>`;
  }

  // 渲染代理品牌卡片（Logo + 名称 + 官网链接 + 简短说明）
  function renderBrandCards(container, brands) {
    if (!brands || brands.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-5"><p>暂无代理品牌数据</p></div>';
      return;
    }
    const lang = window.HYXData && window.HYXData.lang ? window.HYXData.lang : 'zh';
    const nameKey = lang === 'zh' ? 'name' : 'nameEn';
    const descKey = lang === 'zh' ? 'description' : 'descriptionEn';
    const basePath = getBasePath();
    const cards = brands.map(b => {
      const name = b[nameKey] || b.name;
      const desc = b[descKey] || b.description || '';
      const url = b.url || '#';
      const logo = b.logo || '';
      const logoSrc = (logo && logo.startsWith('http')) ? logo : (basePath + logo);
      return `
        <div class="col-xl-2 col-lg-3 col-md-4 col-sm-6">
          <div class="card brand-card h-100">
            <div class="brand-logo-wrap">
              <img src="${logoSrc}" class="brand-logo" alt="${name}" onerror="this.style.display='none'; var s=this.nextElementSibling; if(s){ s.style.display='block'; s.classList.remove('d-none'); }">
              <span class="d-none fw-bold text-secondary">${name}</span>
            </div>
            <div class="card-body">
              <h5 class="card-title">${name}</h5>
              <p class="card-text">${desc}</p>
              <a href="${url}" target="_blank" rel="noopener noreferrer" class="brand-link">访问官网 &#8594;</a>
            </div>
          </div>
        </div>
      `;
    }).join('');
    container.innerHTML = `<div class="row g-4">${cards}</div>`;
  }

  // 渲染产品卡片
  function renderProductCards(container, products, basePath) {
    if (!products || products.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-5"><p>暂无产品数据</p></div>';
      return;
    }

    const cards = products.map(product => `
      <div class="col-sm-6 col-md-4">
        <a href="detail.html?id=${product.id}" class="text-decoration-none text-dark">
          <div class="card product-card">
            <img src="${product.image}" class="card-img-top" alt="${localized(product, 'name')}">
            <div class="card-body">
              <h5 class="card-title">${localized(product, 'name')}</h5>
              <p class="card-text small text-muted">${localized(product, 'description')}</p>
            </div>
          </div>
        </a>
      </div>
    `).join('');

    container.innerHTML = `<div class="row g-4">${cards}</div>`;
  }

  // 渲染新闻卡片
  function renderNewsCards(container, news, basePath, limit = null) {
    if (!news || news.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-5 py-lg-5"><p class="mb-0">内容筹备中，敬请期待。</p></div>';
      return;
    }

    const items = limit ? news.slice(0, limit) : news;

    const cards = items.map(item => `
      <div class="col-md-6 col-lg-4">
        <a href="detail.html?id=${item.id}" class="text-decoration-none text-dark">
          <div class="card news-card">
            <img src="${item.image}" class="card-img-top" alt="">
            <div class="card-body">
              <div class="news-date">${item.date}</div>
              <h5 class="card-title">${localized(item, 'title')}</h5>
            </div>
          </div>
        </a>
      </div>
    `).join('');

    container.innerHTML = `<div class="row g-4">${cards}</div>`;
  }

  // 渲染新闻分类标签
  function renderNewsTabs(container, types, currentType) {
    const tabs = types.map(type => {
      const isActive = type.id === currentType ? 'active' : '';
      return `<li class="nav-item"><a class="nav-link ${isActive}" href="index.html?type=${type.id}">${localized(type, 'name')}</a></li>`;
    }).join('');

    const allActive = !currentType ? 'active' : '';
    container.innerHTML = `
      <li class="nav-item"><a class="nav-link ${allActive}" href="index.html">${t('news.all')}</a></li>
      ${tabs}
    `;
  }

  // 渲染联系方式卡片
  function renderContactCards(container) {
    container.innerHTML = `
      <div class="col-md-6 col-lg-3">
        <div class="contact-card">
          <div class="icon-wrap mb-3">📞</div>
          <h6 class="fw-bold">${t('contact.phone')}</h6>
          <p class="mb-0 text-muted small">${c('contact.phoneDisplay')}</p>
          <p class="mb-0 text-muted small">联系人：${c('contact.contactPerson')}</p>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="contact-card">
          <div class="icon-wrap mb-3">✉️</div>
          <h6 class="fw-bold">${t('contact.email')}</h6>
          <p class="mb-0 text-muted small">${c('contact.salesEmail')}</p>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="contact-card">
          <div class="icon-wrap mb-3">📧</div>
          <h6 class="fw-bold">${t('contact.irEmail')}</h6>
          <p class="mb-0 text-muted small">${c('contact.irEmail')}</p>
        </div>
      </div>
      <div class="col-md-6 col-lg-3">
        <div class="contact-card">
          <div class="icon-wrap mb-3">📍</div>
          <h6 class="fw-bold">${t('contact.address')}</h6>
          <p class="mb-0 text-muted small">${c('contact.addressFull')}</p>
        </div>
      </div>
    `;
  }

  // 渲染办公地点
  function renderLocations(container, locations) {
    if (!locations || locations.length === 0) {
      container.innerHTML = '<li class="text-muted">暂无办公地点信息</li>';
      return;
    }

    const items = locations.map(loc => `
      <li class="mb-2">
        <strong>${localized(loc, 'name')}</strong><br>
        <span class="text-muted small">${loc.address}</span>
        ${loc.phone ? `<br><span class="text-muted small">电话：${loc.phone}</span>` : ''}
      </li>
    `).join('');

    container.innerHTML = items;
  }

  // 渲染首页新闻区块（链接使用 navBase 以保持同语言）
  async function renderHomeNews(container) {
    const newsData = await loadNews();
    const news = (newsData.news || []).slice(0, 3);
    const basePath = (window.HYXUtils && window.HYXUtils.getNavBasePath) ? window.HYXUtils.getNavBasePath() : getBasePath();

    if (!news || news.length === 0) {
      container.innerHTML = '<div class="text-center text-muted py-4"><p class="mb-0">内容筹备中，敬请期待。</p><a href="' + basePath + 'news/index.html" class="btn btn-hyx-outline mt-3">' + t('news.readMore') + '</a></div>';
      return;
    }

    const cards = news.map(item => `
      <div class="col-md-6 col-lg-4">
        <a href="${basePath}news/detail.html?id=${item.id}" class="text-decoration-none text-dark">
          <div class="card news-card">
            <img src="${item.image}" class="card-img-top" alt="">
            <div class="card-body">
              <div class="news-date">${item.date}</div>
              <h5 class="card-title">${localized(item, 'title')}</h5>
            </div>
          </div>
        </a>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="row g-4">${cards}</div>
      <div class="text-center mt-4">
        <a href="${basePath}news/index.html" class="btn btn-hyx-outline">${t('news.readMore')}</a>
      </div>
    `;
  }

  // 加载应用框图分类
  async function loadDiagramCategories() {
    try {
      const basePath = getBasePath();
      const response = await fetch(basePath + 'data/diagram-categories.json', fetchOptions());
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      return data && data.categories ? data.categories : [];
    } catch (err) {
      console.error('Failed to load diagram categories:', err);
      return [];
    }
  }

  // 渲染新闻列表页（typeFilter 为 null 时显示全部；数据来自后台）
  async function renderNewsList(container, typeFilter) {
    if (!container) return;
    const newsData = await loadNews();
    let list = newsData.news || [];
    if (typeFilter) list = list.filter(n => n.type === typeFilter);
    if (!list.length) {
      container.innerHTML = '<div class="text-muted py-4"><p class="mb-0">' + t('news.placeholder') + '</p></div>';
      return;
    }
    const cards = list.map(item => `
      <div class="col-md-6 col-lg-4 mb-4">
        <a href="detail.html?id=${item.id}" class="text-decoration-none text-dark d-block h-100">
          <div class="card news-card h-100">
            <img src="${resolveAssetUrl(item.image)}" class="card-img-top" alt="">
            <div class="card-body">
              <div class="news-date">${item.date || ''}</div>
              <h5 class="card-title">${localized(item, 'title')}</h5>
              ${item.summary ? `<p class="card-text small text-muted">${localized(item, 'summary')}</p>` : ''}
            </div>
          </div>
        </a>
      </div>
    `).join('');
    container.innerHTML = `<div class="row g-4">${cards}</div>`;
  }

  // 获取地址栏查询参数
  function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  // 渲染新闻详情页（根据 ?id= 从后台数据加载）
  async function renderNewsDetail(metaEl, bodyEl) {
    if (!metaEl && !bodyEl) return;
    const newsData = await loadNews();
    const id = getQueryParam('id');
    const item = (newsData.news || []).find(n => String(n.id) === String(id));
    if (!item) {
      if (metaEl) metaEl.innerHTML = '';
      if (bodyEl) bodyEl.innerHTML = `
        <div class="text-muted py-5 text-center">
          <p class="mb-3">${t('news.placeholder')}</p>
          <a href="index.html" class="btn btn-hyx-outline">${t('news.backToList')}</a>
        </div>`;
      return;
    }
    if (metaEl) {
      const typeName = (newsData.types || []).find(tp => tp.id === item.type);
      metaEl.innerHTML = `
        <div class="text-muted small mb-2">${item.date || ''}${typeName ? ' · ' + localized(typeName, 'name') : ''}</div>
        <h2 class="h4 fw-bold">${localized(item, 'title')}</h2>`;
    }
    if (bodyEl) {
      const img = resolveAssetUrl(item.image);
      const content = localized(item, 'content') || (item.summary ? localized(item, 'summary') : '');
      bodyEl.innerHTML = `
        ${img ? `<img src="${img}" class="img-fluid rounded mb-4" alt="">` : ''}
        <div class="article-text">${content || ''}</div>`;
    }
  }

  // 计算框图图片地址
  function diagramImgSrc(url, basePath) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url;
    const imgBase = (basePath !== undefined && basePath !== null) ? basePath : getBasePath();
    return imgBase.replace(/\/?$/, '/') + url.replace(/^\//, '');
  }

  // 渲染应用框图页：左侧分类列表，右侧默认只显示当前选中一项
  function renderDiagramPage(sidebarEl, contentEl, categories, basePath) {
    if (!categories || categories.length === 0) {
      if (sidebarEl) sidebarEl.innerHTML = '<p class="text-muted small">暂无分类</p>';
      if (contentEl) contentEl.innerHTML = '<p class="text-muted">内容筹备中，敬请期待。</p>';
      return;
    }
    const lang = (window.HYXData && window.HYXData.lang) ? window.HYXData.lang : 'zh';
    const nameKey = lang === 'zh' ? 'name' : 'nameEn';
    const subNameKey = lang === 'zh' ? 'subName' : 'subNameEn';

    if (sidebarEl) {
      sidebarEl.innerHTML = categories.map((cat, i) => `
        <a href="javascript:void(0)" class="list-group-item list-group-item-action diagram-nav-item ${i === 0 ? 'active' : ''}" data-id="${cat.id}">
          <div class="fw-semibold">${cat[nameKey]}</div>
          <div class="small text-muted">${cat[subNameKey]}</div>
        </a>
      `).join('');
    }

    // 右侧只显示默认选中的第一项
    updateDiagramContent(contentEl, categories[0], basePath);
  }

  // 更新右侧框图区域为指定分类（供点击左侧标签时调用）
  function updateDiagramContent(contentEl, category, basePath) {
    if (!contentEl || !category) return;
    const lang = (window.HYXData && window.HYXData.lang) ? window.HYXData.lang : 'zh';
    const nameKey = lang === 'zh' ? 'name' : 'nameEn';
    const subNameKey = lang === 'zh' ? 'subName' : 'subNameEn';
    const src = diagramImgSrc(category.image, basePath);
    contentEl.innerHTML = `
      <div class="diagram-block">
        <h3 class="h5 fw-bold mb-3">${category[nameKey]} · ${category[subNameKey]}</h3>
        <img src="${src}" alt="${category[nameKey]} ${category[subNameKey]}" class="img-fluid rounded shadow diagram-img" onerror="this.style.background='#f3f4f6';this.alt='图片加载失败：'+this.alt;">
      </div>
    `;
  }

  // 暴露全局方法
  window.HYXRenderer = {
    loadProducts,
    loadNews,
    loadBrands,
    loadDistributionBrands,
    loadDiagramCategories,
    loadHome,
    renderDistributionBrandCards,
    renderProductCards,
    renderBrandCards,
    renderNewsCards,
    renderNewsTabs,
    renderNewsList,
    renderNewsDetail,
    renderDiagramPage,
    updateDiagramContent,
    renderContactCards,
    renderLocations,
    renderHomeNews,
    renderHeroCarousel,
    renderHomeAbout
  };

})();
