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

  // 加载产品数据
  async function loadProducts() {
    try {
      const response = await fetch(getBasePath() + 'data/products.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load products:', error);
      return { categories: [], products: [] };
    }
  }

  // 加载新闻数据
  async function loadNews() {
    try {
      const response = await fetch(getBasePath() + 'data/news.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load news:', error);
      return { types: [], news: [] };
    }
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

  // 渲染产品分类侧边栏
  function renderProductSidebar(container, categories, currentCat) {
    const items = categories.map(cat => {
      const isActive = cat.id === currentCat ? 'active' : '';
      return `<a href="index.html?cat=${cat.id}" class="list-group-item list-group-item-action ${isActive}">${localized(cat, 'name')}</a>`;
    }).join('');

    container.innerHTML = `
      <h6 class="mb-3 fw-bold text-dark">${t('products.categories')}</h6>
      <div class="list-group list-group-flush">${items}</div>
    `;
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
      container.innerHTML = '<div class="text-center text-muted py-5"><p>暂无新闻数据</p></div>';
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

  // 渲染首页新闻区块
  async function renderHomeNews(container) {
    const newsData = await loadNews();
    const news = newsData.news.slice(0, 3);
    const basePath = getBasePath();

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

  // 暴露全局方法
  window.HYXRenderer = {
    loadProducts,
    loadNews,
    renderProductSidebar,
    renderProductCards,
    renderNewsCards,
    renderNewsTabs,
    renderContactCards,
    renderLocations,
    renderHomeNews
  };

})();
