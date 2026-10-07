/* Global processing indicator for saves, queries, AJAX/fetch and page actions. */
(function () {
  'use strict';

  var activeRequests = 0;
  var showTimer = null;
  var hideTimer = null;
  var minimumVisibleUntil = 0;

  function ensureOverlay() {
    var el = document.getElementById('globalLoadingOverlay');
    if (el) return el;

    el = document.createElement('div');
    el.id = 'globalLoadingOverlay';
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-busy', 'false');
    el.innerHTML =
      '<div class="global-loading-box" role="status" aria-label="Sedang memproses">' +
        '<div class="global-loading-clock" aria-hidden="true"></div>' +
        '<div class="global-loading-text" id="globalLoadingText">Sedang memproses...</div>' +
        '<div class="global-loading-subtext">Mohon tunggu sebentar</div>' +
      '</div>';
    document.body.appendChild(el);
    return el;
  }

  function setText(message) {
    var text = document.getElementById('globalLoadingText');
    if (text && message) text.textContent = message;
  }

  function show(message, immediate) {
    var overlay = ensureOverlay();
    clearTimeout(showTimer);
    clearTimeout(hideTimer);
    setText(message || 'Sedang memproses...');

    var reveal = function () {
      overlay.classList.add('is-visible');
      overlay.setAttribute('aria-busy', 'true');
      minimumVisibleUntil = Date.now() + 280;
    };

    if (immediate) reveal();
    else showTimer = setTimeout(reveal, 120);
  }

  function hide(force) {
    clearTimeout(showTimer);
    var overlay = document.getElementById('globalLoadingOverlay');
    if (!overlay) return;

    var finish = function () {
      overlay.classList.remove('is-visible');
      overlay.setAttribute('aria-busy', 'false');
    };

    if (force || !overlay.classList.contains('is-visible')) finish();
    else {
      var wait = Math.max(0, minimumVisibleUntil - Date.now());
      clearTimeout(hideTimer);
      hideTimer = setTimeout(finish, wait);
    }
  }

  window.StockistLoading = {
    show: function (message) { show(message, true); },
    hide: function () { hide(true); },
    start: function (message) {
      activeRequests++;
      show(message || 'Sedang memproses...', false);
    },
    stop: function () {
      activeRequests = Math.max(0, activeRequests - 1);
      if (activeRequests === 0) hide(false);
    }
  };

  // Intercept fetch so query/save/load operations automatically show the indicator.
  if (window.fetch) {
    var originalFetch = window.fetch;
    window.fetch = function () {
      window.StockistLoading.start();
      return originalFetch.apply(this, arguments).then(function (response) {
        window.StockistLoading.stop();
        return response;
      }).catch(function (error) {
        window.StockistLoading.stop();
        throw error;
      });
    };
  }

  document.addEventListener('submit', function (event) {
    var form = event.target;
    if (!form || form.hasAttribute('data-no-global-loading')) return;
    if (event.defaultPrevented) return;
    window.StockistLoading.show(form.getAttribute('data-loading-text') || 'Sedang menyimpan...');
  }, true);

  // Give normal navigation links a loading indicator as well, except anchors that
  // stay on the same page, downloads, new tabs, javascript links and hash links.
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a');
    if (!link || event.defaultPrevented) return;
    if (link.hasAttribute('data-no-global-loading')) return;
    if (link.target === '_blank' || link.hasAttribute('download')) return;
    if (link.getAttribute('href') === '#') return;
    var href = link.getAttribute('href') || '';
    if (!href || href.indexOf('javascript:') === 0 || href.charAt(0) === '#') return;
    if (link.origin && link.origin !== window.location.origin) return;
    window.StockistLoading.show(link.getAttribute('data-loading-text') || 'Memuat halaman...');
  }, true);

  // Public helper for custom operations that are not fetch/form based.
  window.showLoading = function (message) { window.StockistLoading.show(message); };
  window.hideLoading = function () { window.StockistLoading.hide(); };
})();
