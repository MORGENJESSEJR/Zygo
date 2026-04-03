'use strict';

(function initZygoApp() {
  const root = document.getElementById('app-root');
  const toast = document.getElementById('toast');
  const header = document.getElementById('shell-header');
  const Data = window.ZygoData;

  if (!root || !toast || !header || !Data) return;

  let state = Data.loadState();

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function persist() {
    Data.saveState(state);
  }

  function commit(next) {
    state = next;
    persist();
    render();
  }

  function currentRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    return { path: path || '/', params: new URLSearchParams(queryString || '') };
  }

  function navigate(path) {
    const target = `#${path}`;
    if (window.location.hash === target) {
      render();
      return;
    }
    window.location.hash = target;
  }

  function notify(message) {
    toast.hidden = false;
    toast.textContent = message;
    toast.classList.add('visible');
    window.clearTimeout(notify.timer);
    notify.timer = window.setTimeout(() => {
      toast.hidden = true;
      toast.classList.remove('visible');
    }, 2800);
  }

  function syncNavigation(path) {
    header.classList.toggle('scrolled', window.scrollY > 12);
    document.querySelectorAll('.primary-nav a, .mobile-nav a').forEach((link) => {
      const target = (link.getAttribute('href') || '#/').replace(/^#/, '') || '/';
      const active = target === path;
      link.classList.toggle('active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function areaOptions(selectedId) {
    return Data.AREAS.map((area) => `<option value="${area.id}"${area.id === selectedId ? ' selected' : ''}>${area.label}</option>`).join('');
  }

  function paymentOptions(intent, selectedId) {
    const methods = Data.PAYMENT_METHODS.filter((method) => {
      if (intent === 'hire-vehicle') return method.id !== 'cash';
      return method.id !== 'transfer';
    });
    return methods.map((method) => `<button type="button" class="segmented-pill${selectedId === method.id ? ' active' : ''}" data-payment="${method.id}">${method.label}</button>`).join('');
  }

  function intentLabel(intent) {
    return {
      'move-me': 'Move me',
      'shared-ride': 'Shared ride',
      'move-goods': 'Move goods',
      'hire-vehicle': 'Hire a vehicle',
    }[intent] || intent;
  }

  function paymentLabel(methodId) {
    const method = Data.PAYMENT_METHODS.find((entry) => entry.id === methodId);
    return method ? method.label : methodId;
  }

  function serviceMeta(intent) {
    return {
      'move-me': {
        title: 'Private rides',
        strap: 'Fast city pickups with verified driver details.',
        detail: 'Best for direct point-to-point movement across Harare.',
        stat: 'Direct dispatch',
      },
      'shared-ride': {
        title: 'Shared seats',
        strap: 'Match onto approved commuter corridors instead of paying for the full car.',
        detail: 'Built for fairer everyday movement on familiar routes.',
        stat: 'Seat-by-seat',
      },
      'move-goods': {
        title: 'Goods movement',
        strap: 'Pick cargo-fit supply for stock, deliveries, and same-day market runs.',
        detail: 'Optimised for traders who move stock as often as they move themselves.',
        stat: 'Load-matched',
      },
      'hire-vehicle': {
        title: 'Vehicle hire',
        strap: 'Reserve larger supply for time-based jobs or repeated drops.',
        detail: 'Better for multi-stop days, crews, and longer operating windows.',
        stat: 'Hourly cover',
      },
    }[intent] || {
      title: intentLabel(intent),
      strap: 'Set the task and match the route.',
      detail: '',
      stat: 'Marketplace',
    };
  }

  function draftAreaLabel(fieldName) {
    return state.bookingDraft[locationTextKey(fieldName)] || Data.getAreaLabel(state.bookingDraft[fieldName]) || 'Select area';
  }

  function bookingModes() {
    return [
      { intent: 'move-me', code: 'R', label: 'Ride', copy: 'Private direct trip' },
      { intent: 'shared-ride', code: 'S', label: 'Shared', copy: 'Choose an approved seat' },
      { intent: 'move-goods', code: 'G', label: 'Goods', copy: 'Match the load to supply' },
      { intent: 'hire-vehicle', code: 'H', label: 'Hire', copy: 'Reserve a vehicle by time' },
    ];
  }

  function renderModeSelector(attributeName) {
    return bookingModes().map((entry) => {
      const active = state.bookingDraft.intent === entry.intent;
      return `
        <button type="button" class="task-tile${active ? ' is-active' : ''}" ${attributeName}="${entry.intent}">
          <span class="task-tile-mark">${escapeHtml(entry.code)}</span>
          <span class="task-tile-copy">
            <strong>${escapeHtml(entry.label)}</strong>
            <span>${escapeHtml(entry.copy)}</span>
          </span>
        </button>
      `;
    }).join('');
  }

  function quoteLabel(quote) {
    if (quote.selectionType === 'offer') return 'Shared seat';
    if (quote.selectionId === 'taxi' || quote.selectionId === 'sedan') return 'Private ride';
    if (quote.selectionId === 'pickup' || quote.selectionId === 'truck' || quote.selectionId === 'cart') return 'Goods fit';
    if (quote.selectionId === 'scooter') return 'Quick match';
    return 'Live option';
  }

  function renderBookingCanvas(variant) {
    const quote = selectedQuote() || state.quotes[0] || null;
    const live = latestBooking();
    const pickupLabel = draftAreaLabel('pickup');
    const dropoffLabel = draftAreaLabel('dropoff');
    const mode = serviceMeta(state.bookingDraft.intent);
    const fareText = live
      ? Data.formatMoney(live.quote.fareUsd)
      : quote
        ? Data.formatMoney(quote.fareUsd)
        : 'Quote next';
    const statusText = live
      ? bookingStateMeta(live).label
      : quote
        ? `${quote.etaMinutes} min away`
        : 'Waiting for route';
    const actorText = live
      ? `${live.driver.driverName} / ${live.driver.plateNumber}`
      : quote && quote.driverPreview && quote.driverPreview.driverName
        ? `${quote.driverPreview.driverName} / ${quote.driverPreview.plateNumber || 'verified'}`
        : 'Zygo is ready to match the route';
    const variantClass = variant ? ` map-surface-${variant}` : '';

    return `
      <div class="map-surface${variantClass}">
        <div class="map-grid-overlay" aria-hidden="true"></div>
        <div class="map-glow map-glow-a" aria-hidden="true"></div>
        <div class="map-glow map-glow-b" aria-hidden="true"></div>
        <span class="map-chip map-chip-top">${escapeHtml(mode.stat)}</span>
        <span class="map-chip map-chip-right">${state.quotes.length ? `${state.quotes.length} options nearby` : 'Route staged'}</span>
        <div class="map-node map-node-pickup">
          <span class="map-node-mark">A</span>
          <div>
            <strong>${escapeHtml(pickupLabel)}</strong>
            <span>Pickup</span>
          </div>
        </div>
        <div class="map-route-ribbon" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="map-node map-node-dropoff">
          <span class="map-node-mark">B</span>
          <div>
            <strong>${escapeHtml(dropoffLabel)}</strong>
            <span>Dropoff</span>
          </div>
        </div>
        <article class="map-summary-card">
          <p>${escapeHtml(statusText)}</p>
          <h3>${escapeHtml(fareText)}</h3>
          <strong>${escapeHtml(actorText)}</strong>
          <span>${escapeHtml(quote ? quoteLabel(quote) : mode.title)}</span>
        </article>
      </div>
    `;
  }

  function locationTextKey(fieldName) {
    return `${fieldName}Text`;
  }

  function oppositeLocationField(fieldName) {
    return fieldName === 'pickup' ? 'dropoff' : 'pickup';
  }

  function selectedLocation(fieldName) {
    return Data.getAreaById(state.bookingDraft[fieldName]);
  }

  function locationSupportCopy(fieldName) {
    const area = selectedLocation(fieldName);
    if (area) return area.subtitle || `${area.label} selected.`;
    return fieldName === 'pickup'
      ? 'Type a suburb, rank, or corridor and choose the pickup suggestion.'
      : 'Type the destination area and confirm it from the suggestion list.';
  }

  function getLocationSuggestions(fieldName) {
    return Data.searchAreas(state.bookingDraft[locationTextKey(fieldName)], {
      excludeId: state.bookingDraft[oppositeLocationField(fieldName)],
    });
  }

  function renderLocationSuggestions(fieldName) {
    const suggestions = getLocationSuggestions(fieldName);
    if (!suggestions.length) {
      return `
        <div class="location-empty">
          <strong>No nearby match yet.</strong>
          <span>Try a suburb, rank, or city zone like Copacabana or Borrowdale.</span>
        </div>
      `;
    }

    return suggestions.map((area) => `
      <button type="button" class="location-option" data-location-option="${fieldName}" data-area-id="${area.id}">
        <span class="location-option-mark">${fieldName === 'pickup' ? 'A' : 'B'}</span>
        <span class="location-option-copy">
          <strong>${escapeHtml(area.label)}</strong>
          <span>${escapeHtml(area.subtitle || 'Verified route point')}</span>
        </span>
      </button>
    `).join('');
  }

  function renderLocationField(fieldName, label, placeholder) {
    const textKey = locationTextKey(fieldName);
    const selected = selectedLocation(fieldName);
    return `
      <div class="field location-field" data-location-field="${fieldName}">
        <span>${label}</span>
        <input type="hidden" name="${fieldName}" value="${escapeHtml(state.bookingDraft[fieldName] || '')}">
        <div class="location-input-shell">
          <span class="location-marker${selected ? ' is-resolved' : ''}" aria-hidden="true">${fieldName === 'pickup' ? 'A' : 'B'}</span>
          <input
            type="text"
            value="${escapeHtml(state.bookingDraft[textKey] || '')}"
            placeholder="${escapeHtml(placeholder)}"
            autocomplete="off"
            spellcheck="false"
            data-location-input="${fieldName}"
          >
        </div>
        <div class="location-meta">
          <p class="field-support" data-location-support="${fieldName}">${escapeHtml(locationSupportCopy(fieldName))}</p>
          <span class="location-confirmed${selected ? '' : ' is-muted'}" data-location-confirmed="${fieldName}">${selected ? 'Selected' : 'Choose from suggestions'}</span>
        </div>
        <div class="location-suggestions" data-location-suggestions="${fieldName}">
          ${renderLocationSuggestions(fieldName)}
        </div>
      </div>
    `;
  }

  function initials(name) {
    return String(name || 'Z')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('');
  }

  function imageOrFallback(imageData, label, className) {
    if (imageData) {
      return `<img class="${className}" src="${imageData}" alt="${escapeHtml(label)}">`;
    }
    return `<div class="${className} media-fallback">${escapeHtml(initials(label))}</div>`;
  }

  function selectedQuote() {
    if (!state.selectedChoice) return null;
    return state.quotes.find((quote) => quote.selectionType === state.selectedChoice.selectionType && quote.selectionId === state.selectedChoice.selectionId) || null;
  }

  function latestBooking() {
    if (!state.bookings.length) return null;
    if (state.activeBookingId) {
      return state.bookings.find((booking) => booking.id === state.activeBookingId) || state.bookings[0];
    }
    return state.bookings[0];
  }

  function bookingStateMeta(booking) {
    return Data.BOOKING_STATES.find((entry) => entry.id === booking.state) || Data.BOOKING_STATES[0];
  }

  async function refreshCollections() {
    if (!state.session) {
      state = { ...state, bookings: [], driverProfiles: [], reviewQueue: [], activeBookingId: null };
      persist();
      render();
      return;
    }

    try {
      const tasks = [
        Data.listBookings(state.apiBase, state.session),
        Data.listDriverProfiles(state.apiBase, state.session, 'mine=true'),
      ];
      if (state.session.user.canReviewSupply) {
        tasks.push(Data.listDriverProfiles(state.apiBase, state.session, 'status=pending-review'));
      }
      const [bookingsPayload, profilesPayload, queuePayload] = await Promise.all(tasks);

      const bookings = bookingsPayload.bookings;
      const active = bookings.find((booking) => !['completed', 'safety_alert'].includes(booking.state)) || bookings[0] || null;
      state = {
        ...state,
        bookings,
        driverProfiles: profilesPayload.profiles,
        reviewQueue: queuePayload ? queuePayload.profiles : [],
        activeBookingId: active ? active.id : null,
      };
      persist();
      render();
    } catch (error) {
      notify(error.message);
    }
  }

  async function readFileAsDataUrl(file) {
    if (!file) return '';
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Unable to read image file.'));
      reader.readAsDataURL(file);
    });
  }

  function closeLocationFields(exceptFieldName) {
    root.querySelectorAll('[data-location-field]').forEach((field) => {
      if (!(field instanceof HTMLElement)) return;
      if (field.dataset.locationField === exceptFieldName) return;
      field.classList.remove('is-open');
    });
  }

  function openLocationField(fieldName) {
    closeLocationFields(fieldName);
    const field = root.querySelector(`[data-location-field="${fieldName}"]`);
    if (field instanceof HTMLElement) field.classList.add('is-open');
  }

  function syncLocationField(fieldName) {
    const field = root.querySelector(`[data-location-field="${fieldName}"]`);
    if (!(field instanceof HTMLElement)) return;

    const selected = selectedLocation(fieldName);
    const hiddenInput = field.querySelector(`input[type="hidden"][name="${fieldName}"]`);
    const visibleInput = field.querySelector(`[data-location-input="${fieldName}"]`);
    const marker = field.querySelector('.location-marker');
    const support = field.querySelector(`[data-location-support="${fieldName}"]`);
    const confirmed = field.querySelector(`[data-location-confirmed="${fieldName}"]`);
    const suggestions = field.querySelector(`[data-location-suggestions="${fieldName}"]`);

    if (hiddenInput instanceof HTMLInputElement) hiddenInput.value = state.bookingDraft[fieldName] || '';
    if (visibleInput instanceof HTMLInputElement && visibleInput.value !== state.bookingDraft[locationTextKey(fieldName)]) {
      visibleInput.value = state.bookingDraft[locationTextKey(fieldName)] || '';
    }
    if (marker instanceof HTMLElement) marker.classList.toggle('is-resolved', Boolean(selected));
    if (support instanceof HTMLElement) support.textContent = locationSupportCopy(fieldName);
    if (confirmed instanceof HTMLElement) {
      confirmed.textContent = selected ? 'Selected' : 'Choose from suggestions';
      confirmed.classList.toggle('is-muted', !selected);
    }
    if (suggestions instanceof HTMLElement) suggestions.innerHTML = renderLocationSuggestions(fieldName);
  }

  function syncLocationFields() {
    syncLocationField('pickup');
    syncLocationField('dropoff');
  }

  function silentlyUpdateBookingDraft(patch) {
    state = {
      ...state,
      bookingDraft: {
        ...state.bookingDraft,
        ...patch,
      },
    };
    persist();
  }

  function chooseSuggestedArea(fieldName, areaId) {
    const area = Data.getAreaById(areaId);
    if (!area) return;

    commit({
      ...state,
      bookingDraft: {
        ...state.bookingDraft,
        [fieldName]: area.id,
        [locationTextKey(fieldName)]: area.label,
      },
      quotes: [],
      selectedChoice: null,
    });

    if (fieldName === 'pickup') {
      window.requestAnimationFrame(() => {
        const nextInput = root.querySelector('[data-location-input="dropoff"]');
        if (nextInput instanceof HTMLInputElement) nextInput.focus();
      });
    }
  }

  function focusLocationField(fieldName) {
    window.requestAnimationFrame(() => {
      const input = root.querySelector(`[data-location-input="${fieldName}"]`);
      if (input instanceof HTMLInputElement) {
        input.focus();
        input.select();
      }
      openLocationField(fieldName);
    });
  }

  function renderHomeView() {
    const active = latestBooking();
    const supplyCount = state.driverProfiles.length;
    const currentMode = serviceMeta(state.bookingDraft.intent);
    const routePresets = [
      { label: 'Mbare to town shared ride', pickup: 'mbare', dropoff: 'cbd', intent: 'shared-ride' },
      { label: 'Magaba stock run to Avondale', pickup: 'magaba', dropoff: 'avondale', intent: 'move-goods' },
      { label: 'Borrowdale private ride', pickup: 'cbd', dropoff: 'borrowdale', intent: 'move-me' },
      { label: 'Southerton hire block', pickup: 'southerton', dropoff: 'avondale', intent: 'hire-vehicle' },
    ].map((preset) => `
      <button type="button" class="route-preset" data-route-preset="${preset.pickup}|${preset.dropoff}|${preset.intent}">
        ${escapeHtml(preset.label)}
      </button>
    `).join('');
    const liveSummary = active
      ? `${active.driver.driverName} / ${active.driver.plateNumber}`
      : 'No active trip yet';

    return `
      <div class="page page-home">
        <section class="app-landing">
          <div class="launch-panel card">
            <p class="section-kicker">Harare booking app</p>
            <h1>Where to?</h1>
            <p class="lede">Ride, share a seat, move goods, or hire a vehicle from one booking surface. Set the task first, then compare the live route fit.</p>
            <div class="task-tile-grid">
              ${renderModeSelector('data-home-intent')}
            </div>
            <div class="launch-route-card">
              <div class="launch-route-stop">
                <span class="location-marker is-resolved" aria-hidden="true">A</span>
                <div>
                  <strong>${escapeHtml(draftAreaLabel('pickup'))}</strong>
                  <span>Pickup point</span>
                </div>
              </div>
              <div class="launch-route-divider" aria-hidden="true"></div>
              <div class="launch-route-stop">
                <span class="location-marker is-resolved" aria-hidden="true">B</span>
                <div>
                  <strong>${escapeHtml(draftAreaLabel('dropoff'))}</strong>
                  <span>Dropoff point</span>
                </div>
              </div>
              <div class="launch-meta-row">
                <span class="route-chip">${escapeHtml(currentMode.stat)}</span>
                <span class="route-chip">${escapeHtml(paymentLabel(state.bookingDraft.paymentMethod))}</span>
                <span class="route-chip">${state.quotes.length ? `${state.quotes.length} live options` : 'Quotes after route confirm'}</span>
              </div>
            </div>
            <div class="preset-stack">
              <span class="field-label">Quick route presets</span>
              <div class="preset-row">${routePresets}</div>
            </div>
            <div class="hero-actions">
              <button type="button" class="primary-btn" data-open-booking-flow>Open booking</button>
              <a href="#/drive" class="secondary-btn">Drive with Zygo</a>
            </div>
          </div>

          <aside class="showcase-panel">
            ${renderBookingCanvas('home')}
            <div class="showcase-stack">
              <article class="compact-info-card">
                <span class="section-kicker">Current mode</span>
                <strong>${escapeHtml(currentMode.title)}</strong>
                <p>${escapeHtml(currentMode.strap)}</p>
              </article>
              <article class="compact-info-card">
                <span class="section-kicker">Live safety</span>
                <strong>Start PIN, end PIN, safety flag</strong>
                <p>Trips only close after the rider confirms safe arrival.</p>
              </article>
              <article class="compact-info-card">
                <span class="section-kicker">Latest activity</span>
                <strong>${escapeHtml(liveSummary)}</strong>
                <p>${active ? escapeHtml(active.stateDetail) : `${supplyCount} onboarded driver profile${supplyCount === 1 ? '' : 's'} linked to this account.`}</p>
              </article>
            </div>
          </aside>
        </section>

        <section class="utility-grid">
          <article class="utility-card">
            <span class="section-kicker">Choose supply</span>
            <strong>Direct dispatch or approved shared seats</strong>
            <p>Private supply stays protected behind review before it appears to riders.</p>
          </article>
          <article class="utility-card">
            <span class="section-kicker">Move stock too</span>
            <strong>Goods and vehicle hire use the same route logic</strong>
            <p>You do not need a separate product just because the job changed.</p>
          </article>
          <article class="utility-card">
            <span class="section-kicker">Track live</span>
            <strong>Open the trip panel any time</strong>
            <p>See driver state, raise a safety alert, and close the ride with the end PIN.</p>
          </article>
        </section>

        <section class="home-foot card home-foot-cta">
          <div>
            <p class="section-kicker">Ready now</p>
            <h2>Open the live booking surface and use it like the app itself.</h2>
          </div>
          <div class="hero-actions">
            <button type="button" class="primary-btn" data-open-booking-flow>Book now</button>
            <button type="button" class="secondary-btn" data-home-swap-route>Swap route</button>
          </div>
        </section>
      </div>
    `;
  }

  function renderDriverPreview(quote) {
    const preview = quote.driverPreview || {};
    if (!preview.driverName) return '';
    return `
      <div class="driver-preview">
        ${imageOrFallback(preview.driverPhotoData, preview.driverName, 'avatar')}
        <div class="driver-preview-copy">
          <strong>${escapeHtml(preview.driverName)}</strong>
          <span>${escapeHtml(preview.plateNumber || 'Verified plate')}${preview.rating ? ` / ${preview.rating.toFixed(1)} rating` : ''}${preview.seats ? ` / ${preview.seats} seats` : ''}</span>
        </div>
      </div>
    `;
  }

  function renderQuoteCards() {
    if (!state.quotes.length) {
      return `
        <article class="helper-card">
          <h3>No options loaded yet.</h3>
          <p>Set the route and the task first. Shared ride will pull from approved driver profiles. Other services will pull from dispatch inventory.</p>
        </article>
      `;
    }

    return state.quotes.map((quote) => {
      const chosen = state.selectedChoice && quote.selectionType === state.selectedChoice.selectionType && quote.selectionId === state.selectedChoice.selectionId;
      return `
        <article class="quote-card${chosen ? ' selected' : ''}">
          <div class="quote-topline">
            <span class="quote-kind">${escapeHtml(quoteLabel(quote))}</span>
            <span class="quote-meta">${quote.etaMinutes} min</span>
          </div>
          <div class="quote-head">
            <div>
              <strong class="quote-title">${escapeHtml(quote.vehicleName)}</strong>
              <p class="quote-copy">${escapeHtml(quote.fitReason)}</p>
            </div>
            <h3>${Data.formatMoney(quote.fareUsd)}</h3>
          </div>
          ${renderDriverPreview(quote)}
          <div class="quote-pill-row">
            <span class="route-chip">${quote.distanceKm} km</span>
            <span class="route-chip">${quote.paymentLabels.join(' / ')}</span>
          </div>
          <button type="button" class="secondary-btn quote-action-btn" data-select-choice="${quote.selectionType}:${quote.selectionId}">${chosen ? 'Selected' : 'Choose this option'}</button>
        </article>
      `;
    }).join('');
  }

  function renderReviewCard() {
    const quote = selectedQuote();
    if (!quote) return '';

    return `
      <article class="review-card card review-card-cta">
        <div class="review-head">
          <div>
            <p class="section-kicker">Selected option</p>
            <h3>${escapeHtml(quote.vehicleName)} from ${escapeHtml(draftAreaLabel('pickup'))} to ${escapeHtml(draftAreaLabel('dropoff'))}</h3>
          </div>
          <span class="status-pill">${Data.formatMoney(quote.fareUsd)}</span>
        </div>
        <dl class="review-grid">
          <div><dt>Task</dt><dd>${escapeHtml(intentLabel(state.bookingDraft.intent))}</dd></div>
          <div><dt>Payment</dt><dd>${escapeHtml(paymentLabel(state.bookingDraft.paymentMethod))}</dd></div>
          <div><dt>Passengers</dt><dd>${state.bookingDraft.passengers}</dd></div>
          <div><dt>ETA</dt><dd>${quote.etaMinutes} min</dd></div>
        </dl>
        <div class="booking-inline-summary">
          <span class="route-chip">${escapeHtml(quoteLabel(quote))}</span>
          <span class="route-chip">${escapeHtml(paymentLabel(state.bookingDraft.paymentMethod))}</span>
          <span class="route-chip">End with rider PIN</span>
        </div>
        <p class="review-copy">${escapeHtml(quote.fitReason)}</p>
        ${state.session ? '<button type="button" class="primary-btn" data-confirm-booking>Confirm booking</button>' : '<a href="#/auth?next=/book" class="primary-btn">Sign in to confirm</a>'}
      </article>
    `;
  }

  function renderBookView() {
    const draft = state.bookingDraft;
    const isGoods = draft.intent === 'move-goods';
    const isHire = draft.intent === 'hire-vehicle';
    const isShared = draft.intent === 'shared-ride';
    const mode = serviceMeta(draft.intent);

    return `
      <div class="page page-book">
        <section class="booking-app-stage">
          <form class="card booking-app-card" id="quote-form">
            <div class="booking-app-head">
              <div>
                <p class="section-kicker">Live booking</p>
                <h1>Where to?</h1>
                <p class="lede">${escapeHtml(mode.strap)}</p>
              </div>
              <span class="status-pill">${escapeHtml(mode.stat)}</span>
            </div>

            <div class="task-tile-grid task-tile-grid-book">
              ${renderModeSelector('data-intent')}
            </div>

            <div class="booking-route-shell">
              <div class="field field-full location-stack">
                ${renderLocationField('pickup', 'Pickup location', 'Start typing pickup area')}
                <button type="button" class="location-swap" data-swap-route aria-label="Swap pickup and dropoff">Swap route</button>
                ${renderLocationField('dropoff', 'Dropoff location', 'Where are you going?')}
              </div>
            </div>

            <div class="field-grid booking-config-grid">
              <label class="field">
                <span>Schedule</span>
                <select name="schedule">
                  <option value="now"${draft.schedule === 'now' ? ' selected' : ''}>Now</option>
                  <option value="today"${draft.schedule === 'today' ? ' selected' : ''}>Later today</option>
                  <option value="later"${draft.schedule === 'later' ? ' selected' : ''}>Schedule it</option>
                </select>
              </label>
              <label class="field">
                <span>${isShared ? 'Seats needed' : 'Passengers'}</span>
                <select name="passengers">
                  <option value="1"${draft.passengers === 1 ? ' selected' : ''}>1</option>
                  <option value="2"${draft.passengers === 2 ? ' selected' : ''}>2</option>
                  <option value="3"${draft.passengers === 3 ? ' selected' : ''}>3</option>
                  <option value="4"${draft.passengers === 4 ? ' selected' : ''}>4</option>
                </select>
              </label>
              <label class="field ${isGoods ? '' : 'is-muted'}">
                <span>Load level</span>
                <select name="loadLevel" ${isGoods ? '' : 'disabled'}>
                  <option value="light"${draft.loadLevel === 'light' ? ' selected' : ''}>Light</option>
                  <option value="medium"${draft.loadLevel === 'medium' ? ' selected' : ''}>Medium</option>
                  <option value="heavy"${draft.loadLevel === 'heavy' ? ' selected' : ''}>Heavy</option>
                  <option value="bulk"${draft.loadLevel === 'bulk' ? ' selected' : ''}>Bulk</option>
                </select>
              </label>
              <label class="field ${isHire ? '' : 'is-muted'}">
                <span>Hire hours</span>
                <select name="hireHours" ${isHire ? '' : 'disabled'}>
                  <option value="2"${draft.hireHours === 2 ? ' selected' : ''}>2 hours</option>
                  <option value="4"${draft.hireHours === 4 ? ' selected' : ''}>4 hours</option>
                  <option value="8"${draft.hireHours === 8 ? ' selected' : ''}>8 hours</option>
                </select>
              </label>
            </div>

            <div class="field-block">
              <label class="field-label">Payment method</label>
              <div class="segmented-row">${paymentOptions(draft.intent, draft.paymentMethod)}</div>
            </div>

            <label class="field">
              <span>Trip notes</span>
              <textarea name="notes" rows="3" placeholder="Pickup landmark, stock details, or safety note">${escapeHtml(draft.notes)}</textarea>
            </label>

            <div class="booking-inline-summary">
              <span class="route-chip">${escapeHtml(draftAreaLabel('pickup'))}</span>
              <span class="route-chip">${escapeHtml(draftAreaLabel('dropoff'))}</span>
              <span class="route-chip">${escapeHtml(paymentLabel(draft.paymentMethod))}</span>
              <span class="route-chip">Start and end PIN</span>
            </div>

            <div class="composer-foot">
              <p>${escapeHtml(mode.detail)}</p>
              <button type="submit" class="primary-btn">${isShared ? 'Find shared rides' : 'Get quotes'}</button>
            </div>
          </form>

          <aside class="results-shell">
            ${renderBookingCanvas('results')}
            <section class="card quote-stack-card">
              <div class="side-head">
                <div>
                  <p class="section-kicker">Available options</p>
                  <h2>${state.quotes.length ? `${state.quotes.length} route fit${state.quotes.length === 1 ? '' : 's'}` : 'Waiting for route input'}</h2>
                </div>
                <span class="status-pill">${isShared ? 'Manual driver approval' : 'Dispatch supply'}</span>
              </div>
              <div class="quote-list">${renderQuoteCards()}</div>
            </section>
            ${renderReviewCard()}
          </aside>
        </section>
      </div>
    `;
  }

  function renderProfileCard(profile, reviewAction) {
    return `
      <article class="profile-card">
        <div class="profile-media-row">
          ${imageOrFallback(profile.driverPhotoData, profile.driverName, 'profile-avatar')}
          ${imageOrFallback(profile.vehiclePhotoData, profile.vehicleLabel, 'profile-car')}
        </div>
        <div class="profile-head">
          <div>
            <p class="section-kicker">${escapeHtml(profile.approvalStatus)}</p>
            <h3>${escapeHtml(profile.driverName)}</h3>
          </div>
          <span class="status-pill">${escapeHtml(profile.plateNumber)}</span>
        </div>
        <p>${escapeHtml(profile.vehicleLabel)} / ${escapeHtml(profile.homeAreaLabel)} to ${escapeHtml(profile.routeAreaLabel)}</p>
        <p>${escapeHtml(profile.availability)}</p>
        <div class="quote-meta-row">
          <span>${profile.seats} seats</span>
          <span>${Data.formatMoney(profile.farePerSeat)} per seat</span>
        </div>
        ${reviewAction}
      </article>
    `;
  }

  function renderDriveView() {
    if (!state.session) {
      return `
        <div class="page page-drive">
          <section class="page-heading">
            <div>
              <p class="section-kicker">Drive with Zygo</p>
              <h1>Create your driver and car profile.</h1>
              <p class="lede">Private drivers must be signed in so their vehicle, route corridor, and approval status can be tracked.</p>
            </div>
          </section>
          <article class="card helper-card">
            <h3>Sign in before onboarding.</h3>
            <p>Driver setup stores plate number, route corridor, images, and fare-per-seat before it enters review.</p>
            <a href="#/auth?next=/drive" class="primary-btn">Sign in</a>
          </article>
        </div>
      `;
    }

    const draft = state.driverDraft;
    const canReviewSupply = Boolean(state.session.user.canReviewSupply);
    const queue = state.reviewQueue.map((profile) => renderProfileCard(profile, `<button type="button" class="secondary-btn" data-approve-profile="${profile.id}">Approve for matching</button>`)).join('');
    const mine = state.driverProfiles.map((profile) => renderProfileCard(profile, '')).join('');

    return `
      <div class="page page-drive">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Supply onboarding</p>
            <h1>Add your car, route corridor, and proof.</h1>
            <p class="lede">This form creates a shared ride supply profile. Manual review stays on by default, so the rider side only sees approved drivers.</p>
          </div>
        </section>

        <div class="booking-layout">
          <form class="card form-card" id="driver-form">
            <div class="field-grid">
              <label class="field">
                <span>Driver name</span>
                <input type="text" name="driverName" value="${escapeHtml(draft.driverName || state.session.user.name)}" required>
              </label>
              <label class="field">
                <span>Driver phone</span>
                <input type="tel" name="driverPhone" value="${escapeHtml(draft.driverPhone || state.session.user.phone)}" required>
              </label>
              <label class="field">
                <span>Vehicle type</span>
                <select name="vehicleType">${Data.DRIVER_VEHICLE_TYPES.map((item) => `<option value="${item.id}"${item.id === draft.vehicleType ? ' selected' : ''}>${item.label}</option>`).join('')}</select>
              </label>
              <label class="field">
                <span>Vehicle label</span>
                <input type="text" name="vehicleLabel" value="${escapeHtml(draft.vehicleLabel)}" placeholder="Blue Toyota Axio" required>
              </label>
              <label class="field">
                <span>Plate number</span>
                <input type="text" name="plateNumber" value="${escapeHtml(draft.plateNumber)}" placeholder="AGT 2201" required>
              </label>
              <label class="field">
                <span>Seats offered</span>
                <select name="seats">
                  <option value="1"${draft.seats === 1 ? ' selected' : ''}>1</option>
                  <option value="2"${draft.seats === 2 ? ' selected' : ''}>2</option>
                  <option value="3"${draft.seats === 3 ? ' selected' : ''}>3</option>
                  <option value="4"${draft.seats === 4 ? ' selected' : ''}>4</option>
                  <option value="5"${draft.seats === 5 ? ' selected' : ''}>5</option>
                  <option value="6"${draft.seats === 6 ? ' selected' : ''}>6</option>
                </select>
              </label>
              <label class="field">
                <span>Home area</span>
                <select name="homeArea">${areaOptions(draft.homeArea)}</select>
              </label>
              <label class="field">
                <span>Route area</span>
                <select name="routeArea">${areaOptions(draft.routeArea)}</select>
              </label>
              <label class="field">
                <span>Fare per seat</span>
                <input type="number" name="farePerSeat" min="0.5" max="25" step="0.1" value="${draft.farePerSeat}">
              </label>
            </div>

            <label class="field">
              <span>Availability</span>
              <input type="text" name="availability" value="${escapeHtml(draft.availability)}" placeholder="Weekdays 07:00 to 09:00 and 17:00 to 19:00" required>
            </label>
            <label class="field">
              <span>Driver bio</span>
              <textarea name="bio" rows="3" placeholder="Short note about your route and reliability." required>${escapeHtml(draft.bio)}</textarea>
            </label>
            <label class="field-inline">
              <input type="checkbox" name="sharedRideEnabled" ${draft.sharedRideEnabled ? 'checked' : ''}>
              <span>Enable this car for shared ride matching</span>
            </label>
            <div class="field-grid">
              <label class="field">
                <span>Driver photo</span>
                <input type="file" name="driverPhoto" accept="image/*">
              </label>
              <label class="field">
                <span>Vehicle photo</span>
                <input type="file" name="vehiclePhoto" accept="image/*">
              </label>
            </div>
            <button type="submit" class="primary-btn">Submit driver profile</button>
          </form>

          <aside class="booking-side">
            <section class="card side-panel">
              <div class="side-head">
                <div>
                  <p class="section-kicker">My driver profiles</p>
                  <h2>${state.driverProfiles.length ? `${state.driverProfiles.length} profile${state.driverProfiles.length === 1 ? '' : 's'}` : 'No profile yet'}</h2>
                </div>
                <span class="status-pill">Manual review first</span>
              </div>
              <div class="quote-list">${mine || '<article class="helper-card"><h3>No profile submitted yet.</h3><p>Your onboarded cars will appear here after submission.</p></article>'}</div>
            </section>
            <section class="card side-panel">
              <div class="side-head">
                <div>
                  <p class="section-kicker">Review queue</p>
                  <h2>${canReviewSupply ? (state.reviewQueue.length ? `${state.reviewQueue.length} pending` : 'Nothing waiting') : 'Manual review on'}</h2>
                </div>
                <span class="status-pill">${canReviewSupply ? 'Reviewer account' : 'Protected queue'}</span>
              </div>
              <div class="quote-list">${canReviewSupply
                ? (queue || '<article class="helper-card"><h3>Queue is clear.</h3><p>Pending profiles will appear here until they are approved for matching.</p></article>')
                : '<article class="helper-card"><h3>Review is handled separately.</h3><p>Your profile remains pending until a Zygo reviewer approves it into the shared ride pool.</p></article>'}</div>
            </section>
          </aside>
        </div>
      </div>
    `;
  }

  function renderTimeline(booking) {
    return Data.BOOKING_STATES.map((entry) => `
      <li class="timeline-step${booking.history.some((item) => item.state === entry.id) || booking.state === entry.id ? ' done' : ''}">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${escapeHtml(entry.detail)}</span>
      </li>
    `).join('');
  }

  function renderTrackActions(booking) {
    if (booking.state === 'driver_en_route') {
      return `
        <div class="safety-card">
          <p class="section-kicker">Pickup verification</p>
          <h3>Start PIN: ${escapeHtml(booking.safety.startPin)}</h3>
          <p>Only share this PIN after the correct car and plate number arrive at pickup.</p>
          <button type="button" class="primary-btn" data-driver-arrived="${booking.id}">Driver reached pickup</button>
        </div>
      `;
    }

    if (booking.state === 'awaiting_start_pin') {
      return `
        <form class="safety-card" data-start-pin-form="${booking.id}">
          <p class="section-kicker">Start trip</p>
          <h3>Confirm the correct car with the start PIN.</h3>
          <p>Your PIN: ${escapeHtml(booking.safety.startPin)}</p>
          <label class="field">
            <span>Enter start PIN</span>
            <input type="text" name="pin" maxlength="6" required>
          </label>
          <button type="submit" class="primary-btn">Start trip</button>
        </form>
      `;
    }

    if (booking.state === 'on_trip') {
      return `
        <div class="safety-card">
          <p class="section-kicker">Trip in progress</p>
          <h3>End PIN: ${escapeHtml(booking.safety.endPin)}</h3>
          <p>Do not close the trip until you reach the intended destination safely.</p>
          <button type="button" class="primary-btn" data-dropoff-arrived="${booking.id}">Reached dropoff</button>
        </div>
      `;
    }

    if (booking.state === 'awaiting_end_pin') {
      return `
        <form class="safety-card" data-end-pin-form="${booking.id}">
          <p class="section-kicker">Safe arrival</p>
          <h3>Enter the end PIN to close the trip.</h3>
          <p>Your PIN: ${escapeHtml(booking.safety.endPin)}</p>
          <label class="field">
            <span>Enter end PIN</span>
            <input type="text" name="pin" maxlength="6" required>
          </label>
          <button type="submit" class="primary-btn">Complete trip</button>
        </form>
      `;
    }

    if (booking.state === 'completed') {
      return `
        <div class="safety-card">
          <p class="section-kicker">Trip complete</p>
          <h3>Arrival confirmed.</h3>
          <p>The ride closed only after the correct end PIN was entered.</p>
        </div>
      `;
    }

    return `
      <div class="safety-card alert-card">
        <p class="section-kicker">Safety alert</p>
        <h3>Trip flagged for follow-up.</h3>
        <p>${booking.safety.alerts.length ? escapeHtml(booking.safety.alerts[booking.safety.alerts.length - 1].reason) : 'A safety issue was reported.'}</p>
      </div>
    `;
  }

  function renderTrackView() {
    const booking = latestBooking();
    if (!booking) {
      return `
        <div class="page page-track">
          <section class="page-heading">
            <div>
              <p class="section-kicker">Tracking and safety</p>
              <h1>No active trip.</h1>
              <p class="lede">Booking creates the live trip state. Shared ride and dispatch bookings both use the same safety confirmation flow.</p>
            </div>
          </section>
          <article class="card helper-card">
            <h3>Start with booking.</h3>
            <p>A trip must exist before start PIN, end PIN, and safety escalation become relevant.</p>
            <a href="#/book" class="primary-btn">Book now</a>
          </article>
        </div>
      `;
    }

    const bookingCards = state.bookings.map((entry) => `
      <button type="button" class="booking-list-card${entry.id === booking.id ? ' active' : ''}" data-open-booking="${entry.id}">
        <strong>${escapeHtml(entry.driver.driverName)}</strong>
        <span>${escapeHtml(entry.pickupLabel)} to ${escapeHtml(entry.dropoffLabel)}</span>
      </button>
    `).join('');

    return `
      <div class="page page-track">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Tracking and safety</p>
            <h1>${escapeHtml(booking.driver.driverName)} / ${escapeHtml(booking.driver.plateNumber)}</h1>
            <p class="lede">${escapeHtml(booking.stateDetail)}</p>
          </div>
          <span class="status-pill">${escapeHtml(bookingStateMeta(booking).label)}</span>
        </section>

        <div class="track-layout">
          <article class="card route-card">
            <p class="section-kicker">Route summary</p>
            <h2>${escapeHtml(booking.pickupLabel)} to ${escapeHtml(booking.dropoffLabel)}</h2>
            <div class="route-grid">
              <div><dt>Service</dt><dd>${escapeHtml(booking.serviceType)}</dd></div>
              <div><dt>Fare</dt><dd>${Data.formatMoney(booking.quote.fareUsd)}</dd></div>
              <div><dt>Driver</dt><dd>${escapeHtml(booking.driver.driverName)}</dd></div>
              <div><dt>Plate</dt><dd>${escapeHtml(booking.driver.plateNumber)}</dd></div>
            </div>
            ${renderTrackActions(booking)}
            <form class="safety-card" data-safety-form="${booking.id}">
              <p class="section-kicker">Emergency support</p>
              <h3>Flag route or driver behavior immediately.</h3>
              <label class="field">
                <span>Safety reason</span>
                <textarea name="reason" rows="3" placeholder="Describe the issue or route concern." required></textarea>
              </label>
              <button type="submit" class="secondary-btn">Send safety alert</button>
            </form>
          </article>

          <aside class="booking-side">
            <section class="card timeline-card">
              <p class="section-kicker">Trip timeline</p>
              <ol class="timeline-list">${renderTimeline(booking)}</ol>
            </section>
            <section class="card side-panel">
              <div class="side-head">
                <div>
                  <p class="section-kicker">Bookings</p>
                  <h2>${state.bookings.length} on this account</h2>
                </div>
                <span class="status-pill">Latest first</span>
              </div>
              <div class="booking-list">${bookingCards}</div>
            </section>
          </aside>
        </div>
      </div>
    `;
  }

  function renderAccountView() {
    if (!state.session) {
      return `
        <div class="page page-account">
          <section class="page-heading">
            <div>
              <p class="section-kicker">Account</p>
              <h1>Sign in to store bookings and supply.</h1>
              <p class="lede">Rider history and driver profiles both hang off the same account identity.</p>
            </div>
          </section>
          <article class="card helper-card">
            <a href="#/auth?next=/account" class="primary-btn">Sign in</a>
          </article>
        </div>
      `;
    }

    return `
      <div class="page page-account">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Account</p>
            <h1>${escapeHtml(state.session.user.name)}</h1>
            <p class="lede">${escapeHtml(state.session.user.phone)} / ${escapeHtml(state.session.user.email)}</p>
          </div>
          <button type="button" class="secondary-btn" data-logout>Log out</button>
        </section>

        <div class="account-grid">
          <article class="card">
            <p class="section-kicker">Rider history</p>
            <h3>${state.bookings.length} booking${state.bookings.length === 1 ? '' : 's'}</h3>
            <div class="history-list">${state.bookings.length ? state.bookings.map((booking) => `
              <article class="history-row">
                <div>
                  <strong>${escapeHtml(booking.serviceType)}</strong>
                  <span>${escapeHtml(booking.pickupLabel)} to ${escapeHtml(booking.dropoffLabel)}</span>
                </div>
                <span>${Data.formatMoney(booking.quote.fareUsd)}</span>
              </article>`).join('') : '<p class="empty-copy">No bookings yet.</p>'}</div>
          </article>
          <article class="card">
            <p class="section-kicker">Driver supply</p>
            <h3>${state.driverProfiles.length} onboarded profile${state.driverProfiles.length === 1 ? '' : 's'}</h3>
            <p>${state.driverProfiles.filter((profile) => profile.approvalStatus === 'approved').length} approved / ${state.driverProfiles.filter((profile) => profile.approvalStatus === 'pending-review').length} pending review.</p>
            <div class="hero-chip-row">
              <a href="#/drive" class="secondary-btn">Open supply onboarding</a>
              <a href="#/track" class="secondary-btn">Open trip safety</a>
            </div>
          </article>
        </div>
      </div>
    `;
  }

  function renderAuthView(params) {
    if (state.session) {
      return `
        <div class="page page-auth">
          <section class="page-heading">
            <div>
              <p class="section-kicker">Authentication</p>
              <h1>You are already signed in.</h1>
              <p class="lede">Use your account to book, onboard as a driver, or track trip safety.</p>
            </div>
          </section>
          <article class="card helper-card"><a href="#/account" class="primary-btn">Open account</a></article>
        </div>
      `;
    }

    const next = params.get('next') || '/account';
    return `
      <div class="page page-auth">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Authentication</p>
            <h1>${state.authMode === 'signup' ? 'Create the account once.' : 'Sign in and continue.'}</h1>
            <p class="lede">Authentication now protects both sides of the marketplace: riders, shared ride drivers, and safety-confirmed trips.</p>
          </div>
        </section>

        <form class="card auth-card" id="auth-form" data-next="${escapeHtml(next)}">
          <div class="segmented-row">
            <button type="button" class="segmented-pill${state.authMode === 'signin' ? ' active' : ''}" data-auth-mode="signin">Sign in</button>
            <button type="button" class="segmented-pill${state.authMode === 'signup' ? ' active' : ''}" data-auth-mode="signup">Create account</button>
          </div>
          ${state.authMode === 'signup' ? `<label class="field"><span>Full name</span><input type="text" name="name" placeholder="Rumbidzai Moyo" required></label>` : ''}
          <label class="field"><span>Phone</span><input type="tel" name="phone" placeholder="+263 77 123 4567" required></label>
          <label class="field"><span>Email</span><input type="email" name="email" placeholder="person@example.com" ${state.authMode === 'signup' ? 'required' : ''}></label>
          <label class="field"><span>Password</span><input type="password" name="password" minlength="6" required></label>
          <button type="submit" class="primary-btn">${state.authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>
      </div>
    `;
  }

  function renderNotFoundView() {
    return `<div class="page"><article class="card helper-card"><h1>Route not found.</h1><a href="#/" class="primary-btn">Return home</a></article></div>`;
  }

  function render() {
    const route = currentRoute();
    const views = {
      '/': renderHomeView,
      '/book': renderBookView,
      '/drive': renderDriveView,
      '/track': renderTrackView,
      '/account': renderAccountView,
      '/auth': () => renderAuthView(route.params),
    };

    root.innerHTML = (views[route.path] || renderNotFoundView)();
    syncNavigation(route.path);
  }

  async function handleQuoteSubmit(form) {
    try {
      const formData = new FormData(form);
      if (!state.bookingDraft.pickup) {
        notify('Choose the pickup from suggestions first.');
        focusLocationField('pickup');
        return;
      }
      if (!state.bookingDraft.dropoff) {
        notify('Choose the dropoff from suggestions first.');
        focusLocationField('dropoff');
        return;
      }

      const nextDraft = {
        ...state.bookingDraft,
        pickup: state.bookingDraft.pickup,
        pickupText: Data.getAreaLabel(state.bookingDraft.pickup),
        dropoff: state.bookingDraft.dropoff,
        dropoffText: Data.getAreaLabel(state.bookingDraft.dropoff),
        schedule: String(formData.get('schedule')),
        paymentMethod: state.bookingDraft.paymentMethod,
        passengers: Number(formData.get('passengers')),
        loadLevel: String(formData.get('loadLevel') || state.bookingDraft.loadLevel),
        hireHours: Number(formData.get('hireHours') || state.bookingDraft.hireHours),
        notes: String(formData.get('notes') || ''),
      };
      const payload = await Data.requestQuotes(state.apiBase, nextDraft);
      const first = payload.quotes[0] || null;
      commit({
        ...state,
        bookingDraft: nextDraft,
        quotes: payload.quotes,
        selectedChoice: first ? { selectionType: first.selectionType, selectionId: first.selectionId } : null,
      });
      notify('Options loaded.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function handleAuthSubmit(form) {
    try {
      const formData = Object.fromEntries(new FormData(form).entries());
      const next = form.dataset.next || '/account';
      const payload = state.authMode === 'signup'
        ? await Data.registerUser(state.apiBase, formData)
        : await Data.loginUser(state.apiBase, formData);
      commit({
        ...state,
        session: { token: payload.token, user: payload.user },
      });
      await refreshCollections();
      notify('Signed in.');
      navigate(next);
    } catch (error) {
      notify(error.message);
    }
  }

  async function handleDriverSubmit(form) {
    try {
      const formData = new FormData(form);
      const driverPhoto = await readFileAsDataUrl(formData.get('driverPhoto'));
      const vehiclePhoto = await readFileAsDataUrl(formData.get('vehiclePhoto'));
      const payload = {
        driverName: String(formData.get('driverName')),
        driverPhone: String(formData.get('driverPhone')),
        bio: String(formData.get('bio')),
        vehicleType: String(formData.get('vehicleType')),
        vehicleLabel: String(formData.get('vehicleLabel')),
        plateNumber: String(formData.get('plateNumber')),
        seats: Number(formData.get('seats')),
        homeArea: String(formData.get('homeArea')),
        routeArea: String(formData.get('routeArea')),
        availability: String(formData.get('availability')),
        farePerSeat: Number(formData.get('farePerSeat')),
        sharedRideEnabled: formData.get('sharedRideEnabled') === 'on',
        driverPhotoData: driverPhoto,
        vehiclePhotoData: vehiclePhoto,
      };

      await Data.submitDriverProfile(state.apiBase, state.session, payload);
      commit({
        ...state,
        driverDraft: Data.defaultDriverDraft(),
      });
      await refreshCollections();
      notify('Driver profile submitted for review.');
    } catch (error) {
      notify(error.message);
    }
  }

  async function handleConfirmBooking() {
    const quote = selectedQuote();
    if (!quote) {
      notify('Choose an option first.');
      return;
    }
    if (!state.session) {
      navigate('/auth?next=/book');
      return;
    }

    try {
      const payload = await Data.createBooking(state.apiBase, state.session, {
        request: state.bookingDraft,
        selectionType: quote.selectionType,
        selectionId: quote.selectionId,
      });
      commit({
        ...state,
        activeBookingId: payload.booking.id,
      });
      await refreshCollections();
      notify('Booking created.');
      navigate('/track');
    } catch (error) {
      notify(error.message);
    }
  }

  async function updateBooking(action) {
    const booking = latestBooking();
    if (!booking || !state.session) return;
    try {
      const payload = await action(booking.id);
      commit({
        ...state,
        bookings: state.bookings.map((entry) => (entry.id === payload.booking.id ? payload.booking : entry)),
        activeBookingId: payload.booking.id,
      });
      notify(payload.booking.stateDetail);
    } catch (error) {
      notify(error.message);
    }
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const homeIntentTrigger = target.closest('[data-home-intent]');
    if (homeIntentTrigger instanceof HTMLElement) {
      const intent = homeIntentTrigger.dataset.homeIntent;
      commit({
        ...state,
        bookingDraft: {
          ...state.bookingDraft,
          intent,
          paymentMethod: intent === 'hire-vehicle' ? 'transfer' : 'ecocash',
        },
        quotes: [],
        selectedChoice: null,
      });
      return;
    }

    const routePresetTrigger = target.closest('[data-route-preset]');
    if (routePresetTrigger instanceof HTMLElement) {
      const [pickup, dropoff, intent] = String(routePresetTrigger.dataset.routePreset || '').split('|');
      commit({
        ...state,
        bookingDraft: {
          ...state.bookingDraft,
          intent: intent || state.bookingDraft.intent,
          pickup: pickup || state.bookingDraft.pickup,
          pickupText: Data.getAreaLabel(pickup || state.bookingDraft.pickup),
          dropoff: dropoff || state.bookingDraft.dropoff,
          dropoffText: Data.getAreaLabel(dropoff || state.bookingDraft.dropoff),
          paymentMethod: intent === 'hire-vehicle' ? 'transfer' : 'ecocash',
        },
        quotes: [],
        selectedChoice: null,
      });
      return;
    }

    if (target.closest('[data-open-booking-flow]')) {
      navigate('/book');
      return;
    }

    if (target.closest('[data-home-swap-route]')) {
      commit({
        ...state,
        bookingDraft: {
          ...state.bookingDraft,
          pickup: state.bookingDraft.dropoff,
          pickupText: state.bookingDraft.dropoffText,
          dropoff: state.bookingDraft.pickup,
          dropoffText: state.bookingDraft.pickupText,
        },
        quotes: [],
        selectedChoice: null,
      });
      return;
    }

    const locationOption = target.closest('[data-location-option]');
    if (locationOption instanceof HTMLElement) {
      chooseSuggestedArea(locationOption.dataset.locationOption, locationOption.dataset.areaId);
      return;
    }

    if (target.closest('[data-swap-route]')) {
      commit({
        ...state,
        bookingDraft: {
          ...state.bookingDraft,
          pickup: state.bookingDraft.dropoff,
          pickupText: state.bookingDraft.dropoffText,
          dropoff: state.bookingDraft.pickup,
          dropoffText: state.bookingDraft.pickupText,
        },
        quotes: [],
        selectedChoice: null,
      });
      window.requestAnimationFrame(syncLocationFields);
      return;
    }

    const intentTrigger = target.closest('[data-intent]');
    if (intentTrigger instanceof HTMLElement) {
      commit({
        ...state,
        bookingDraft: {
          ...state.bookingDraft,
          intent: intentTrigger.dataset.intent,
          paymentMethod: intentTrigger.dataset.intent === 'hire-vehicle' ? 'transfer' : 'ecocash',
        },
        quotes: [],
        selectedChoice: null,
      });
      return;
    }

    const paymentTrigger = target.closest('[data-payment]');
    if (paymentTrigger instanceof HTMLElement) {
      commit({
        ...state,
        bookingDraft: {
          ...state.bookingDraft,
          paymentMethod: paymentTrigger.dataset.payment,
        },
      });
      return;
    }

    const choiceTrigger = target.closest('[data-select-choice]');
    if (choiceTrigger instanceof HTMLElement) {
      const [selectionType, selectionId] = String(choiceTrigger.dataset.selectChoice).split(':');
      commit({
        ...state,
        selectedChoice: { selectionType, selectionId },
      });
      return;
    }

    const authModeTrigger = target.closest('[data-auth-mode]');
    if (authModeTrigger instanceof HTMLElement) {
      commit({ ...state, authMode: authModeTrigger.dataset.authMode });
      return;
    }

    const approveTrigger = target.closest('[data-approve-profile]');
    if (approveTrigger instanceof HTMLElement) {
      Data.approveDriverProfile(state.apiBase, state.session, approveTrigger.dataset.approveProfile)
        .then(async () => {
          await refreshCollections();
          notify('Driver profile approved for matching.');
        })
        .catch((error) => notify(error.message));
      return;
    }

    const openBookingTrigger = target.closest('[data-open-booking]');
    if (openBookingTrigger instanceof HTMLElement) {
      commit({ ...state, activeBookingId: openBookingTrigger.dataset.openBooking });
      return;
    }

    if (target.closest('[data-confirm-booking]')) {
      handleConfirmBooking();
      return;
    }

    const driverArrivedTrigger = target.closest('[data-driver-arrived]');
    if (driverArrivedTrigger instanceof HTMLElement) {
      updateBooking((bookingId) => Data.markDriverArrived(state.apiBase, state.session, bookingId));
      return;
    }

    const dropoffTrigger = target.closest('[data-dropoff-arrived]');
    if (dropoffTrigger instanceof HTMLElement) {
      updateBooking((bookingId) => Data.markDropoffArrived(state.apiBase, state.session, bookingId));
      return;
    }

    if (target.closest('[data-logout]')) {
      commit({ ...state, session: null, bookings: [], driverProfiles: [], reviewQueue: [], activeBookingId: null });
      notify('Session cleared.');
      navigate('/');
      return;
    }

    if (!target.closest('[data-location-field]')) {
      closeLocationFields();
    }
  });

  document.addEventListener('focusin', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const locationField = target.closest('[data-location-field]');
    if (locationField instanceof HTMLElement) {
      openLocationField(locationField.dataset.locationField);
      return;
    }

    closeLocationFields();
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (!target.dataset.locationInput) return;

    const fieldName = target.dataset.locationInput;
    const exactMatch = Data.findAreaMatch(target.value);
    silentlyUpdateBookingDraft({
      [fieldName]: exactMatch ? exactMatch.id : '',
      [locationTextKey(fieldName)]: target.value,
    });
    openLocationField(fieldName);
    syncLocationFields();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closeLocationFields();
  });

  document.addEventListener('submit', (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    event.preventDefault();

    if (form.id === 'quote-form') {
      handleQuoteSubmit(form);
      return;
    }

    if (form.id === 'auth-form') {
      handleAuthSubmit(form);
      return;
    }

    if (form.id === 'driver-form') {
      handleDriverSubmit(form);
      return;
    }

    if (form.dataset.startPinForm) {
      const pin = String(new FormData(form).get('pin') || '');
      updateBooking((bookingId) => Data.confirmTripStart(state.apiBase, state.session, bookingId, pin));
      return;
    }

    if (form.dataset.endPinForm) {
      const pin = String(new FormData(form).get('pin') || '');
      updateBooking((bookingId) => Data.confirmTripCompletion(state.apiBase, state.session, bookingId, pin));
      return;
    }

    if (form.dataset.safetyForm) {
      const reason = String(new FormData(form).get('reason') || '');
      updateBooking((bookingId) => Data.raiseSafetyAlert(state.apiBase, state.session, bookingId, reason));
    }
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('scroll', () => syncNavigation(currentRoute().path), { passive: true });

  if (!window.location.hash) {
    window.location.hash = '#/';
  }
  render();
  refreshCollections();
}());
