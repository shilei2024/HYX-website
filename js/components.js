/**
 * 弘易芯科技官网 - 组件加载器
 * 动态加载导航栏、页脚等公共组件
 * 生产环境版本：从 data/ 目录加载 JSON 数据
 */

(function () {
  'use strict';

  // 全局数据缓存
  window.HYXData = {
    config: null,
    i18n: null,
    lang: getCurrentLang(),
    basePath: './'
  };

  // 获取当前语言
  function getCurrentLang() {
    // 优先从路径判断
    const path = window.location.pathname;
    if (path.includes('/en/') || path.startsWith('/en')) return 'en';
    if (path.includes('/ru/') || path.startsWith('/ru')) return 'ru';
    
    // 否则从 HTML lang 属性获取
    const htmlLang = (document.documentElement.lang || 'zh-CN').toLowerCase();
    if (htmlLang.startsWith('en')) return 'en';
    if (htmlLang.startsWith('ru')) return 'ru';
    return 'zh';
  }

  // 获取相对路径前缀
  function getBasePath() {
    const path = window.location.pathname;
    
    // 根据路径中的斜杠数量计算深度
    const depth = (path.match(/\//g) || []).length - 1;
    
    // 返回相应数量的 ../
    if (depth === 0) return './';
    return '../'.repeat(depth);
  }

  // 获取语言切换链接
  function getLangLinks(basePath) {
    const path = window.location.pathname;
    const currentLang = getCurrentLang();

    // 获取当前页面文件名（包含相对路径）
    const pathParts = path.split('/').filter(Boolean);
    let fileName = 'index.html';
    
    // 找到最后一个部分作为文件名
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1];
      if (lastPart.endsWith('.html')) {
        fileName = lastPart;
      }
    }

    let zhPath, enPath, ruPath;

    if (currentLang === 'zh') {
      // 当前是中文
      if (pathParts[0] === 'en' || pathParts[0] === 'ru') {
        // 在子目录中
        zhPath = '../' + fileName;
        enPath = 'en/' + fileName;
        ruPath = 'ru/' + fileName;
      } else {
        // 根目录
        zhPath = fileName;
        enPath = 'en/' + fileName;
        ruPath = 'ru/' + fileName;
      }
    } else if (currentLang === 'en') {
      // 当前是英文
      zhPath = '../' + fileName;
      enPath = fileName;
      ruPath = '../ru/' + fileName;
    } else {
      // 当前是俄文
      zhPath = '../' + fileName;
      enPath = '../en/' + fileName;
      ruPath = fileName;
    }

    return { zhPath, enPath, ruPath };
  }

  // 加载 JSON 数据
  async function loadJSON(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to load JSON:', url, error);
      return null;
    }
  }

  // 多语言文案（内联，不依赖 data/i18n/*.json，避免加载失败导致显示 key）
  var LABELS = {
    zh: {
      nav: { home: '首页', products: '产品中心', about: '关于我们', news: '新闻中心', contact: '联系我们',
        dropdown: { passive: '被动元器件', capacitor: '电容', resistor: '电阻', inductor: '电感', active: '主动元器件', ic: 'IC 芯片', intro: '公司介绍', history: '发展历程', team: '技术团队', supply: '供应链优势', qual: '资质荣誉', company: '公司动态', industry: '行业新闻', tech: '技术文章' } },
      products: { title: '产品中心', subtitle: '被动元器件、主动元器件，电容电阻电感IC', categories: '产品分类', inquiry: '询价', download: '数据手册下载' },
      news: { title: '新闻中心', subtitle: '公司动态、行业新闻、技术文章', all: '全部', company: '公司动态', industry: '行业新闻', tech: '技术文章', readMore: '更多新闻' },
      contact: { title: '联系我们', subtitle: '业务咨询、全球据点、意见反馈', phone: '联系电话', email: '业务咨询', irEmail: '投资者咨询', address: '公司地址', locations: '全球据点', feedback: '意见反馈', name: '姓名', namePlaceholder: '您的姓名', emailLabel: '邮箱', emailPlaceholder: 'your@email.com', subject: '主题', subjectBusiness: '业务咨询', subjectProduct: '产品询价', subjectFeedback: '意见反馈', subjectOther: '其他', message: '留言', messagePlaceholder: '请填写您的留言内容', submit: '提交', submitSuccess: '感谢您的留言，我们会尽快与您联系。' },
      footer: { quickLinks: '快速链接', contact: '联系方式', legal: '法律条款', privacy: '隐私政策', terms: '使用条款', icp: '粤ICP备*********号', policeBeiAn: '粤公安备**********号' },
      home: { banner1Title: '授权代理 · 品质保障', banner1Desc: '弘易芯科技专注电子元器件分销与方案支持，携手国际一线品牌，为制造企业提供稳定可靠的供应链服务。', banner2Title: '被动 / 主动元器件全覆盖', banner2Desc: '电容、电阻、电感、IC等全品类供应，满足研发与量产需求，助力客户产品快速上市。', banner3Title: '技术赋能 · 方案中心', banner3Desc: '专业FAE团队提供选型、调试与量产支持，从概念到量产全程护航。', authorizedAgent: '授权代理', authorizedAgentDesc: '品牌授权与正品保障，合作厂商与资质一览', productCenter: '产品中心', productCenterDesc: '被动/主动元器件分类浏览与询价', solutionCenter: '方案中心', solutionCenterDesc: '技术方案与FAE支持，助力产品落地', contactUs: '联系我们', contactUsDesc: '业务咨询、全球据点与意见反馈', aboutTitle: '关于弘易芯科技', aboutSubtitle: '专业、可信赖的电子元器件授权代理商', aboutText: '深圳市弘易芯科技有限公司致力于为电子制造企业提供优质的元器件供应与技术支持。我们拥有完善的授权体系与供应链能力，覆盖被动元器件与主动元器件全品类，携手国际知名品牌，为客户提供从选型、小批量试产到大批量供货的一站式服务。公司注重技术投入与客户体验，以"专业、高效、可信赖"为理念，助力客户产品创新与市场竞争力提升。', learnMore: '了解更多', newsTitle: '新闻动态', newsSubtitle: '了解公司最新动态与行业资讯' },
      common: { search: '搜索产品/新闻', required: '必填', prevPage: '上一页', nextPage: '下一页' },
      about: { pageTitle: '关于我们 - 弘易芯科技', metaDesc: '弘易芯科技 - 公司介绍、发展历程、技术团队与供应链优势', heading: '公司介绍', intro1: '深圳市弘易芯科技有限公司致力于为电子制造企业提供优质的元器件供应与技术支持。我们拥有完善的授权体系与供应链能力，覆盖被动元器件与主动元器件全品类，携手国际知名品牌，为客户提供从选型、小批量试产到大批量供货的一站式服务。', intro2: '公司注重技术投入与客户体验，拥有专业 FAE 团队提供选型、调试与量产支持。我们以"专业、高效、可信赖"为理念，助力客户产品创新与市场竞争力提升。', card1Title: '授权代理', card1Text: '与多家国际一线品牌建立授权合作，正品保障。', card2Title: '方案支持', card2Text: '从选型到量产，FAE 团队全程技术支持。', imgAlt: '关于弘易芯' }
    },
    en: {
      nav: { home: 'Home', products: 'Products', about: 'About Us', news: 'News', contact: 'Contact',
        dropdown: { passive: 'Passive Components', capacitor: 'Capacitors', resistor: 'Resistors', inductor: 'Inductors', active: 'Active Components', ic: 'IC Chips', intro: 'Company Overview', history: 'History', team: 'Team', supply: 'Supply Chain', qual: 'Qualifications', company: 'Company News', industry: 'Industry News', tech: 'Tech Articles' } },
      products: { title: 'Products', subtitle: 'Passive and Active Components, Capacitors, Resistors, Inductors, ICs', categories: 'Categories', inquiry: 'Inquiry', download: 'Download Datasheet' },
      news: { title: 'News', subtitle: 'Company News, Industry Updates, Technical Articles', all: 'All', company: 'Company News', industry: 'Industry News', tech: 'Technical Articles', readMore: 'More News' },
      contact: { title: 'Contact Us', subtitle: 'Business Inquiries, Global Locations, Feedback', phone: 'Phone', email: 'Sales Inquiry', irEmail: 'Investor Relations', address: 'Address', locations: 'Global Locations', feedback: 'Feedback', name: 'Name', namePlaceholder: 'Your Name', emailLabel: 'Email', emailPlaceholder: 'your@email.com', subject: 'Subject', subjectBusiness: 'Business Inquiry', subjectProduct: 'Product Inquiry', subjectFeedback: 'Feedback', subjectOther: 'Other', message: 'Message', messagePlaceholder: 'Please enter your message', submit: 'Submit', submitSuccess: 'Thank you for your message. We will get back to you soon.' },
      footer: { quickLinks: 'Quick Links', contact: 'Contact', legal: 'Legal', privacy: 'Privacy Policy', terms: 'Terms of Use', icp: '粤ICP备*********号', policeBeiAn: '粤公安备**********号' },
      home: { banner1Title: 'Authorized Distribution · Quality Assurance', banner1Desc: 'HYIC specializes in electronic component distribution and solution support, partnering with top international brands to provide stable and reliable supply chain services for manufacturers.', banner2Title: 'Complete Coverage of Passive & Active Components', banner2Desc: 'Full range of capacitors, resistors, inductors, ICs and more, meeting R&D and mass production needs, helping customers bring products to market quickly.', banner3Title: 'Technical Empowerment · Solution Center', banner3Desc: 'Professional FAE team provides selection, debugging, and mass production support, escorting from concept to mass production.', authorizedAgent: 'Authorized Agent', authorizedAgentDesc: 'Brand authorization and genuine product guarantee', productCenter: 'Products', productCenterDesc: 'Browse and inquire about passive/active components', solutionCenter: 'Solutions', solutionCenterDesc: 'Technical solutions and FAE support', contactUs: 'Contact Us', contactUsDesc: 'Business inquiries, global locations and feedback', aboutTitle: 'About HYIC', aboutSubtitle: 'Professional and Trusted Electronic Component Authorized Distributor', aboutText: 'Shenzhen HYIC Technology Co., Ltd. is dedicated to providing quality component supply and technical support for electronics manufacturers. We have a comprehensive authorization system and supply chain capability, covering passive and active components across all categories, partnering with internationally renowned brands to provide one-stop services from selection, small batch trial production to large volume supply. The company focuses on technology investment and customer experience, with the philosophy of \'Professional, Efficient, Trusted\', helping customers innovate products and enhance market competitiveness.', learnMore: 'Learn More', newsTitle: 'Latest News', newsSubtitle: 'Stay updated with company news and industry insights' },
      common: { search: 'Search products/news', required: 'Required', prevPage: 'Previous', nextPage: 'Next' },
      about: { pageTitle: 'About Us - HYIC', metaDesc: 'HYIC - Company Overview, History, Team and Supply Chain', heading: 'Company Overview', intro1: 'Shenzhen HYIC Technology Co., Ltd. is dedicated to providing quality component supply and technical support for electronics manufacturers.', intro2: 'We focus on technology investment and customer experience, with a professional FAE team for selection, debugging and mass production support.', card1Title: 'Authorized Distribution', card1Text: 'Authorized partnership with international brands, genuine product guarantee.', card2Title: 'Solution Support', card2Text: 'FAE team provides full technical support from selection to mass production.', imgAlt: 'About HYIC' }
    },
    ru: {
      nav: { home: 'Главная', products: 'Продукция', about: 'О нас', news: 'Новости', contact: 'Контакты',
        dropdown: { passive: 'Пассивные компоненты', capacitor: 'Конденсаторы', resistor: 'Резисторы', inductor: 'Индукторы', active: 'Активные компоненты', ic: 'Микросхемы', intro: 'О компании', history: 'История', team: 'Команда', supply: 'Цепочка поставок', qual: 'Сертификаты', company: 'Новости компании', industry: 'Отраслевые новости', tech: 'Технические статьи' } },
      products: { title: 'Продукция', subtitle: 'Пассивные и активные компоненты, конденсаторы, резисторы, индукторы, микросхемы', categories: 'Категории', inquiry: 'Запрос', download: 'Скачать datasheet' },
      news: { title: 'Новости', subtitle: 'Новости компании, отраслевые новости, технические статьи', all: 'Все', company: 'Новости компании', industry: 'Отраслевые новости', tech: 'Технические статьи', readMore: 'Больше новостей' },
      contact: { title: 'Связаться с нами', subtitle: 'Бизнес-запросы, глобальные офисы, обратная связь', phone: 'Телефон', email: 'Запрос продаж', irEmail: 'Для инвесторов', address: 'Адрес', locations: 'Наши офисы', feedback: 'Обратная связь', name: 'Имя', namePlaceholder: 'Ваше имя', emailLabel: 'Email', emailPlaceholder: 'your@email.com', subject: 'Тема', subjectBusiness: 'Бизнес-запрос', subjectProduct: 'Запрос продукта', subjectFeedback: 'Обратная связь', subjectOther: 'Другое', message: 'Сообщение', messagePlaceholder: 'Пожалуйста, введите ваше сообщение', submit: 'Отправить', submitSuccess: 'Спасибо за ваше сообщение. Мы свяжемся с вами в ближайшее время.' },
      footer: { quickLinks: 'Быстрые ссылки', contact: 'Контакты', legal: 'Правовая информация', privacy: 'Политика конфиденциальности', terms: 'Условия использования', icp: '粤ICP备*********号', policeBeiAn: '粤公安备**********号' },
      home: { banner1Title: 'Авторизованная дистрибуция · Гарантия качества', banner1Desc: 'HYIC специализируется на дистрибуции электронных компонентов и технической поддержке, сотрудничая с ведущими международными брендами.', banner2Title: 'Полный ассортимент пассивных и активных компонентов', banner2Desc: 'Полный спектр конденсаторов, резисторов, индукторов, микросхем и других компонентов для НИОКР и серийного производства.', banner3Title: 'Техническая поддержка · Центр решений', banner3Desc: 'Профессиональная команда FAE обеспечивает поддержку от концепции до серийного производства.', authorizedAgent: 'Авторизованный агент', authorizedAgentDesc: 'Авторизация брендов и гарантия подлинности', productCenter: 'Продукция', productCenterDesc: 'Просмотр и запрос пассивных/активных компонентов', solutionCenter: 'Решения', solutionCenterDesc: 'Технические решения и поддержка FAE', contactUs: 'Связаться', contactUsDesc: 'Бизнес-запросы, глобальные офисы и обратная связь', aboutTitle: 'О компании HYIC', aboutSubtitle: 'Профессиональный и надежный авторизованный дистрибьютор электронных компонентов', aboutText: 'Shenzhen HYIC Technology Co., Ltd. стремится предоставлять качественные электронные компоненты и техническую поддержку производителям электроники. Мы имеем комплексную систему авторизации и возможности цепочки поставок, охватывающие все категории пассивных и активных компонентов.', learnMore: 'Подробнее', newsTitle: 'Последние новости', newsSubtitle: 'Будьте в курсе новостей компании и отраслевых событий' },
      common: { search: 'Поиск продуктов/новостей', required: 'Обязательно', prevPage: 'Назад', nextPage: 'Вперед' },
      about: { pageTitle: 'О нас - HYIC', metaDesc: 'HYIC - О компании, история, команда и цепочка поставок', heading: 'О компании', intro1: 'Shenzhen HYIC Technology Co., Ltd. предоставляет качественные компоненты и техническую поддержку производителям электроники.', intro2: 'Мы уделяем внимание технологиям и клиентскому опыту, имеем команду FAE для поддержки от выбора до серийного производства.', card1Title: 'Авторизованная дистрибуция', card1Text: 'Партнерство с международными брендами, гарантия подлинности.', card2Title: 'Техподдержка', card2Text: 'Команда FAE обеспечивает поддержку от выбора до серийного производства.', imgAlt: 'О HYIC' }
    }
  };

  // 初始化数据（仅加载 config，文案用内联 LABELS）
  async function initData() {
    const basePath = getBasePath();
    window.HYXData.basePath = basePath;
    var loadedConfig = await loadJSON(basePath + 'data/config.json');
    HYXData.config = loadedConfig;
    var lang = HYXData.lang || 'zh';
    HYXData.i18n = LABELS[lang] || LABELS.zh;
    return { config: loadedConfig, i18n: HYXData.i18n };
  }

  // 按 key 路径取当前语言文案（如 "footer.quickLinks" -> "快速链接"）
  function t(key) {
    var data = HYXData.i18n || LABELS.zh;
    var keys = key.split('.');
    var value = data;
    for (var i = 0; i < keys.length; i++) {
      if (value && typeof value === 'object' && keys[i] in value) value = value[keys[i]];
      else return key;
    }
    return typeof value === 'string' ? value : key;
  }

  function getT(key) {
    var value = t(key);
    return value && value !== key ? value : key;
  }

  // 导航/下拉等显示用文案（与 getT 一致，保留命名便于语义）
  function getNavLabel(key) {
    return getT('nav.' + key);
  }

  // 获取配置值
  function c(key) {
    if (!HYXData.config) return '';
    
    const keys = key.split('.');
    let value = HYXData.config;
    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return '';
      }
    }
    return value;
  }

  // 获取本地化字段 (优先使用当前语言版本)
  function localized(obj, field) {
    if (!obj) return '';
    const langSuffix = HYXData.lang === 'zh' ? '' : HYXData.lang.charAt(0).toUpperCase() + HYXData.lang.slice(1);
    const localizedField = field + langSuffix;
    return obj[localizedField] || obj[field] || '';
  }

  // 全站 data-i18n / data-placeholder 统一应用（避免各页重复内联脚本）
  function applyDataI18n() {
    const getT = window.HYXUtils?.getT || t;
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      const text = getT(key);
      if (text) el.textContent = text;
    });
    document.querySelectorAll('[data-placeholder]').forEach(function (el) {
      const key = el.getAttribute('data-placeholder');
      if (!key) return;
      const text = getT(key);
      if (text) el.placeholder = text;
    });
  }

  // 渲染导航栏（下拉项文案从 i18n 的 nav.dropdown.* 读取）
  function renderHeader(container, basePath) {
    const langLinks = getLangLinks(basePath);
    const currentLang = getCurrentLang();

    const navItems = [
      { key: 'home', href: basePath + 'index.html', active: false },
      {
        key: 'products', href: basePath + 'products/index.html', active: false,
        dropdown: [
          { key: 'passive', href: basePath + 'products/index.html?cat=passive' },
          { key: 'capacitor', href: basePath + 'products/index.html?cat=capacitor' },
          { key: 'resistor', href: basePath + 'products/index.html?cat=resistor' },
          { key: 'inductor', href: basePath + 'products/index.html?cat=inductor' },
          { divider: true },
          { key: 'active', href: basePath + 'products/index.html?cat=active' },
          { key: 'ic', href: basePath + 'products/index.html?cat=ic' }
        ]
      },
      {
        key: 'about', href: basePath + 'about/index.html', active: false,
        dropdown: [
          { key: 'intro', href: basePath + 'about/index.html' },
          { key: 'history', href: basePath + 'about/history.html' },
          { key: 'team', href: basePath + 'about/team.html' },
          { key: 'supply', href: basePath + 'about/supply-chain.html' },
          { key: 'qual', href: basePath + 'about/qualifications.html' }
        ]
      },
      {
        key: 'news', href: basePath + 'news/index.html', active: false,
        dropdown: [
          { key: 'company', href: basePath + 'news/index.html?type=company' },
          { key: 'industry', href: basePath + 'news/index.html?type=industry' },
          { key: 'tech', href: basePath + 'news/index.html?type=tech' }
        ]
      },
      { key: 'contact', href: basePath + 'contact/index.html', active: false }
    ];

    // 检测当前页面高亮
    const currentPath = window.location.pathname;
    navItems.forEach(item => {
      if (currentPath.includes('/' + item.key + '/') || currentPath.endsWith(item.key + '.html')) {
        item.active = true;
      }
    });

    const logoSrc = c('site.logo') || 'assets/logo.png';
    const siteName = c('site.nameShort') || c('site.nameEn'); // 统一使用中文名「弘易芯科技」

    let dropdownHTML = '';
    navItems.forEach(item => {
      if (item.dropdown) {
        let itemsHTML = item.dropdown.map(d => {
          if (d.divider) {
            return '<li><hr class="dropdown-divider"></li>';
          }
          const label = getT('nav.dropdown.' + d.key);
          return `<li><a class="dropdown-item" href="${d.href}">${label}</a></li>`;
        }).join('');

        dropdownHTML += `
          <li class="nav-item dropdown">
            <a class="nav-link dropdown-toggle ${item.active ? 'active' : ''}" href="${item.href}" data-bs-toggle="dropdown">${getNavLabel(item.key)}</a>
            <ul class="dropdown-menu">${itemsHTML}</ul>
          </li>
        `;
      } else {
        dropdownHTML += `
          <li class="nav-item">
            <a class="nav-link ${item.active ? 'active' : ''}" href="${item.href}">${getNavLabel(item.key)}</a>
          </li>
        `;
      }
    });

    container.innerHTML = `
      <nav class="navbar navbar-expand-lg navbar-light navbar-hyx">
        <div class="container">
          <a class="navbar-brand" href="${basePath}index.html">
            <img src="${basePath}${logoSrc}" alt="${siteName}" onerror="this.style.display='none'">
            <span>${siteName}</span>
          </a>
          <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarMain">
            <span class="navbar-toggler-icon"></span>
          </button>
          <div class="collapse navbar-collapse" id="navbarMain">
            <ul class="navbar-nav me-auto">${dropdownHTML}</ul>
            <div class="d-flex align-items-center">
              <div class="dropdown lang-dropdown me-3">
                <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="min-width: 80px;">
                  ${currentLang === 'zh' ? '中文' : currentLang === 'en' ? 'EN' : 'RU'}
                </button>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item ${currentLang === 'zh' ? 'active' : ''}" href="${basePath}${langLinks.zhPath}">中文</a></li>
                  <li><a class="dropdown-item ${currentLang === 'en' ? 'active' : ''}" href="${basePath}${langLinks.enPath}">EN</a></li>
                  <li><a class="dropdown-item ${currentLang === 'ru' ? 'active' : ''}" href="${basePath}${langLinks.ruPath}">RU</a></li>
                </ul>
              </div>
              <form class="d-flex search-box-header" id="header-search-form" role="search">
                <input class="form-control" type="search" placeholder="${getT('common.search')}" aria-label="搜索">
                <button class="btn btn-primary ms-2 rounded-circle" type="submit" style="width:40px;height:40px;padding:0">🔍</button>
              </form>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  // 渲染页脚
  function renderFooter(container, basePath) {
    container.innerHTML = `
      <div class="container">
        <div class="row">
          <div class="col-lg-4 mb-4 mb-lg-0">
            <div class="footer-title">${c('site.name')}</div>
            <p class="mb-2">${c('site.description')}</p>
            <div class="social-links">
              <a href="#" title="微信公众号">📱</a>
              <a href="#" title="领英">in</a>
            </div>
          </div>
          <div class="col-lg-2 col-6 mb-4 mb-lg-0">
            <div class="footer-title">${getT('footer.quickLinks')}</div>
            <ul class="list-unstyled">
              <li><a href="${basePath}products/index.html">${getNavLabel('products')}</a></li>
              <li><a href="${basePath}about/index.html">${getNavLabel('about')}</a></li>
              <li><a href="${basePath}news/index.html">${getNavLabel('news')}</a></li>
              <li><a href="${basePath}contact/index.html">${getNavLabel('contact')}</a></li>
            </ul>
          </div>
          <div class="col-lg-3 col-6 mb-4 mb-lg-0">
            <div class="footer-title">${getT('footer.contact')}</div>
            <p class="mb-1">${getT('contact.phone')}：${c('contact.phoneDisplay')}</p>
            <p class="mb-1">邮箱：${c('contact.email')}</p>
          </div>
          <div class="col-lg-3">
            <div class="footer-title">${getT('footer.legal')}</div>
            <ul class="list-unstyled">
              <li><a href="${c('footer.privacyUrl')}">${getT('footer.privacy')}</a></li>
              <li><a href="${c('footer.termsUrl')}">${getT('footer.terms')}</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom text-center">
          <div class="small">
            ${c('footer.copyright')}
            &nbsp;&nbsp;
            <a href="${c('footer.icpUrl') || 'https://beian.miit.gov.cn/'}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">${c('footer.icp') || getT('footer.icp')}</a>
            &nbsp;&nbsp;
            <a href="${c('footer.policeUrl') || 'https://beian.mps.gov.cn/'}" target="_blank" rel="noopener noreferrer" class="text-decoration-none">${c('footer.policeBeiAn') || getT('footer.policeBeiAn')}</a>
          </div>
        </div>
      </div>
    `;
  }

  // 初始化组件
  async function initComponents() {
    await initData();

    const header = document.getElementById('hyx-header');
    const footer = document.getElementById('hyx-footer');
    const basePath = getBasePath();

    if (header) {
      renderHeader(header, basePath);
    }

    if (footer) {
      renderFooter(footer, basePath);
    }

    applyDataI18n();

    // 触发自定义事件，通知组件加载完成
    document.dispatchEvent(new CustomEvent('hyx-components-ready', {
      detail: { config: HYXData.config, i18n: HYXData.i18n }
    }));
  }

  // 导出到全局（getT 用于带 fallback 的翻译，避免页面显示 key）
  window.HYXUtils = {
    t,
    getT,
    c,
    localized,
    applyDataI18n,
    getBasePath,
    getCurrentLang,
    loadJSON,
    initData
  };

  // 自动初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initComponents);
  } else {
    initComponents();
  }

})();
