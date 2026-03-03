/**
 * 深圳市弘易芯科技有限公司 - 官网全局脚本
 * 导航下拉、搜索、轮播等交互
 */

(function () {
  'use strict';

  // 导航栏下拉悬停（桌面端）
  function initNavbarHover() {
    const dropdowns = document.querySelectorAll('.navbar .dropdown');
    if (window.innerWidth < 992) return;

    dropdowns.forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        this.querySelector('.dropdown-menu')?.classList.add('show');
      });
      el.addEventListener('mouseleave', function () {
        this.querySelector('.dropdown-menu')?.classList.remove('show');
      });
    });
  }

  // 搜索框（可扩展为真实搜索）
  function initSearch() {
    const form = document.getElementById('header-search-form');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const input = this.querySelector('input[type="search"]');
      const q = input && input.value.trim();
      if (q) {
        // 可改为跳转搜索页: window.location.href = '/search?q=' + encodeURIComponent(q);
        console.log('Search:', q);
        alert('搜索功能可对接后台，当前关键词：' + q);
      }
    });
  }

  // 语言切换高亮
  function initLangSwitch() {
    const lang = (document.documentElement.lang || 'zh').toLowerCase();
    document.querySelectorAll('.lang-switcher a').forEach(function (a) {
      const l = (a.getAttribute('data-lang') || '').toLowerCase();
      if (l === lang || (l === 'zh' && lang.startsWith('zh'))) {
        a.classList.add('active');
      } else {
        a.classList.remove('active');
      }
    });
  }

  // 当前页面导航高亮
  function initActiveNav() {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    document.querySelectorAll('.navbar-hyx .nav-link').forEach(function (link) {
      const href = link.getAttribute('href') || '';
      const linkPath = href.replace(/^\//, '').replace(/\/$/, '') || '';
      if (path === linkPath || (linkPath && path.indexOf(linkPath) === 0)) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // 初始化
  function init() {
    initNavbarHover();
    initSearch();
    initLangSwitch();
    initActiveNav();

    window.addEventListener('resize', function () {
      initNavbarHover();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
