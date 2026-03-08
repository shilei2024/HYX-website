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

  // 获取相对路径前缀（指向站点根目录，用于 data/、assets/、导航与语言切换）
  // 规则：从当前文档 URL 到站点根需要若干层 ../；en/ru 下至少 1 层（否则 /en/ 会请求到 /en/assets）
  function getBasePath() {
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(Boolean);
    let depth = pathParts.length > 0 ? pathParts.length - 1 : 0;
    if ((pathParts[0] === 'en' || pathParts[0] === 'ru') && depth < 1) depth = 1;
    return depth === 0 ? './' : '../'.repeat(depth);
  }

  // 获取当前语言“根”路径（用于导航、搜索跳转等，使链接保持在同语言下）
  function getNavBasePath() {
    const path = window.location.pathname;
    const pathParts = path.split('/').filter(Boolean);
    if (pathParts[0] === 'en' || pathParts[0] === 'ru') {
      const depth = Math.max(0, pathParts.length - 2);
      return depth === 0 ? './' : '../'.repeat(depth);
    }
    return getBasePath();
  }

  // 获取语言切换链接（基于“从站根起的相对路径”pathFromRoot，保证子目录正确）
  function getLangLinks(basePath) {
    const path = window.location.pathname;
    const currentLang = getCurrentLang();
    const pathParts = path.split('/').filter(Boolean);

    // pathFromRoot: 从站根到当前页面的路径，如 "about/history.html" 或 "index.html"
    let pathFromRoot;
    if (pathParts.length === 0) {
      pathFromRoot = 'index.html';
    } else if (pathParts[0] === 'en' || pathParts[0] === 'ru') {
      pathFromRoot = pathParts.slice(1).join('/') || 'index.html';
      if (!pathFromRoot.endsWith('.html')) pathFromRoot = pathFromRoot + '/index.html';
    } else {
      pathFromRoot = pathParts.join('/');
      if (!pathFromRoot.endsWith('.html')) pathFromRoot = pathFromRoot + '/index.html';
    }

    let zhPath, enPath, ruPath;
    if (currentLang === 'zh') {
      zhPath = pathFromRoot;
      enPath = 'en/' + pathFromRoot;
      ruPath = 'ru/' + pathFromRoot;
    } else if (currentLang === 'en') {
      zhPath = pathFromRoot;
      enPath = 'en/' + pathFromRoot;
      ruPath = 'ru/' + pathFromRoot;
    } else {
      zhPath = pathFromRoot;
      enPath = 'en/' + pathFromRoot;
      ruPath = 'ru/' + pathFromRoot;
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
        dropdown: { authorized: '代理品牌', distribution: '分销品牌', diagrams: '应用框图', passive: '被动元器件', capacitor: '电容', resistor: '电阻', inductor: '电感', active: '主动元器件', ic: 'IC 芯片', intro: '公司介绍', history: '发展历程', team: '技术团队', supply: '供应链优势', qual: '资质荣誉', company: '公司动态', industry: '行业新闻', servingCustomers: '服务客户', tech: '技术文章' } },
      products: { title: '产品中心', subtitle: '代理品牌与分销品牌', brandsSubtitle: '合作授权品牌一览，正品保障，链接官网与产品说明', distributionSubtitle: '分销产品分类，正规渠道，原厂正品', viewProducts: '查看产品', categories: '产品分类', inquiry: '询价', download: '数据手册下载' },
      diagrams: { subtitle: '智能穿戴、电源转接、电机驱动等方案参考' },
      news: { title: '新闻中心', subtitle: '公司动态、行业新闻', all: '全部', company: '公司动态', industry: '行业新闻', tech: '技术文章', readMore: '更多新闻', backToList: '返回列表', placeholder: '内容筹备中，敬请期待。' },
      contact: { title: '联系我们', subtitle: '业务咨询、全球据点、意见反馈', phone: '联系电话', email: '业务咨询', irEmail: '投资者咨询', address: '公司地址', locations: '全球据点', feedback: '意见反馈', name: '姓名', namePlaceholder: '您的姓名', emailLabel: '邮箱', emailPlaceholder: 'your@email.com', subject: '主题', subjectBusiness: '业务咨询', subjectProduct: '产品询价', subjectFeedback: '意见反馈', subjectOther: '其他', message: '留言', messagePlaceholder: '请填写您的留言内容', submit: '提交', submitSuccess: '感谢您的留言，我们会尽快与您联系。' },
      footer: { quickLinks: '快速链接', contact: '联系方式', legal: '法律条款', privacy: '隐私政策', terms: '使用条款', icp: '粤ICP备*********号', policeBeiAn: '粤公安备**********号', wechatTitle: '微信公众号', linkedinTitle: '领英' },
      legal: { termsIntro: '请在使用本网站及我们提供的服务前阅读并同意以下条款。', privacyIntro: '我们重视并保护您的个人信息，请阅读以下政策说明。', lastUpdated: '最后更新：2026年' },
      home: { banner1Title: '授权代理 · 品质保障', banner1Desc: '弘易芯科技专注电子元器件分销与方案支持，携手多家知名品牌，为制造企业提供稳定可靠的供应链服务。', banner2Title: '代理品牌 / 分销品牌', banner2Desc: '二、三极管，MOSFET、ESD、TVS、LDO、DCDC、电源驱动、MCU、FLASH等全品类半导体产品，满足研发与量产需求，助力客户产品快速上市。', banner3Title: '技术赋能 · 方案中心', banner3Desc: '专业FAE团队提供选型、调试与量产支持，从概念到量产全程护航。', authorizedAgent: '授权代理', authorizedAgentDesc: '品牌授权与正品保障，合作厂商与资质一览', productCenter: '产品中心', productCenterDesc: '代理品牌与分销品牌分类浏览与询价', solutionCenter: '方案中心', solutionCenterDesc: '技术方案与FAE支持，助力产品落地', contactUs: '联系我们', contactUsDesc: '业务咨询、全球据点与意见反馈', aboutTitle: '关于弘易芯科技', aboutSubtitle: '专业、可信赖的电子元器件授权代理商', aboutText: '深圳市弘易芯科技有限公司致力于为电子制造企业提供优质的元器件供应与技术支持。我们拥有完善的授权体系与供应链能力，半导体分离及主动元器件全品类，携手多家知名品牌，为客户提供从选型、小批量试产到大批量供货的一站式服务。公司注重技术投入与客户体验，以"专业、高效、可信赖"为理念，助力客户产品创新与市场竞争力提升。', learnMore: '了解更多', newsTitle: '新闻动态', newsSubtitle: '了解公司最新动态与行业资讯' },
      common: { search: '搜索产品/新闻', required: '必填', prevPage: '上一页', nextPage: '下一页', langZh: '中文' },
      success: { pageTitle: '提交成功 - 弘易芯科技', title: '提交成功', subtitle: '感谢您的留言', thankYou: '感谢您的留言', message: '我们已收到您的反馈，会尽快与您联系，请留意您的邮箱。', backContact: '返回联系我们', backHome: '返回首页' },
      search: { pageTitle: '站内搜索 - 弘易芯科技', title: '站内搜索', subtitle: '搜索产品、品牌与新闻', placeholder: '输入关键词搜索', empty: '未找到与「{q}」相关的内容，请换一个关键词试试。', prompt: '请输入关键词后搜索。', sectionProducts: '产品', sectionBrands: '代理品牌', sectionDistribution: '分销品牌', sectionNews: '新闻' },
      about: { pageTitle: '关于我们 - 弘易芯科技', metaDesc: '弘易芯科技 - 公司介绍、发展历程、技术团队与供应链优势', heading: '公司介绍', intro1: '深圳市弘易芯科技有限公司致力于为电子制造企业提供优质的元器件供应与技术支持。我们拥有完善的授权体系与供应链能力，半导体分离及主动元器件全品类，携手多家知名品牌，为客户提供从选型、小批量试产到大批量供货的一站式服务。', intro2: '公司注重技术投入与客户体验，以"专业、高效、可信赖"为理念，助力客户产品创新与市场竞争力提升。', card1Title: '授权代理', card1Text: '与多家知名品牌建立授权合作，正品保障。', card2Title: '方案支持', card2Text: '从选型到量产，FAE 团队全程技术支持。', imgAlt: '关于弘易芯' }
    },
    en: {
      nav: { home: 'Home', products: 'Products', about: 'About Us', news: 'News', contact: 'Contact',
        dropdown: { authorized: 'Authorized Brands', distribution: 'Distribution Brands', diagrams: 'Application Block Diagrams', passive: 'Passive Components', capacitor: 'Capacitors', resistor: 'Resistors', inductor: 'Inductors', active: 'Active Components', ic: 'IC Chips', intro: 'Company Overview', history: 'History', team: 'Team', supply: 'Supply Chain', qual: 'Qualifications', company: 'Company News', industry: 'Industry News', servingCustomers: 'Serving Customers', tech: 'Tech Articles' } },
      products: { title: 'Products', subtitle: 'Authorized and distribution brands', brandsSubtitle: 'Authorized brands with official links and product descriptions', distributionSubtitle: 'Distribution product categories, click to view product list', viewProducts: 'View Products', categories: 'Categories', inquiry: 'Inquiry', download: 'Download Datasheet' },
      diagrams: { subtitle: 'Wearables, power adapter, motor drive and more solution references' },
      news: { title: 'News', subtitle: 'Company News, Industry Updates', all: 'All', company: 'Company News', industry: 'Industry News', tech: 'Technical Articles', readMore: 'More News', backToList: 'Back to List', placeholder: 'Content coming soon.' },
      contact: { title: 'Contact Us', subtitle: 'Business Inquiries, Global Locations, Feedback', phone: 'Phone', email: 'Sales Inquiry', irEmail: 'Investor Relations', address: 'Address', locations: 'Global Locations', feedback: 'Feedback', name: 'Name', namePlaceholder: 'Your Name', emailLabel: 'Email', emailPlaceholder: 'your@email.com', subject: 'Subject', subjectBusiness: 'Business Inquiry', subjectProduct: 'Product Inquiry', subjectFeedback: 'Feedback', subjectOther: 'Other', message: 'Message', messagePlaceholder: 'Please enter your message', submit: 'Submit', submitSuccess: 'Thank you for your message. We will get back to you soon.' },
      footer: { quickLinks: 'Quick Links', contact: 'Contact', legal: 'Legal', privacy: 'Privacy Policy', terms: 'Terms of Use', icp: 'ICP: ********', policeBeiAn: 'Police filing: ********', wechatTitle: 'WeChat', linkedinTitle: 'LinkedIn' },
      legal: { termsIntro: 'Please read and agree to the following terms before using this website and our services.', privacyIntro: 'We value and protect your personal information. Please read the following policy.', lastUpdated: 'Last updated: 2026' },
      home: { banner1Title: 'Authorized Distribution · Quality Assurance', banner1Desc: 'HYIC specializes in electronic component distribution and solution support, partnering with top international brands to provide stable and reliable supply chain services for manufacturers.', banner2Title: 'Complete Coverage of Passive & Active Components', banner2Desc: 'Full range of capacitors, resistors, inductors, ICs and more, meeting R&D and mass production needs, helping customers bring products to market quickly.', banner3Title: 'Technical Empowerment · Solution Center', banner3Desc: 'Professional FAE team provides selection, debugging, and mass production support, escorting from concept to mass production.', authorizedAgent: 'Authorized Agent', authorizedAgentDesc: 'Brand authorization and genuine product guarantee', productCenter: 'Products', productCenterDesc: 'Browse and inquire about passive/active components', solutionCenter: 'Solutions', solutionCenterDesc: 'Technical solutions and FAE support', contactUs: 'Contact Us', contactUsDesc: 'Business inquiries, global locations and feedback', aboutTitle: 'About HYIC', aboutSubtitle: 'Professional and Trusted Electronic Component Authorized Distributor', aboutText: 'Shenzhen HYIC Technology Co., Ltd. is dedicated to providing quality component supply and technical support for electronics manufacturers. We have a comprehensive authorization system and supply chain capability, covering passive and active components across all categories, partnering with internationally renowned brands to provide one-stop services from selection, small batch trial production to large volume supply. The company focuses on technology investment and customer experience, with the philosophy of \'Professional, Efficient, Trusted\', helping customers innovate products and enhance market competitiveness.', learnMore: 'Learn More', newsTitle: 'Latest News', newsSubtitle: 'Stay updated with company news and industry insights' },
      common: { search: 'Search products/news', required: 'Required', prevPage: 'Previous', nextPage: 'Next', langZh: 'Chinese' },
      success: { pageTitle: 'Submitted - HYIC', title: 'Submitted', subtitle: 'Thank you for your message', thankYou: 'Thank you for your message', message: 'We have received your feedback and will contact you as soon as possible. Please check your email.', backContact: 'Back to Contact', backHome: 'Back to Home' },
      search: { pageTitle: 'Search - HYIC', title: 'Search', subtitle: 'Search products, brands and news', placeholder: 'Enter keywords to search', empty: 'No results found for "{q}". Try different keywords.', prompt: 'Please enter keywords to search.', sectionProducts: 'Products', sectionBrands: 'Authorized Brands', sectionDistribution: 'Distribution Brands', sectionNews: 'News' },
      about: { pageTitle: 'About Us - HYIC', metaDesc: 'HYIC - Company Overview, History, Team and Supply Chain', heading: 'Company Overview', intro1: 'Shenzhen HYIC Technology Co., Ltd. is dedicated to providing quality component supply and technical support for electronics manufacturers.', intro2: 'We focus on technology investment and customer experience, with a professional FAE team for selection, debugging and mass production support.', card1Title: 'Authorized Distribution', card1Text: 'Authorized partnership with international brands, genuine product guarantee.', card2Title: 'Solution Support', card2Text: 'FAE team provides full technical support from selection to mass production.', imgAlt: 'About HYIC' }
    },
    ru: {
      nav: { home: 'Главная', products: 'Продукция', about: 'О нас', news: 'Новости', contact: 'Контакты',
        dropdown: { authorized: 'Авторизованные бренды', distribution: 'Дистрибуция', diagrams: 'Блок-схемы применений', passive: 'Пассивные компоненты', capacitor: 'Конденсаторы', resistor: 'Резисторы', inductor: 'Индукторы', active: 'Активные компоненты', ic: 'Микросхемы', intro: 'О компании', history: 'История', team: 'Команда', supply: 'Цепочка поставок', qual: 'Сертификаты', company: 'Новости компании', industry: 'Отраслевые новости', servingCustomers: 'Обслуживание клиентов', tech: 'Технические статьи' } },
      products: { title: 'Продукция', subtitle: 'Авторизованные и дистрибуционные бренды', brandsSubtitle: 'Авторизованные бренды с ссылками на сайты и описаниями', distributionSubtitle: 'Категории продукции, нажмите для просмотра', viewProducts: 'Смотреть продукцию', categories: 'Категории', inquiry: 'Запрос', download: 'Скачать datasheet' },
      diagrams: { subtitle: 'Носимые устройства, питание, приводы и другие решения' },
      news: { title: 'Новости', subtitle: 'Новости компании, отраслевые новости, технические статьи', all: 'Все', company: 'Новости компании', industry: 'Отраслевые новости', tech: 'Технические статьи', readMore: 'Больше новостей', backToList: 'Назад к списку', placeholder: 'Контент в разработке.' },
      contact: { title: 'Связаться с нами', subtitle: 'Бизнес-запросы, глобальные офисы, обратная связь', phone: 'Телефон', email: 'Запрос продаж', irEmail: 'Для инвесторов', address: 'Адрес', locations: 'Наши офисы', feedback: 'Обратная связь', name: 'Имя', namePlaceholder: 'Ваше имя', emailLabel: 'Email', emailPlaceholder: 'your@email.com', subject: 'Тема', subjectBusiness: 'Бизнес-запрос', subjectProduct: 'Запрос продукта', subjectFeedback: 'Обратная связь', subjectOther: 'Другое', message: 'Сообщение', messagePlaceholder: 'Пожалуйста, введите ваше сообщение', submit: 'Отправить', submitSuccess: 'Спасибо за ваше сообщение. Мы свяжемся с вами в ближайшее время.' },
      footer: { quickLinks: 'Быстрые ссылки', contact: 'Контакты', legal: 'Правовая информация', privacy: 'Политика конфиденциальности', terms: 'Условия использования', icp: 'ICP: ********', policeBeiAn: 'Полиция: ********', wechatTitle: 'WeChat', linkedinTitle: 'LinkedIn' },
      legal: { termsIntro: 'Пожалуйста, ознакомьтесь с условиями перед использованием сайта и наших услуг.', privacyIntro: 'Мы защищаем вашу персональную информацию. Ознакомьтесь с политикой.', lastUpdated: 'Обновлено: 2026' },
      home: { banner1Title: 'Авторизованная дистрибуция · Гарантия качества', banner1Desc: 'HYIC специализируется на дистрибуции электронных компонентов и технической поддержке, сотрудничая с ведущими международными брендами.', banner2Title: 'Полный ассортимент пассивных и активных компонентов', banner2Desc: 'Полный спектр конденсаторов, резисторов, индукторов, микросхем и других компонентов для НИОКР и серийного производства.', banner3Title: 'Техническая поддержка · Центр решений', banner3Desc: 'Профессиональная команда FAE обеспечивает поддержку от концепции до серийного производства.', authorizedAgent: 'Авторизованный агент', authorizedAgentDesc: 'Авторизация брендов и гарантия подлинности', productCenter: 'Продукция', productCenterDesc: 'Просмотр и запрос пассивных/активных компонентов', solutionCenter: 'Решения', solutionCenterDesc: 'Технические решения и поддержка FAE', contactUs: 'Связаться', contactUsDesc: 'Бизнес-запросы, глобальные офисы и обратная связь', aboutTitle: 'О компании HYIC', aboutSubtitle: 'Профессиональный и надежный авторизованный дистрибьютор электронных компонентов', aboutText: 'Shenzhen HYIC Technology Co., Ltd. стремится предоставлять качественные электронные компоненты и техническую поддержку производителям электроники. Мы имеем комплексную систему авторизации и возможности цепочки поставок, охватывающие все категории пассивных и активных компонентов.', learnMore: 'Подробнее', newsTitle: 'Последние новости', newsSubtitle: 'Будьте в курсе новостей компании и отраслевых событий' },
      common: { search: 'Поиск продуктов/новостей', required: 'Обязательно', prevPage: 'Назад', nextPage: 'Вперед', langZh: 'Китайский' },
      success: { pageTitle: 'Отправлено - HYIC', title: 'Отправлено', subtitle: 'Спасибо за ваше сообщение', thankYou: 'Спасибо за ваше сообщение', message: 'Мы получили ваше сообщение и свяжемся с вами в ближайшее время. Проверьте почту.', backContact: 'Вернуться в контакты', backHome: 'На главную' },
      search: { pageTitle: 'Поиск - HYIC', title: 'Поиск', subtitle: 'Поиск продуктов, брендов и новостей', placeholder: 'Введите ключевые слова', empty: 'По запросу «{q}» ничего не найдено. Попробуйте другие слова.', prompt: 'Введите ключевые слова для поиска.', sectionProducts: 'Продукция', sectionBrands: 'Авторизованные бренды', sectionDistribution: 'Дистрибуция', sectionNews: 'Новости' },
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

  // 渲染导航栏（basePath = navBase 用于导航链接；logo/assets 用站点根路径以保证资源加载）
  function renderHeader(container, basePath) {
    const langLinks = getLangLinks(basePath);
    const currentLang = getCurrentLang();
    const basePathForLang = getBasePath();
    const basePathForAssets = getBasePath();

    const navItems = [
      { key: 'home', href: basePath + 'index.html', active: false },
      {
        key: 'products', href: basePath + 'products/distribution.html', active: false,
        dropdown: [
          { key: 'authorized', href: basePath + 'products/brands.html' },
          { key: 'distribution', href: basePath + 'products/distribution.html' },
          { key: 'diagrams', href: basePath + 'products/diagrams.html' }
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
          { key: 'company', href: basePath + 'news/company.html' },
          { key: 'industry', href: basePath + 'news/industry.html' },
          { key: 'servingCustomers', href: basePath + 'news/serving-customers.html' }
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
            <img src="${basePathForAssets}${logoSrc}" alt="${siteName}" onerror="this.style.display='none'">
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
                  ${currentLang === 'zh' ? getT('common.langZh') : currentLang === 'en' ? 'EN' : 'RU'}
                </button>
                <ul class="dropdown-menu">
                  <li><a class="dropdown-item ${currentLang === 'zh' ? 'active' : ''}" href="${basePathForLang}${langLinks.zhPath}">${getT('common.langZh')}</a></li>
                  <li><a class="dropdown-item ${currentLang === 'en' ? 'active' : ''}" href="${basePathForLang}${langLinks.enPath}">EN</a></li>
                  <li><a class="dropdown-item ${currentLang === 'ru' ? 'active' : ''}" href="${basePathForLang}${langLinks.ruPath}">RU</a></li>
                </ul>
              </div>
              <form class="d-flex search-box-header" id="header-search-form" role="search">
                <input class="form-control" type="search" placeholder="${getT('common.search')}" aria-label="${getT('common.search')}">
                <button class="btn btn-primary ms-2 btn-search-icon" type="submit" aria-label="${getT('common.search')}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  // 获取当前年份
  function getCurrentYear() {
    return new Date().getFullYear();
  }

  // 渲染页脚
  function renderFooter(container, basePath) {
    var copyrightText = c('footer.copyright') || '';
    copyrightText = copyrightText.replace(/\d{4}/, getCurrentYear());

    container.innerHTML = `
      <div class="container">
        <div class="row">
          <div class="col-lg-4 mb-4 mb-lg-0">
            <div class="footer-title">${c('site.name')}</div>
            <p class="mb-2">${c('site.description')}</p>
            <div class="social-links">
              <a href="#" title="${getT('footer.wechatTitle')}">📱</a>
              <a href="#" title="${getT('footer.linkedinTitle')}">in</a>
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
            <p class="mb-1">${getT('contact.phone')}: ${c('contact.phoneDisplay')}</p>
            <p class="mb-1">${getT('contact.emailLabel')}: ${c('contact.email')}</p>
          </div>
          <div class="col-lg-3">
            <div class="footer-title">${getT('footer.legal')}</div>
            <ul class="list-unstyled">
              <li><a href="${basePath}${c('footer.privacyUrl') || 'privacy.html'}">${getT('footer.privacy')}</a></li>
              <li><a href="${basePath}${c('footer.termsUrl') || 'terms.html'}">${getT('footer.terms')}</a></li>
            </ul>
          </div>
        </div>
        <div class="footer-bottom text-center">
          <div class="small d-flex flex-wrap justify-content-center align-items-center">
            <span class="me-3">${copyrightText}</span>
            <a href="${c('footer.icpUrl') || 'https://beian.miit.gov.cn/'}" target="_blank" rel="noopener noreferrer" class="text-decoration-none me-3">${c('footer.icp') || getT('footer.icp')}</a>
            <a href="${c('footer.policeUrl') || 'https://beian.mps.gov.cn/'}" target="_blank" rel="noopener noreferrer" class="text-decoration-none d-inline-flex align-items-center">
              <img src="${basePath}assets/police-badge.png" alt="公安备案图标" style="height:16px;width:16px;margin-right:4px;vertical-align:middle;">
              <span>${c('footer.policeBeiAn') || getT('footer.policeBeiAn')}</span>
            </a>
          </div>
        </div>
      </div>
    `;
  }

  // 站内搜索：提交时跳转至搜索页
  function bindHeaderSearch(basePath) {
    var form = document.getElementById('header-search-form');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = form.querySelector('input[type="search"]');
      var q = input && input.value.trim();
      if (q) {
        var url = (basePath || './') + 'search.html?q=' + encodeURIComponent(q);
        window.location.href = url;
      }
    });
  }

  // 初始化组件
  async function initComponents() {
    await initData();

    const header = document.getElementById('hyx-header');
    const footer = document.getElementById('hyx-footer');
    const basePath = getBasePath();
    const navBase = getNavBasePath();

    if (header) {
      renderHeader(header, navBase);
      bindHeaderSearch(navBase);
    }

    if (footer) {
      renderFooter(footer, navBase);
    }

    applyDataI18n();

    // 中文首页：若为根路径且标题仍为乱码占位，则设置为正确中文（避免 HTML 编码问题）
    if (getCurrentLang() === 'zh') {
      var path = window.location.pathname.replace(/\/$/, '') || '/';
      if (path === '' || path === '/' || path === '/index.html') {
        var t = document.title;
        if (!t || /^[\s?]+$/.test(t) || t.indexOf('?') >= 0 && t.length < 30) {
          document.title = '弘易芯科技 - 电子元器件授权代理商';
          var metaDesc = document.querySelector('meta[name="description"]');
          if (metaDesc) metaDesc.setAttribute('content', '弘易芯科技 - 专业电子元器件授权代理商/分销商');
        }
      }
    }

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
    getNavBasePath,
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
