/* ============================================================
   Geo & Joicy — Wedding Invitation
   Cinematic flow controller
   Landing cover → invitation video → hero → scroll journey
   ============================================================ */
(function () {
  'use strict';

  var body = document.body;
  var landing = document.getElementById('landing');
  var openBtn = document.getElementById('openBtn');
  var revealBox = document.getElementById('reveal');
  var video = document.getElementById('revealVideo');
  var skipBtn = document.getElementById('skipBtn');
  var heroImg = document.getElementById('heroImg');

  var COVER_FADE_MS = 420;
  var READY_TIMEOUT_MS = 10000;
  var PLAY_SAFETY_MS = 14000;

  /* ---------------------------------------------------------
     0 · Ambient audio
     Plays music.mp3 when the user taps "Open Invitation".
     The disc button toggles mute/unmute (track keeps playing).
     Falls back to pause/resume if mute is not available.
     --------------------------------------------------------- */
  var bgAudio = document.getElementById('bgAudio');
  var audioBtn = document.getElementById('audioBtn');

  /* true once the user gesture has triggered play() */
  var audioUnlocked = false;
  /* tracks whether the user wants silence */
  var userMuted = false;

  /* ---- UI sync ---- */
  function syncAudioBtn() {
    if (!audioBtn) return;
    var playing = !!(bgAudio && !bgAudio.paused && !bgAudio.muted);
    audioBtn.classList.toggle('is-playing', playing);
    audioBtn.setAttribute('aria-pressed', playing ? 'true' : 'false');
    audioBtn.setAttribute('aria-label', playing ? 'Mute music' : 'Unmute music');
  }

  function showAudioBtn() {
    if (!audioBtn) return;
    audioBtn.hidden = false;
    /* small delay so the button animates in after the hero reveals */
    setTimeout(function () {
      audioBtn.classList.add('is-visible');
    }, 80);
  }

  /* ---- Start (called inside the user-gesture of openBtn click) ---- */
  function startAudio() {
    if (!bgAudio) return;
    if (audioUnlocked) {
      /* already unlocked — just unmute if user hadn't silenced it */
      if (!userMuted) {
        bgAudio.muted = false;
        if (bgAudio.paused) bgAudio.play().catch(function () {});
      }
      syncAudioBtn();
      return;
    }

    audioUnlocked = true;
    bgAudio.muted = false;
    bgAudio.volume = 0.72;
    bgAudio.currentTime = 0;

    var p = bgAudio.play();
    if (p && p.then) {
      p.then(function () {
        syncAudioBtn();
        showAudioBtn();
      }).catch(function () {
        /* Autoplay blocked — show button in muted state so user can tap */
        bgAudio.muted = true;
        userMuted = true;
        syncAudioBtn();
        showAudioBtn();
      });
    } else {
      syncAudioBtn();
      showAudioBtn();
    }
  }

  /* ---- Toggle (disc button click) ---- */
  function toggleAudio() {
    if (!bgAudio) return;

    if (!audioUnlocked) {
      /* First tap on disc before openBtn — unlock + play */
      startAudio();
      return;
    }

    if (bgAudio.paused) {
      /* Paused — resume */
      userMuted = false;
      bgAudio.muted = false;
      bgAudio.play().catch(function () { syncAudioBtn(); });
    } else if (!bgAudio.muted) {
      /* Playing with sound — mute */
      userMuted = true;
      bgAudio.muted = true;
      syncAudioBtn();
    } else {
      /* Playing but muted — unmute */
      userMuted = false;
      bgAudio.muted = false;
      syncAudioBtn();
    }
  }

  if (audioBtn) {
    audioBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleAudio();
    });
  }

  /* Keep disc icon in sync with any external state change */
  if (bgAudio) {
    bgAudio.addEventListener('play',        syncAudioBtn);
    bgAudio.addEventListener('pause',       syncAudioBtn);
    bgAudio.addEventListener('volumechange', syncAudioBtn);
    bgAudio.addEventListener('ended',       syncAudioBtn);
  }

  /* ---------------------------------------------------------
     1 · Image fallback chain + graceful placeholders
     --------------------------------------------------------- */
  function markMissing(img) {
    img.classList.add('failed');
    var host = img.parentElement;
    if (!host) return;

    if (img.classList.contains('cover-img') || img.classList.contains('section-bg') ||
        img.classList.contains('bleed') || img.id === 'heroImg') {
      if (host.classList.contains('landing-media') || host.classList.contains('scene-frame') ||
          host.classList.contains('scene') || host.id === 'reveal') {
        host.classList.add('fallback-on');
      }
    } else if (img.classList.contains('couple-photo-img')) {
      var frame = host.classList.contains('couple-photo-frame') ? host : host.closest('.couple-photo-frame');
      if (frame) frame.classList.add('is-empty');
    } else if (host.classList.contains('portrait') || host.classList.contains('tile') ||
               host.classList.contains('photo-card__paper')) {
      var emptyHost = host.classList.contains('photo-card__paper')
        ? host.closest('.photo-card') || host : host;
      emptyHost.classList.add('is-empty');
      emptyHost.setAttribute('data-label', img.getAttribute('data-placeholder') || 'Photo');
      if (host.classList.contains('photo-card__paper')) {
        host.setAttribute('data-label', img.getAttribute('data-placeholder') || 'Photo');
      }
    }
  }

  function wireImage(img) {
    var queue = (img.getAttribute('data-fallbacks') || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    img.addEventListener('error', function () {
      if (queue.length) { img.src = queue.shift(); return; }
      markMissing(img);
    });

    if (img.complete && img.naturalWidth === 0) {
      if (queue.length) img.src = queue.shift();
      else markMissing(img);
    }
  }

  Array.prototype.forEach.call(
    document.querySelectorAll('img[data-fallbacks], img[data-placeholder]'),
    wireImage
  );

  /* ---------------------------------------------------------
     2 · Scroll lock
     --------------------------------------------------------- */
  function blockTouch(e) { if (body.classList.contains('is-locked')) e.preventDefault(); }
  document.addEventListener('touchmove', blockTouch, { passive: false });

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function jumpToTop() {
    var root = document.documentElement;
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
    root.style.scrollBehavior = prev;
  }

  function unlockScroll() {
    body.classList.remove('is-locked');
    jumpToTop();
  }

  /* ---------------------------------------------------------
     3 · Video preload
     --------------------------------------------------------- */
  var videoReady = false;
  var opening = false;
  var finished = false;
  var safety = 0;
  var readyWait = 0;

  function markVideoReady() { videoReady = true; }

  function isVideoReady() {
    return video && !video.error && video.readyState >= 3;
  }

  function beginVideoPreload() {
    if (!video) return;
    video.muted = true;
    video.setAttribute('muted', '');
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.preload = 'auto';
    try { video.load(); } catch (e) {}

    var onReady = function () {
      markVideoReady();
      video.removeEventListener('canplay', onReady);
      video.removeEventListener('canplaythrough', onReady);
      video.removeEventListener('loadeddata', onReady);
    };
    video.addEventListener('canplay', onReady);
    video.addEventListener('canplaythrough', onReady);
    video.addEventListener('loadeddata', onReady);
    if (isVideoReady()) markVideoReady();
  }

  beginVideoPreload();

  /* ---------------------------------------------------------
     4 · Hero gate — never show until bg is loaded + decoded
     --------------------------------------------------------- */
  var heroEl = document.getElementById('hero');
  var heroReadyPromise = null;
  var heroIsReady = false;
  var TEXT_REVEAL_MS = 520;

  var HERO_CANDIDATES = (
    (heroImg && heroImg.getAttribute('data-candidates')) ||
    'assets/images/hero/hero-alt.png,assets/images/hero/hero.png,assets/images/hero/hero.webp,assets/images/hero/hero.avif'
  ).split(',').map(function (s) { return s.trim(); }).filter(Boolean);

  function loadAndDecodeUrl(url) {
    return new Promise(function (resolve, reject) {
      var probe = new Image();
      probe.decoding = 'async';
      function succeed() {
        if (probe.decode) {
          probe.decode().then(function () { resolve(url); }).catch(function () { resolve(url); });
        } else { resolve(url); }
      }
      probe.onload = succeed;
      probe.onerror = function () { reject(new Error('fail ' + url)); };
      probe.src = url;
      if (probe.complete && probe.naturalWidth > 0) succeed();
    });
  }

  function firstAvailable(urls, index) {
    index = index || 0;
    if (index >= urls.length) return Promise.reject(new Error('no hero asset'));
    return loadAndDecodeUrl(urls[index]).catch(function () {
      return firstAvailable(urls, index + 1);
    });
  }

  function warmFonts() {
    if (!(document.fonts && document.fonts.load)) return Promise.resolve();
    return Promise.all([
      document.fonts.load('300 48px "Cormorant Garamond"'),
      document.fonts.load('400 18px Marcellus'),
      document.fonts.load('400 36px "Pinyon Script"')
    ]).catch(function () {});
  }

  function applyHeroUrl(url) {
    if (!heroImg || !url) return Promise.resolve();
    var isAvif = /\.avif($|\?)/i.test(url);
    var isWebp = /\.webp($|\?)/i.test(url);
    var avifSource = document.getElementById('heroSourceAvif');
    var webpSource = document.getElementById('heroSourceWebp');

    if (avifSource) {
      if (isAvif) avifSource.srcset = url;
      else avifSource.removeAttribute('srcset');
    }
    if (webpSource) {
      if (isWebp) webpSource.srcset = url;
      else if (isAvif) webpSource.srcset = 'assets/images/hero/hero.webp';
      else webpSource.removeAttribute('srcset');
    }
    heroImg.src = url;
    if (heroImg.decode) return heroImg.decode().catch(function () {});
    return Promise.resolve();
  }

  function ensureHeroReady() {
    if (heroIsReady) return Promise.resolve(true);
    if (heroReadyPromise) return heroReadyPromise;

    heroReadyPromise = firstAvailable(HERO_CANDIDATES)
      .then(function (url) { return applyHeroUrl(url).then(function () { return url; }); })
      .then(function () { return warmFonts(); })
      .then(function () {
        heroIsReady = true;
        if (heroEl) void heroEl.offsetWidth;
        return true;
      })
      .catch(function () {
        if (heroImg) heroImg.src = 'assets/images/hero/hero-alt.png';
        heroIsReady = true;
        return false;
      });

    return heroReadyPromise;
  }

  function scheduleHeroWarm() {
    if (heroReadyPromise) return;
    if (isVideoReady() || !video) { ensureHeroReady(); return; }
    var once = function () {
      video.removeEventListener('canplay', once);
      ensureHeroReady();
    };
    video.addEventListener('canplay', once);
    setTimeout(function () { ensureHeroReady(); }, 5000);
  }

  if (document.readyState === 'complete') scheduleHeroWarm();
  else window.addEventListener('load', scheduleHeroWarm);

  /* ---------------------------------------------------------
     5 · Landing → video → hero
     --------------------------------------------------------- */
  function revealHeroAndSite() {
    if (heroEl) {
      heroEl.classList.add('loaded');
      heroEl.setAttribute('aria-busy', 'false');
    }
    body.classList.add('is-revealed');
    unlockScroll();
    initReveals();
    initGalleryWall();
    activateLazySections();

    /* Show the audio disc button now that we're on the main site */
    showAudioBtn();

    setTimeout(function () {
      if (heroEl) heroEl.classList.add('text-ready');
    }, TEXT_REVEAL_MS);

    revealBox.classList.remove('is-armed', 'is-on');
    revealBox.classList.add('is-out', 'is-live');

    setTimeout(function () {
      revealBox.classList.add('is-gone');
      revealBox.setAttribute('aria-hidden', 'true');
      try {
        video.pause();
        video.removeAttribute('src');
        while (video.firstChild) video.removeChild(video.firstChild);
        video.load();
      } catch (e) {}
    }, 900);
  }

  function finishReveal() {
    if (finished) return;
    finished = true;
    clearTimeout(safety);
    clearTimeout(readyWait);

    try {
      video.pause();
      if (video.duration && isFinite(video.duration)) {
        video.currentTime = Math.max(0, video.duration - 0.05);
      }
    } catch (e) {}

    ensureHeroReady().then(function () { revealHeroAndSite(); });
  }

  function startPlaybackUnderCover() {
    if (finished) return;

    ensureHeroReady();
    revealBox.classList.add('is-armed');
    revealBox.removeAttribute('aria-hidden');

    try { video.currentTime = 0; } catch (e) {}

    var coverLifted = false;
    function liftCover() {
      if (coverLifted || finished) return;
      coverLifted = true;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          landing.classList.remove('is-opening');
          landing.classList.add('is-out');
          setTimeout(function () {
            landing.classList.add('is-gone');
            revealBox.classList.add('is-on', 'is-live');
            revealBox.classList.remove('is-armed');
          }, COVER_FADE_MS);
        });
      });
    }

    function onPlaying() {
      video.removeEventListener('playing', onPlaying);
      liftCover();
      ensureHeroReady();
    }
    video.addEventListener('playing', onPlaying);

    var attempt = video.play();
    if (attempt && attempt.then) {
      attempt.then(function () {
        if (!video.paused) liftCover();
      }).catch(function () {
        video.muted = true;
        video.setAttribute('muted', '');
        var retry = video.play();
        if (retry && retry.then) {
          retry.then(function () {
            if (!video.paused) liftCover();
          }).catch(function () {
            video.removeEventListener('playing', onPlaying);
            finishReveal();
          });
        } else {
          video.removeEventListener('playing', onPlaying);
          finishReveal();
        }
      });
    } else if (!video.paused) {
      liftCover();
    }

    setTimeout(function () {
      if (!coverLifted && !finished) liftCover();
    }, 900);

    setTimeout(function () { if (!finished && skipBtn) skipBtn.hidden = false; }, 5000);

    safety = setTimeout(function () {
      if (!finished && (video.readyState < 2 || video.paused)) finishReveal();
    }, PLAY_SAFETY_MS);
  }

  function whenVideoReady(done) {
    if (isVideoReady() || videoReady) { done(); return; }

    var settled = false;
    function settle() {
      if (settled) return;
      settled = true;
      video.removeEventListener('canplay', settle);
      video.removeEventListener('canplaythrough', settle);
      video.removeEventListener('loadeddata', settle);
      clearTimeout(readyWait);
      done();
    }
    video.addEventListener('canplay', settle);
    video.addEventListener('canplaythrough', settle);
    video.addEventListener('loadeddata', settle);
    try { video.load(); } catch (e) {}
    readyWait = setTimeout(settle, READY_TIMEOUT_MS);
  }

  function openInvitation() {
    if (opening || finished) return;
    opening = true;
    if (openBtn) openBtn.disabled = true;
    landing.classList.add('is-opening');

    /* Start music inside the user gesture — this is the only reliable
       moment browsers will allow autoplay with sound */
    startAudio();

    if (!video) { finishReveal(); return; }
    whenVideoReady(startPlaybackUnderCover);
  }

  if (openBtn) openBtn.addEventListener('click', openInvitation);
  if (landing) {
    landing.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('a, button')) return;
      openInvitation();
    });
  }
  if (skipBtn) skipBtn.addEventListener('click', finishReveal);

  if (video) {
    video.addEventListener('ended', finishReveal);
    video.addEventListener('error', function () {
      if (opening && !finished) finishReveal();
    });
    video.addEventListener('timeupdate', function () {
      if (video.duration && video.duration - video.currentTime < 0.12) finishReveal();
    });
    video.addEventListener('playing', function () { ensureHeroReady(); }, { once: true });
  }

  /* ---------------------------------------------------------
     6 · Scroll reveals
     --------------------------------------------------------- */
  var revealsStarted = false;
  function initReveals() {
    if (revealsStarted) return;
    revealsStarted = true;

    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------
     7 · Lazy sections
     --------------------------------------------------------- */
  function activateLazySections() {
    Array.prototype.forEach.call(
      document.querySelectorAll('#gallery img[data-src], #couple img[data-src]'),
      function (img) {
        if (!img.getAttribute('src')) {
          img.src = img.getAttribute('data-src');
          img.removeAttribute('data-src');
        }
      }
    );
  }

  /* ---------------------------------------------------------
     7b · Gallery photo wall — enter / float / parallax / touch
     --------------------------------------------------------- */
  function initGalleryWall() {
    var wall = document.getElementById('photoWall');
    if (!wall) return;

    var cards = wall.querySelectorAll('.photo-card');
    if (!cards.length) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function revealCard(card) {
      if (card.classList.contains('is-in')) return;
      card.classList.add('is-in');
    }

    if (reduceMotion || !('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(cards, revealCard);
    } else {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          revealCard(en.target);
          io.unobserve(en.target);
        });
      }, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
      Array.prototype.forEach.call(cards, function (card) { io.observe(card); });
    }

    /* Touch bounce */
    Array.prototype.forEach.call(cards, function (card) {
      var clearTouch = function () { card.classList.remove('is-touched'); };
      card.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse') return;
        card.classList.add('is-touched');
        window.setTimeout(clearTouch, 560);
      }, { passive: true });
    });

    if (reduceMotion) return;

    /* Scroll parallax */
    var ticking = false;
    var speeds = [];
    Array.prototype.forEach.call(cards, function (card, i) {
      var raw = parseFloat(card.getAttribute('data-speed'));
      speeds[i] = isNaN(raw) ? ((i % 2 === 0) ? 0.05 : -0.04) : raw;
    });

    function updateParallax() {
      ticking = false;
      var vh = window.innerHeight || 1;
      var mid = vh * 0.5;
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (!card.classList.contains('is-in')) continue;
        var rect = card.getBoundingClientRect();
        if (rect.bottom < -80 || rect.top > vh + 80) continue;
        var offset = (rect.top + rect.height * 0.5 - mid) * speeds[i];
        if (offset > 18) offset = 18;
        if (offset < -18) offset = -18;
        card.style.setProperty('--parallax-y', offset.toFixed(2) + 'px');
      }
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(updateParallax);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();
  }

  /* ---------------------------------------------------------
     8 · Countdown — 30 Dec 2026, 11:30 IST
     --------------------------------------------------------- */
  (function countdown() {
    /* Wedding: Wednesday 30 December 2026 at 11:30 AM IST (UTC+5:30) */
    var target = new Date('2026-12-30T11:30:00+05:30').getTime();
    var d = document.getElementById('cdD'),
        h = document.getElementById('cdH'),
        m = document.getElementById('cdM'),
        s = document.getElementById('cdS');
    if (!d || isNaN(target)) return;

    var pad = function (n) { return n < 10 ? '0' + n : String(n); };

    function tick() {
      var left = target - Date.now();
      if (left <= 0) {
        d.textContent = h.textContent = m.textContent = s.textContent = '00';
        clearInterval(timer);
        return;
      }
      var sec = Math.floor(left / 1000);
      d.textContent = pad(Math.floor(sec / 86400));
      h.textContent = pad(Math.floor(sec / 3600) % 24);
      m.textContent = pad(Math.floor(sec / 60) % 60);
      s.textContent = pad(sec % 60);
    }
    tick();
    var timer = setInterval(tick, 1000);
  })();

  /* ---------------------------------------------------------
     9 · Particles + THANK YOU finale
     --------------------------------------------------------- */
  function bootParticles() {
    if (!window.KeralaParticles) return;
    window.KeralaParticles.init();

    var stage = document.getElementById('finaleStage');
    if (!stage || !('IntersectionObserver' in window)) return;

    var fo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.intersectionRatio >= 0.6) {
          window.KeralaParticles.finale(stage);
        } else if (!en.isIntersecting && en.boundingClientRect.top > 0) {
          window.KeralaParticles.reset();
        }
      });
    }, { threshold: [0, 0.6, 0.95] });

    fo.observe(stage);
  }

  if (document.readyState === 'complete') bootParticles();
  else window.addEventListener('load', bootParticles);

  /* ---------------------------------------------------------
     10 · Smooth anchor
     --------------------------------------------------------- */
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a) return;
    var id = a.getAttribute('href');
    if (!id || id === '#') return;
    var t = document.querySelector(id);
    if (!t) return;
    e.preventDefault();
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------------------------------------------------------
     11 · Scroll progress bar
     --------------------------------------------------------- */
  (function () {
    var bar = document.getElementById('scroll-progress');
    if (!bar) return;

    function updateBar() {
      var el = document.documentElement;
      var b = document.body;
      var scrollTop = el.scrollTop || b.scrollTop;
      var scrollHeight = (el.scrollHeight || b.scrollHeight) - el.clientHeight;
      if (scrollHeight <= 0) { bar.style.width = '0%'; return; }
      var pct = Math.min(100, Math.round((scrollTop / scrollHeight) * 1000) / 10);
      bar.style.width = pct + '%';
    }

    var barVisible = false;
    function onScroll() {
      if (!document.body.classList.contains('is-revealed')) return;
      if (!barVisible) {
        barVisible = true;
        bar.classList.add('is-visible');
      }
      updateBar();
    }

    window.addEventListener('scroll', onScroll, { passive: true });
  })();

  /* ---------------------------------------------------------
     12 · Interactive Story Timeline & Lightbox
     --------------------------------------------------------- */
  (function initStoryTimeline() {
    var storyCards = document.querySelectorAll('.story-photo-card');
    var navBtns = document.querySelectorAll('.story-nav__btn');
    var storyItems = document.querySelectorAll('#timeline .tl-item');
    var lightbox = document.getElementById('storyLightbox');
    var lightboxImg = document.getElementById('lightboxImg');
    var lightboxCaption = document.getElementById('lightboxCaption');
    var lightboxCounter = document.getElementById('lightboxCounter');
    var lightboxClose = document.getElementById('lightboxClose');
    var lightboxPrev = document.getElementById('lightboxPrev');
    var lightboxNext = document.getElementById('lightboxNext');
    var lightboxBackdrop = document.getElementById('lightboxBackdrop');

    if (!storyCards.length) return;

    /* Collect story photo data for lightbox */
    var photosData = [];
    Array.prototype.forEach.call(storyCards, function (card, i) {
      photosData.push({
        src: card.getAttribute('data-lightbox-src') || (card.querySelector('img') && card.querySelector('img').src) || '',
        caption: card.getAttribute('data-lightbox-caption') || 'Story Photo',
        index: i
      });

      /* 3D Tilt Effect on Mouse Move */
      card.addEventListener('mousemove', function (e) {
        var rect = card.getBoundingClientRect();
        var x = e.clientX - rect.left;
        var y = e.clientY - rect.top;
        var cx = rect.width / 2;
        var cy = rect.height / 2;
        var rx = ((cy - y) / cy) * 8;
        var ry = ((x - cx) / cx) * 8;
        card.style.transform = 'perspective(1000px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateY(-4px) scale(1.015)';
      });

      card.addEventListener('mouseleave', function () {
        card.style.transform = '';
      });

      /* Click to open Lightbox */
      card.addEventListener('click', function () {
        openLightbox(i);
      });
    });

    /* Lightbox state & handlers */
    var currentIndex = 0;

    function openLightbox(index) {
      if (!lightbox || index < 0 || index >= photosData.length) return;
      currentIndex = index;
      var item = photosData[currentIndex];
      if (lightboxImg) lightboxImg.src = item.src;
      if (lightboxCaption) lightboxCaption.textContent = item.caption;
      if (lightboxCounter) lightboxCounter.textContent = 'Memory ' + (currentIndex + 1) + ' of ' + photosData.length;
      lightbox.classList.add('is-open');
      lightbox.removeAttribute('hidden');
      document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
      if (!lightbox) return;
      lightbox.classList.remove('is-open');
      setTimeout(function () {
        lightbox.setAttribute('hidden', 'true');
        if (!document.body.classList.contains('is-locked')) {
          document.body.style.overflow = '';
        }
      }, 350);
    }

    function showPrev() {
      var prev = (currentIndex - 1 + photosData.length) % photosData.length;
      openLightbox(prev);
    }

    function showNext() {
      var next = (currentIndex + 1) % photosData.length;
      openLightbox(next);
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
    if (lightboxBackdrop) lightboxBackdrop.addEventListener('click', closeLightbox);
    if (lightboxPrev) lightboxPrev.addEventListener('click', showPrev);
    if (lightboxNext) lightboxNext.addEventListener('click', showNext);

    /* Keyboard navigation */
    document.addEventListener('keydown', function (e) {
      if (!lightbox || !lightbox.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      else if (e.key === 'ArrowLeft') showPrev();
      else if (e.key === 'ArrowRight') showNext();
    });

    /* Touch Swipe support for Lightbox */
    var touchStartX = 0;
    var touchEndX = 0;
    if (lightbox) {
      lightbox.addEventListener('touchstart', function (e) {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      lightbox.addEventListener('touchend', function (e) {
        touchEndX = e.changedTouches[0].screenX;
        handleSwipe();
      }, { passive: true });
    }

    function handleSwipe() {
      var diff = touchEndX - touchStartX;
      if (Math.abs(diff) > 40) {
        if (diff < 0) showNext();
        else showPrev();
      }
    }

    /* Story Navigation Bar Buttons & ScrollSpy */
    Array.prototype.forEach.call(navBtns, function (btn) {
      btn.addEventListener('click', function () {
        var targetId = btn.getAttribute('data-story-target');
        var targetEl = document.getElementById(targetId);
        if (!targetEl) return;

        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

        Array.prototype.forEach.call(navBtns, function (b) { b.classList.remove('is-active'); });
        btn.classList.add('is-active');

        Array.prototype.forEach.call(storyItems, function (st) { st.classList.remove('is-active-milestone'); });
        targetEl.classList.add('is-active-milestone');
        setTimeout(function () { targetEl.classList.remove('is-active-milestone'); }, 2500);
      });
    });

    /* ScrollSpy IntersectionObserver for Story Navigation */
    if ('IntersectionObserver' in window && storyItems.length) {
      var storyIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            var id = entry.target.id;
            Array.prototype.forEach.call(navBtns, function (btn) {
              btn.classList.toggle('is-active', btn.getAttribute('data-story-target') === id);
            });
          }
        });
      }, { threshold: [0.4, 0.7] });

      Array.prototype.forEach.call(storyItems, function (st) { storyIo.observe(st); });
    }
  })();

})();
