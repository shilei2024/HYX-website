'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const site = path.resolve(__dirname, '../site');

function files(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : [path.join(directory, entry.name)]);
}

test('静态页面引用的本地脚本、样式、图片和页面存在；所有内联 JS 可解析', () => {
  for (const file of files(site).filter(file => file.endsWith('.html'))) {
    const html = fs.readFileSync(file, 'utf8');
    for (const match of html.matchAll(/<(script|link|img|a)\b[^>]*\b(?:src|href)=["']([^"']+)["']/gi)) {
      const url = match[2];
      if (/^(?:https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(url) || url.includes('${')) continue;
      const pathname = url.split(/[?#]/)[0];
      if (!pathname) continue;
      const target = path.resolve(pathname.startsWith('/') ? site : path.dirname(file), '.' + (pathname.startsWith('/') ? pathname : '/' + pathname));
      assert.ok(fs.existsSync(target), path.relative(site, file) + ' → ' + url);
    }
    for (const script of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
      if (/\bsrc\s*=|application\/(?:ld\+)?json/i.test(script[1]) || !script[2].trim()) continue;
      assert.doesNotThrow(() => new vm.Script(script[2], { filename: file }));
    }
  }
});

test('初始 JSON 中引用的本地运营图片存在', () => {
  function inspect(value) {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (['image', 'logo', 'cover'].includes(key) && typeof child === 'string' && child.startsWith('assets/')) {
        assert.ok(fs.existsSync(path.join(site, child)), '图片不存在：' + child);
      }
      inspect(child);
    }
  }
  for (const file of files(path.join(site, 'data')).filter(file => file.endsWith('.json'))) inspect(JSON.parse(fs.readFileSync(file, 'utf8')));
});

function contact(lang, formId, response) {
  let ready;
  let submit;
  const button = { textContent: 'Submit', disabled: false };
  const message = { style: {}, textContent: '' };
  const form = { dataset: {}, querySelector: () => button, appendChild: () => {}, addEventListener: (event, handler) => { if (event === 'submit') submit = handler; } };
  const calls = [];
  const window = { HYXData: { lang, config: { contact: { formspreeFormId: formId } } }, location: { href: '' } };
  const context = {
    window,
    document: { addEventListener: (event, handler) => { ready = handler; }, getElementById: id => id === 'feedback-form' ? form : message },
    FormData: class { set() {} get() { return 'Business'; } },
    fetch: async (url, options) => { calls.push({ url, options }); if (response instanceof Error) throw response; return response; }
  };
  vm.runInNewContext(fs.readFileSync(path.join(site, 'js/contact-form.js'), 'utf8'), context);
  ready();
  return { button, message, window, calls, submit: () => submit({ preventDefault() {} }) };
}

test('三种语言未配置留言服务时不发送数据、不显示假成功，提示电话或邮箱联系', async () => {
  for (const lang of ['zh', 'en', 'ru']) {
    const page = contact(lang, '', { ok: true });
    await page.submit();
    assert.equal(page.calls.length, 0);
    assert.equal(page.window.location.href, '');
    assert.equal(page.button.disabled, true);
    assert.ok(page.message.textContent.length > 10);
    assert.doesNotMatch(page.message.textContent, /config\.json|formspreeFormId/);
  }
});

test('三种语言只在服务返回成功时跳转；发送失败保留表单并允许重试', async () => {
  for (const lang of ['zh', 'en', 'ru']) {
    const success = contact(lang, 'test-form', { ok: true });
    await success.submit();
    assert.equal(success.calls[0].options.method, 'POST');
    assert.equal(success.calls[0].url, 'https://formspree.io/f/test-form');
    assert.equal(success.window.location.href, 'success.html');
    for (const result of [{ ok: false }, new Error('offline')]) {
      const failed = contact(lang, 'test-form', result);
      await failed.submit();
      assert.equal(failed.window.location.href, '');
      assert.equal(failed.button.disabled, false);
      assert.equal(failed.message.style.display, 'block');
    }
  }
});
