(() => {
  'use strict';

  const config = window.VYB_CONFIG;
  if (!config) throw new Error('Falta config.js. Generá la página con tools/build.mjs.');

  const mode = config.mode === 'booking' ? 'booking' : 'basic';
  const languages = config.language.available;
  let language = config.language.default;
  const $ = id => document.getElementById(id);
  const local = value => value && typeof value === 'object' ? (value[language] ?? value.en ?? '') : (value ?? '');
  const t = key => config.translations[language]?.[key] ?? config.translations[config.language.default]?.[key] ?? key;

  function validHttpsUrl(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    try {
      const url = new URL(value.trim());
      return url.protocol === 'https:' && url.hostname && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function safeImageSource(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const source = value.trim();
    if (/[\u0000-\u001f\u007f<>"'\\]/.test(source) || source.startsWith('/') || source.startsWith('//') || source.split('/').includes('..')) return '';
    if (/^[a-z][a-z\d+.-]*:/i.test(source)) return validHttpsUrl(source);
    return source.startsWith('assets/') ? source : '';
  }

  const bookingMode = config.booking?.mode === 'modal' ? 'modal' : 'external';
  const candidateBookingUrl = validHttpsUrl(config.booking?.url);
  let bookingUrl = candidateBookingUrl;
  if (bookingMode === 'modal' && candidateBookingUrl) {
    const embeddedUrl = new URL(candidateBookingUrl);
    if (embeddedUrl.port || !embeddedUrl.hostname.toLowerCase().endsWith('.setmore.com')) bookingUrl = '';
  }
  const bookingUrlWasProvided = Boolean(String(config.booking?.url || '').trim());
  const serviceDisplay = config.serviceDisplay || { price: true, duration: true };

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(element => { element.textContent = value ?? ''; });
  }

  function applyBranding() {
    const colorVariables = { ...(config.template?.defaults?.colors || {}), ...(config.brand?.colors || {}) };
    const cssMap = config.colorVariables || {};
    for (const [key, value] of Object.entries(colorVariables)) {
      const variable = cssMap[key] || defaultColorVariables[key];
      if (variable && /^#(?:[\da-f]{3}|[\da-f]{6}|[\da-f]{8})$/i.test(value)) document.documentElement.style.setProperty(variable, value);
    }

    const business = config.business;
    setText('[data-business-name]', business.name);
    setText('[data-business-tagline]', business.tagline || '');
    setText('[data-business-demo]', business.demoLabel || '');
    setText('[data-copyright-year]', business.copyrightYear || new Date().getFullYear());
    setText('[data-business-year]', business.established || '');
    setText('[data-business-monogram]', makeMonogram());
    setText('[data-business-initial]', business.name.trim().charAt(0).toUpperCase());
    $('brand-link').setAttribute('aria-label', business.name + ' home');
    $('brand-link').title = business.name;
    $('demo-ribbon').hidden = !business.demoLabel;
    $('footer-demo-label').hidden = !business.demoLabel;
    $('sample-price-note').hidden = !business.demoLabel;
    $('established').hidden = !business.established;

    const logo = safeImageSource(config.brand?.logoImage);
    if (logo) {
      const image = document.createElement('img');
      image.src = logo;
      image.alt = business.name + ' logo';
      $('brand-icon').replaceChildren(image);
    }
    document.title = config.seo.title;
    $('meta-description').content = config.seo.description;
  }

  const defaultColorVariables = {
    primary: '--gold', secondary: '--ink-2', backgroundDark: '--black', accentLight: '--gold-light',
    backgroundLight: '--paper', backgroundSoft: '--paper-soft', muted: '--muted', white: '--white', text: '--ink', button: '--button',
    buttonText: '--button-text', servicesBackground: '--services-bg', heroBackground: '--hero-bg',
    manifestoBackground: '--manifesto-bg', footerBackground: '--footer-bg', textOnDark: '--text-on-dark',
    textMutedOnDark: '--text-muted-on-dark', textMutedOnLight: '--text-muted-on-light',
    cardBackground: '--card-bg', cardBorder: '--card-border'
  };

  function makeMonogram() {
    const words = config.business.name.trim().split(/\s+/).filter(Boolean);
    return words.length > 1 ? `${words[0][0]} / ${words.at(-1)[0]}`.toUpperCase() : words[0].slice(0, 2).toUpperCase();
  }

  function applyImages() {
    const hero = safeImageSource(config.images.hero);
    const manifesto = safeImageSource(config.images.manifesto);
    if (hero) $('hero-image').style.backgroundImage = `url("${hero.replaceAll('"', '%22')}")`;
    if (manifesto) $('manifesto-image').style.backgroundImage = `url("${manifesto.replaceAll('"', '%22')}")`;
    $('hero-image').setAttribute('aria-label', local(config.images.heroAlt));
  }

  function applyTranslations() {
    document.documentElement.lang = language;
    document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = t(element.dataset.i18n); });
    const nextLanguage = languages.find(candidate => candidate !== language);
    const languageButton = $('lang-toggle');
    languageButton.innerHTML = nextLanguage ? `${nextLanguage.toUpperCase()} <span aria-hidden="true">↗</span>` : '';
    languageButton.hidden = !nextLanguage;
    languageButton.setAttribute('aria-label', nextLanguage ? t('switchLanguage').replace('{language}', t(`languageName_${nextLanguage}`)) : '');
    $('main-nav').setAttribute('aria-label', t('navLabel'));
    $('menu-toggle').setAttribute('aria-label', $('main-nav').classList.contains('is-open') ? t('closeMenu') : t('openMenu'));
    $('lightbox-close').setAttribute('aria-label', t('galleryClose'));
    $('image-lightbox').setAttribute('aria-label', t('gallerySelected'));
    if ($('booking-modal')) {
      $('booking-modal-close').setAttribute('aria-label', t('bookingModalClose'));
      $('booking-frame').title = t('bookingModalTitle');
    }
    applyImages();
    renderServices();
    renderGallery();
    renderHours();
    renderContacts();
    renderActions();
    observeRevealElements();
  }

  function formatPrice(amount, currency) {
    return new Intl.NumberFormat(config.language.numberLocale || (language === 'es' ? 'es-AR' : 'en-US'), {
      style: 'currency', currency, maximumFractionDigits: 2
    }).format(amount);
  }

  function makeServiceNode(service, index) {
    const action = mode === 'booking' ? document.createElement(bookingUrl && bookingMode === 'external' ? 'a' : 'button') : document.createElement('div');
    action.className = 'service-row reveal' + (mode === 'basic' ? ' service-row-static' : '');
    if (bookingUrl && bookingMode === 'external') {
      action.href = bookingUrl;
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
      action.setAttribute('aria-label', `${local(service.title)} — ${t('bookNow')}`);
    } else if (mode === 'booking') {
      action.type = 'button';
      action.setAttribute('aria-label', `${local(service.title)} — ${t('bookNow')}`);
      action.addEventListener('click', () => bookingUrl && bookingMode === 'modal' ? openBookingModal(action) : showBookingStatus());
    }

    const number = document.createElement('span');
    number.className = 'service-index';
    number.textContent = String(index + 1).padStart(2, '0');
    const copy = document.createElement('span');
    copy.className = 'service-copy';
    const title = document.createElement('strong');
    title.textContent = local(service.title);
    copy.append(title);
    const descriptionText = local(service.description);
    if (descriptionText) {
      const description = document.createElement('small');
      description.textContent = descriptionText;
      copy.append(description);
    }
    action.append(number, copy);
    if (serviceDisplay.duration) {
      const duration = document.createElement('span');
      duration.className = 'service-duration';
      duration.textContent = local(service.duration);
      action.append(duration);
    }
    if (serviceDisplay.price) {
      const price = document.createElement('span');
      price.className = 'service-price';
      price.textContent = formatPrice(service.price, service.currency);
      action.append(price);
    }
    if (mode === 'booking') {
      const icon = document.createElement('span');
      icon.className = 'service-icon';
      icon.setAttribute('aria-hidden', 'true');
      icon.textContent = '↗';
      action.append(icon);
    }
    return action;
  }

  function renderServices() {
    const section = $('services');
    const list = $('service-list');
    const services = config.services || [];
    section.hidden = services.length === 0;
    list.dataset.showPrice = String(serviceDisplay.price);
    list.dataset.showDuration = String(serviceDisplay.duration);
    list.replaceChildren();
    services.forEach((service, index) => list.append(makeServiceNode(service, index)));
  }

  function renderGallery() {
    const section = $('gallery');
    const grid = $('gallery-grid');
    const gallery = config.images.gallery || [];
    section.hidden = gallery.length === 0;
    grid.classList.toggle('gallery-flex', gallery.length !== 3);
    grid.replaceChildren();
    gallery.forEach((itemData, index) => {
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'gallery-item reveal ' + (index === 0 && gallery.length === 3 ? 'gallery-large' : 'gallery-small') + (index === 2 && gallery.length === 3 ? ' second-small' : '');
      tile.dataset.imageIndex = String(index);
      const image = document.createElement('img');
      image.src = safeImageSource(itemData.src);
      image.alt = local(itemData.alt);
      image.loading = 'lazy';
      const overlay = document.createElement('span');
      overlay.className = 'gallery-overlay';
      const label = document.createElement('span');
      label.textContent = local(itemData.label || itemData.caption || itemData.alt);
      const arrow = document.createElement('span');
      arrow.setAttribute('aria-hidden', 'true');
      arrow.textContent = '↗';
      overlay.append(label, arrow);
      tile.append(image, overlay);
      grid.append(tile);
    });
  }

  function renderHours() {
    const details = config.businessDetails || {};
    const address = local(details.address);
    const hours = details.hours || [];
    $('location-block').hidden = !address;
    $('business-address').textContent = address;
    $('business-address-note').textContent = local(details.addressNote);
    $('hours-block').hidden = hours.length === 0;
    $('hours-note').textContent = local(details.hoursNote);
    const list = $('hours-list');
    list.replaceChildren();
    hours.forEach(item => {
      const row = document.createElement('div');
      row.className = 'hours-row';
      const label = document.createElement('span');
      label.textContent = local(item.label);
      const value = document.createElement('span');
      value.textContent = local(item.value);
      row.append(label, value);
      list.append(row);
    });
    $('visit-card').hidden = !address && hours.length === 0 && !(config.contact?.phone || config.contact?.email || config.contact?.whatsapp || config.contact?.socials?.length);
  }

  function addContactLink(parent, label, value, href, external = false) {
    if (!value || !href) return;
    const link = document.createElement('a');
    link.href = href;
    link.textContent = `${label}: ${value}`;
    if (external) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
    parent.append(link);
  }

  function renderContacts() {
    const contact = config.contact || {};
    const links = $('contact-links');
    links.replaceChildren();
    const phone = String(contact.phone || '').trim();
    const email = String(contact.email || '').trim();
    const whatsapp = String(contact.whatsapp || '').replace(/\D/g, '');
    addContactLink(links, t('phoneLabel'), phone, phone ? 'tel:' + phone.replace(/[^\d+]/g, '') : '');
    addContactLink(links, t('emailLabel'), email, email ? 'mailto:' + email : '');
    addContactLink(links, t('whatsappLabel'), contact.whatsappLabel || contact.whatsapp || '', whatsapp ? `https://wa.me/${whatsapp}` : '', true);
    for (const social of contact.socials || []) addContactLink(links, social.label, social.handle || social.url, validHttpsUrl(social.url), true);
    $('contact-block').hidden = links.childElementCount === 0;
  }

  function externalAction(type) {
    const contact = config.contact || {};
    if (type === 'whatsapp' && contact.whatsapp) return `https://wa.me/${String(contact.whatsapp).replace(/\D/g, '')}`;
    if (type === 'phone' && contact.phone) return 'tel:' + contact.phone.replace(/[^\d+]/g, '');
    if (type === 'email' && contact.email) return 'mailto:' + contact.email;
    if (type === 'contact') return $('contact-block').hidden ? '' : '#contact-block';
    if (type === 'visit') return $('visit-card').hidden ? '' : '#visit-card';
    return '';
  }

  function makeBasicAction(container, key, className) {
    container.replaceChildren();
    const configured = config.actions?.basic?.[key];
    if (!configured) return;
    const href = configured.type === 'section'
      ? (['#visit', '#visit-card', '#services', '#gallery', '#story'].includes(configured.target) && $(configured.target.slice(1)) && !$(configured.target.slice(1)).hidden ? configured.target : '')
      : externalAction(configured.type);
    if (!href) return;
    const link = document.createElement('a');
    link.className = className;
    link.href = href;
    link.append(document.createTextNode(local(configured.label) + ' '));
    const arrow = document.createElement('span');
    arrow.className = 'button-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    link.append(arrow);
    container.append(link);
  }

  function makeBookingAction(container, className, key) {
    container.replaceChildren();
    if (mode !== 'booking') return;
    const action = document.createElement(bookingUrl && bookingMode === 'external' ? 'a' : 'button');
    action.className = className;
    if (bookingUrl && bookingMode === 'external') {
      action.href = bookingUrl;
      action.target = '_blank';
      action.rel = 'noopener noreferrer';
      action.setAttribute('aria-label', `${t(key)} — ${t('bookingOpenExternal')}`);
    } else if (bookingUrl && bookingMode === 'modal') {
      action.type = 'button';
      action.setAttribute('aria-haspopup', 'dialog');
      action.addEventListener('click', () => openBookingModal(action));
    } else {
      action.type = 'button';
      action.addEventListener('click', showBookingStatus);
    }
    action.append(document.createTextNode(t(key) + ' '));
    const arrow = document.createElement('span');
    arrow.className = 'button-arrow';
    arrow.setAttribute('aria-hidden', 'true');
    arrow.textContent = '↗';
    action.append(arrow);
    container.append(action);
  }

  function renderActions() {
    const header = $('header-booking-action');
    const hero = $('hero-primary-action');
    const manifesto = $('manifesto-primary-action');
    const visit = $('visit-primary-action');
    if (mode === 'booking') {
      makeBookingAction(header, 'button button-outline header-book', 'bookNow');
      makeBookingAction(hero, 'button button-gold', 'heroBooking');
      makeBookingAction(manifesto, 'button button-gold', 'manifestoBooking');
      makeBookingAction(visit, 'button button-dark', 'visitBooking');
    } else {
      header.replaceChildren();
      makeBasicAction(hero, 'primary', 'button button-gold');
      makeBasicAction(manifesto, 'manifesto', 'button button-gold');
      makeBasicAction(visit, 'visit', 'button button-dark');
    }
  }

  function showBookingStatus() {
    const status = $('booking-status');
    if (!status) return;
    status.hidden = false;
    status.textContent = bookingUrlWasProvided ? t('bookingInvalidUrl') : t('bookingNotConfigured');
    status.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  }

  const bookingModal = $('booking-modal');
  let previousBookingFocus = null;
  let inertBackground = [];
  function openBookingModal(trigger) {
    if (!bookingModal || !bookingUrl || bookingMode !== 'modal') { showBookingStatus(); return; }
    previousBookingFocus = trigger || document.activeElement;
    const frame = $('booking-frame');
    frame.src = bookingUrl;
    $('booking-fallback').href = bookingUrl;
    $('booking-fallback').hidden = false;
    bookingModal.hidden = false;
    inertBackground = [...document.body.children]
      .filter(element => element !== bookingModal)
      .map(element => [element, element.inert]);
    inertBackground.forEach(([element]) => { element.inert = true; });
    document.body.classList.add('modal-open');
    $('booking-modal-close').focus();
  }
  function closeBookingModal() {
    if (!bookingModal || bookingModal.hidden) return;
    bookingModal.hidden = true;
    $('booking-frame').removeAttribute('src');
    $('booking-fallback').removeAttribute('href');
    $('booking-fallback').hidden = true;
    inertBackground.forEach(([element, wasInert]) => { element.inert = wasInert; });
    inertBackground = [];
    document.body.classList.remove('modal-open');
    previousBookingFocus?.focus();
  }
  if (bookingModal) {
    $('booking-modal-close').addEventListener('click', closeBookingModal);
    bookingModal.addEventListener('click', event => { if (event.target === bookingModal) closeBookingModal(); });
  }

  $('lang-toggle').addEventListener('click', () => {
    const next = languages.find(candidate => candidate !== language);
    if (!next) return;
    language = next;
    applyTranslations();
    if ($('booking-status') && !$('booking-status').hidden) showBookingStatus();
  });

  const menuButton = $('menu-toggle');
  const nav = $('main-nav');
  function closeMenu() {
    nav.classList.remove('is-open');
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', t('openMenu'));
  }
  menuButton.addEventListener('click', () => {
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', t(open ? 'closeMenu' : 'openMenu'));
  });
  nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
  document.querySelectorAll('.footer-right a, .brand').forEach(link => link.addEventListener('click', closeMenu));

  const siteHeader = document.querySelector('.site-header');
  const themedSections = [...document.querySelectorAll('[data-header-theme]')];
  let themeFrame = 0;
  function updateHeaderTheme() {
    themeFrame = 0;
    const marker = siteHeader.getBoundingClientRect().bottom + 1;
    const current = themedSections.find(section => {
      const rect = section.getBoundingClientRect();
      return rect.top <= marker && rect.bottom > marker;
    });
    siteHeader.classList.toggle('header-light', current?.dataset.headerTheme === 'light');
  }
  function scheduleHeaderThemeUpdate() {
    if (!themeFrame) themeFrame = window.requestAnimationFrame(updateHeaderTheme);
  }
  window.addEventListener('scroll', scheduleHeaderThemeUpdate, { passive: true });
  window.addEventListener('resize', scheduleHeaderThemeUpdate);

  const lightbox = $('image-lightbox');
  const lightboxImage = $('lightbox-image');
  let previousGalleryFocus = null;
  function openLightbox(tile) {
    const item = config.images.gallery?.[Number(tile.dataset.imageIndex)];
    if (!item) return;
    previousGalleryFocus = tile;
    lightboxImage.src = safeImageSource(item.large || item.src);
    lightboxImage.alt = local(item.alt);
    $('lightbox-caption').textContent = local(item.caption);
    lightbox.hidden = false;
    document.body.classList.add('modal-open');
    $('lightbox-close').focus();
  }
  function closeLightbox() {
    lightbox.hidden = true;
    lightboxImage.removeAttribute('src');
    document.body.classList.remove('modal-open');
    previousGalleryFocus?.focus();
  }
  $('gallery-grid').addEventListener('click', event => {
    const tile = event.target.closest('[data-image-index]');
    if (tile) openLightbox(tile);
  });
  $('lightbox-close').addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', event => { if (event.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', event => {
    if (bookingModal && !bookingModal.hidden && event.key === 'Escape') closeBookingModal();
    if (bookingModal && !bookingModal.hidden && event.key === 'Tab') {
      const stops = [$('booking-modal-close'), $('booking-frame'), ...(!$('booking-fallback').hidden ? [$('booking-fallback')] : [])].filter(element => element && !element.hidden);
      const first = stops[0], last = stops.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    if (event.key === 'Escape' && !lightbox.hidden) closeLightbox();
    if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu();
    if (event.key === 'Tab' && !lightbox.hidden) { event.preventDefault(); $('lightbox-close').focus(); }
  });

  function observeRevealElements() {
    const items = [...document.querySelectorAll('.reveal:not(.is-visible)')];
    if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
      }), { threshold: 0.08, rootMargin: '0px 0px -20px 0px' });
      items.forEach(item => observer.observe(item));
    } else items.forEach(item => item.classList.add('is-visible'));
  }

  applyBranding();
  applyTranslations();
  updateHeaderTheme();
})();
