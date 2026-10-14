/* ============================================================
   rsvp.js — RSVP form + Wishes Wall
   Geo & Joicy Wedding

   HOW TO CONNECT:
   1. Open Google Apps Script (script.google.com), paste Code.gs
   2. Deploy → New deployment → Web App
      Execute as: Me | Who has access: Anyone
   3. Copy the Web App URL and paste it below as SCRIPT_URL
   ============================================================ */
(function () {
  'use strict';

  /* ── PASTE YOUR DEPLOYED APPS SCRIPT WEB APP URL HERE ── */
  var SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
  /* ─────────────────────────────────────────────────────── */

  var form = document.getElementById('rsvpForm');
  var submitBtn = document.getElementById('rsvpSubmit');
  var successBox = document.getElementById('rsvpSuccess');
  var wishesWall = document.getElementById('wishesWall');
  var wishesEmpty = document.getElementById('wishesEmpty');

  if (!form) return;

  /* ──────────────────────────────────────────────────────────
     HELPERS
  ────────────────────────────────────────────────────────── */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function markInvalid(input, invalid) {
    if (!input) return;
    input.classList.toggle('is-invalid', invalid);
  }

  function showErr(id, visible) {
    var el = document.getElementById(id);
    if (el) el.hidden = !visible;
  }

  function setLoading(on) {
    submitBtn.disabled = on;
    var lbl = submitBtn.querySelector('.rsvp-submit__label');
    var spin = submitBtn.querySelector('.rsvp-submit__loading');
    if (lbl) lbl.hidden = on;
    if (spin) spin.hidden = !on;
  }

  /* ──────────────────────────────────────────────────────────
     VALIDATION — red border only, no text labels
  ────────────────────────────────────────────────────────── */
  function validate() {
    var ok = true;

    var nameEl = document.getElementById('rsvpName');
    var nameOk = nameEl && nameEl.value.trim().length >= 2;
    markInvalid(nameEl, !nameOk);
    showErr('errName', !nameOk);
    if (!nameOk) ok = false;

    var wishEl = document.getElementById('rsvpWish');
    var wishOk = wishEl && wishEl.value.trim().length >= 2;
    markInvalid(wishEl, !wishOk);
    showErr('errWish', !wishOk);
    if (!wishOk) ok = false;

    return ok;
  }

  /* Clear invalid state on any input change */
  form.addEventListener('input', clearErrors);
  form.addEventListener('change', clearErrors);
  function clearErrors(e) {
    var el = e.target;
    if (el.classList.contains('is-invalid')) {
      el.classList.remove('is-invalid');
    }
  }

  /* ──────────────────────────────────────────────────────────
     SUBMIT — hidden iframe pattern (no CORS issues)
  ────────────────────────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showErr('errSubmit', false);

    if (!validate()) return;

    /* Collect data */
    var data = {
      name: document.getElementById('rsvpName').value.trim(),
      wish: (document.getElementById('rsvpWish').value || '').trim(),
      timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
    };

    setLoading(true);

    /* Not connected yet: skip the network POST so wishes never go to another sheet */
    var connected = SCRIPT_URL && SCRIPT_URL !== 'YOUR_APPS_SCRIPT_URL_HERE';

    /* Create a unique iframe to silently receive the POST response */
    var iframeName = 'rsvpSink_' + Date.now();
    var iframe = document.createElement('iframe');
    iframe.name = iframeName;
    iframe.setAttribute('aria-hidden', 'true');
    iframe.style.cssText = 'display:none;position:absolute;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    /* Build a hidden native form targeting the iframe */
    var hiddenForm = document.createElement('form');
    hiddenForm.method = 'POST';
    hiddenForm.action = SCRIPT_URL;
    hiddenForm.target = iframeName;
    hiddenForm.style.cssText = 'display:none;position:absolute;';

    Object.keys(data).forEach(function (key) {
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = key;
      inp.value = data[key];
      hiddenForm.appendChild(inp);
    });

    document.body.appendChild(hiddenForm);
    if (connected) hiddenForm.submit();

    /* After 2.5s assume success (iframe POST is fire-and-forget) */
    setTimeout(function () {
      setLoading(false);

      /* Hide form, show success */
      form.hidden = true;
      successBox.hidden = false;

      /* Prepend wish card immediately if a wish was written */
      if (data.wish) {
        addWishCard(data.name, data.wish, true);
      }

      /* Clean up DOM */
      try { document.body.removeChild(hiddenForm); } catch (x) { }
      setTimeout(function () {
        try { document.body.removeChild(iframe); } catch (x) { }
      }, 3000);

    }, 2500);
  });

  /* ──────────────────────────────────────────────────────────
     WISH CARD BUILDER
  ────────────────────────────────────────────────────────── */
  function addWishCard(name, wish, prepend) {
    /* Hide "be the first" placeholder */
    if (wishesEmpty) wishesEmpty.hidden = true;

    var article = document.createElement('article');
    article.className = 'wish-card';
    article.innerHTML =
      '<p class="wish-card__quote">' + esc(wish) + '</p>' +
      '<p class="wish-card__meta">' + esc(name) + '</p>';

    if (prepend && wishesWall.firstChild) {
      wishesWall.insertBefore(article, wishesWall.firstChild);
    } else {
      wishesWall.appendChild(article);
    }
  }

  /* ──────────────────────────────────────────────────────────
     LOAD EXISTING WISHES on page load via GET ?action=getWishes
  ────────────────────────────────────────────────────────── */
  function loadWishes() {
    if (!SCRIPT_URL || SCRIPT_URL === 'YOUR_APPS_SCRIPT_URL_HERE') return;

    fetch(SCRIPT_URL + '?action=getWishes', { method: 'GET' })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json || !Array.isArray(json.wishes)) return;
        json.wishes.forEach(function (w) {
          if (w.name && w.wish && w.wish.trim()) {
            addWishCard(w.name, w.wish, false);
          }
        });
      })
      .catch(function () {
        /* Silently ignore — wall stays empty until first submission */
      });
  }

  loadWishes();

})();
