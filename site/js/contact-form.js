/* 意见反馈：所有语言使用同一提交逻辑；仅实际发送成功才显示成功。 */
(function () {
  'use strict';
  var labels = {
    zh: { unavailable: '在线留言暂不可用，请通过页面上的电话或邮箱联系我们。', sending: '提交中…', failed: '提交失败，请稍后重试。', network: '网络错误，请稍后重试。', subject: '弘易芯官网' },
    en: { unavailable: 'Online messages are currently unavailable. Please contact us using the phone or email listed on this page.', sending: 'Sending…', failed: 'Submission failed. Please try again later.', network: 'Network error. Please try again later.', subject: 'HYIC website' },
    ru: { unavailable: 'Отправка сообщений временно недоступна. Свяжитесь с нами по телефону или электронной почте, указанным на странице.', sending: 'Отправка…', failed: 'Не удалось отправить сообщение. Повторите попытку позже.', network: 'Ошибка сети. Повторите попытку позже.', subject: 'Сайт HYIC' }
  };
  document.addEventListener('hyx-components-ready', function () {
    var form = document.getElementById('feedback-form');
    if (!form || form.dataset.feedbackBound) return;
    form.dataset.feedbackBound = 'true';
    var lang = window.HYXData && window.HYXData.lang || 'zh';
    var text = labels[lang] || labels.zh;
    var button = form.querySelector('[type="submit"]');
    var message = document.getElementById('feedback-form-msg');
    if (!message) {
      message = document.createElement('div');
      message.id = 'feedback-form-msg';
      message.className = 'small text-danger mb-2';
      form.appendChild(message);
    }
    function show(value) { message.style.display = 'block'; message.textContent = value; }
    var formId = window.HYXData && window.HYXData.config && window.HYXData.config.contact && window.HYXData.config.contact.formspreeFormId;
    if (!formId || !String(formId).trim()) {
      form.addEventListener('submit', function (event) { event.preventDefault(); });
      show(text.unavailable);
      if (button) button.disabled = true;
      return;
    }
    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      var originalLabel = button && button.textContent;
      if (button) { button.disabled = true; button.textContent = text.sending; }
      message.style.display = 'none';
      try {
        var data = new FormData(form);
        data.set('_subject', text.subject + ': ' + (data.get('subject') || ''));
        var response = await fetch('https://formspree.io/f/' + encodeURIComponent(String(formId).trim()), { method: 'POST', body: data, headers: { Accept: 'application/json' } });
        if (!response.ok) throw new Error('submission-failed');
        window.location.href = 'success.html';
      } catch (error) {
        show(error.message === 'submission-failed' ? text.failed : text.network);
        if (button) { button.disabled = false; button.textContent = originalLabel; }
      }
    });
  });
})();
