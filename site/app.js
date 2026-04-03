'use strict';

(function initZygoApp() {
  const root = document.getElementById('app-root');
  const toast = document.getElementById('toast');
  const header = document.getElementById('shell-header');
  const Data = window.ZygoData;

  if (!root || !toast || !header || !Data) return;

  let state = Data.loadState();

  const areaOptions = () => Data.AREAS.map((area) => `<option value="${area.id}">${area.label}</option>`).join('');
  const paymentOptions = () => Data.PAYMENT_METHODS.map((method) => `<button type="button" class="segmented-pill${state.draft.paymentMethod === method.id ? ' active' : ''}" data-payment="${method.id}">${method.label}</button>`).join('');

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function persist() {
    Data.saveState(state);
  }

  function setState(next) {
    state = next;
    persist();
    render();
  }

  function currentRoute() {
    const hash = window.location.hash.slice(1) || '/';
    const [path, queryString] = hash.split('?');
    return {
      path: path || '/',
      params: new URLSearchParams(queryString || ''),
    };
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
      toast.classList.remove('visible');
      toast.hidden = true;
    }, 2600);
  }

  function syncNavigation(path) {
    header.classList.toggle('scrolled', window.scrollY > 12);
    document.querySelectorAll('.primary-nav a, .mobile-nav a').forEach((link) => {
      const href = link.getAttribute('href') || '';
      const target = href.replace(/^#/, '') || '/';
      const active = target === path;
      link.classList.toggle('active', active);
      if (active) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function latestBooking() {
    if (!state.bookings.length) return null;
    if (state.activeBookingId) {
      return state.bookings.find((booking) => booking.id === state.activeBookingId) || state.bookings[state.bookings.length - 1];
    }
    return state.bookings[state.bookings.length - 1];
  }

  function renderHomeView() {
    const booking = latestBooking();
    const bookingCard = booking
      ? `
        <article class="home-status card">
          <p class="section-kicker">Active booking</p>
          <h3>${escapeHtml(booking.quote.vehicleName)} to ${escapeHtml(booking.dropoffLabel)}</h3>
          <p>${escapeHtml(booking.driver.name)} is assigned. Current status: ${escapeHtml(Data.STATUS_STAGES[booking.statusIndex].label)}.</p>
          <a href="#/track" class="inline-link">Open tracking</a>
        </article>
      `
      : `
        <article class="home-status card">
          <p class="section-kicker">Ready to move</p>
          <h3>No active booking yet.</h3>
          <p>Start with the task, then Zygo narrows the right vehicle and payment path.</p>
          <a href="#/book" class="inline-link">Open booking flow</a>
        </article>
      `;

    return `
      <div class="page page-home">
        <section class="hero-panel">
          <div class="hero-copy">
            <p class="section-kicker">Harare-first mobility and haulage</p>
            <h1>One flow for city rides, goods movement, and vehicle hire.</h1>
            <p class="lede">Zygo reduces the real decision bottleneck: matching the task to the right vehicle, payment method, and dispatch window before the user commits.</p>
            <div class="hero-chip-row">
              <span class="hero-chip">Taxi to truck</span>
              <span class="hero-chip">EcoCash visible</span>
              <span class="hero-chip">Mobile and web</span>
            </div>
            <a href="#/book" class="primary-btn">Start booking</a>
          </div>

          <div class="hero-workbench card">
            <div class="workbench-head">
              <div>
                <p class="section-kicker">Product logic</p>
                <h2>Choose the task before the vehicle.</h2>
              </div>
              <span class="status-pill">Harare live prototype</span>
            </div>
            <div class="workbench-grid">
              <article>
                <h3>Move me</h3>
                <p>Fast city rides for market runs, pickups, and daily travel.</p>
              </article>
              <article>
                <h3>Move goods</h3>
                <p>Stock movement with the right cargo fit shown before checkout.</p>
              </article>
              <article>
                <h3>Hire a vehicle</h3>
                <p>Planned trips for longer tasks, repeated stops, or extended use.</p>
              </article>
            </div>
          </div>
        </section>

        <section class="home-grid">
          <article class="card">
            <p class="section-kicker">Clarity</p>
            <h3>The booking path follows user intent.</h3>
            <p>Task selection comes first, so the product never forces the user to decode a large fleet menu before seeing a fit.</p>
          </article>
          <article class="card">
            <p class="section-kicker">Trust</p>
            <h3>Payment cues appear early.</h3>
            <p>EcoCash, cash, card, and transfer support are visible before the booking is confirmed.</p>
          </article>
          ${bookingCard}
        </section>

        <section class="home-foot card">
          <div>
            <p class="section-kicker">System view</p>
            <h2>What this prototype includes now</h2>
          </div>
          <div class="check-grid">
            <span>Booking form with quote generation</span>
            <span>Tracking screen with trip progression</span>
            <span>Account and auth flow</span>
            <span>FastAPI scaffold for quotes and bookings</span>
          </div>
        </section>
      </div>
    `;
  }

  function renderQuoteCards() {
    if (!state.quotes.length) {
      return `
        <article class="helper-card">
          <h3>No quotes yet.</h3>
          <p>Set the task, route, and payment method, then Zygo will price the vehicles that fit.</p>
        </article>
      `;
    }

    return state.quotes.map((quote) => `
      <article class="quote-card${state.selectedVehicleId === quote.vehicleId ? ' selected' : ''}">
        <div class="quote-head">
          <div>
            <p class="section-kicker">${escapeHtml(quote.vehicleName)}</p>
            <h3>${Data.formatMoney(quote.fareUsd)}</h3>
          </div>
          <span class="quote-meta">${quote.etaMinutes} min</span>
        </div>
        <p>${escapeHtml(quote.fitReason)}</p>
        <div class="quote-meta-row">
          <span>${quote.distanceKm} km</span>
          <span>${quote.paymentLabels.join(' / ')}</span>
        </div>
        <button type="button" class="secondary-btn" data-select-quote="${quote.vehicleId}">${state.selectedVehicleId === quote.vehicleId ? 'Selected' : 'Choose this vehicle'}</button>
      </article>
    `).join('');
  }

  function renderReviewCard() {
    const selected = state.quotes.find((quote) => quote.vehicleId === state.selectedVehicleId);
    if (!selected) return '';

    const authPrompt = state.session
      ? `<button type="button" class="primary-btn" data-confirm-booking>Confirm booking</button>`
      : `<a href="#/auth?next=/book" class="primary-btn">Sign in to confirm</a>`;

    return `
      <article class="review-card card">
        <div class="review-head">
          <div>
            <p class="section-kicker">Review</p>
            <h3>${escapeHtml(selected.vehicleName)} from ${escapeHtml(Data.getAreaLabel(state.draft.pickup))} to ${escapeHtml(Data.getAreaLabel(state.draft.dropoff))}</h3>
          </div>
          <span class="status-pill">${Data.formatMoney(selected.fareUsd)}</span>
        </div>
        <dl class="review-grid">
          <div><dt>Task</dt><dd>${escapeHtml(state.draft.intent.replace('-', ' '))}</dd></div>
          <div><dt>Payment</dt><dd>${escapeHtml(state.draft.paymentMethod)}</dd></div>
          <div><dt>Window</dt><dd>${selected.etaMinutes} min</dd></div>
          <div><dt>Distance</dt><dd>${selected.distanceKm} km</dd></div>
        </dl>
        <p class="review-copy">${escapeHtml(selected.fitReason)}</p>
        ${authPrompt}
      </article>
    `;
  }

  function renderBookView() {
    const draft = state.draft;
    const showLoad = draft.intent !== 'move-me';
    const showHire = draft.intent === 'hire-vehicle';

    return `
      <div class="page page-book">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Booking flow</p>
            <h1>Build the trip before the quote.</h1>
            <p class="lede">Set the task, route, and payment method. Zygo then narrows the vehicles that can actually carry the job.</p>
          </div>
        </section>

        <div class="booking-layout">
          <form class="card form-card" id="quote-form">
            <div class="field-block">
              <label class="field-label">Transport task</label>
              <div class="segmented-row">
                <button type="button" class="segmented-pill${draft.intent === 'move-me' ? ' active' : ''}" data-intent="move-me">Move me</button>
                <button type="button" class="segmented-pill${draft.intent === 'move-goods' ? ' active' : ''}" data-intent="move-goods">Move goods</button>
                <button type="button" class="segmented-pill${draft.intent === 'hire-vehicle' ? ' active' : ''}" data-intent="hire-vehicle">Hire a vehicle</button>
              </div>
            </div>

            <div class="field-grid">
              <label class="field">
                <span>Pickup area</span>
                <select name="pickup">${areaOptions()}</select>
              </label>
              <label class="field">
                <span>Dropoff area</span>
                <select name="dropoff">${areaOptions()}</select>
              </label>
              <label class="field">
                <span>Schedule</span>
                <select name="schedule">
                  <option value="now">As soon as possible</option>
                  <option value="today">Later today</option>
                  <option value="later">Scheduled</option>
                </select>
              </label>
              <label class="field">
                <span>Passengers</span>
                <select name="passengers" ${showLoad ? 'disabled' : ''}>
                  <option value="1">1 rider</option>
                  <option value="2">2 riders</option>
                  <option value="3">3 riders</option>
                  <option value="4">4 riders</option>
                </select>
              </label>
              <label class="field ${showLoad ? '' : 'is-muted'}">
                <span>Load level</span>
                <select name="loadLevel" ${showLoad ? '' : 'disabled'}>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="heavy">Heavy</option>
                  <option value="bulk">Bulk</option>
                </select>
              </label>
              <label class="field ${showHire ? '' : 'is-muted'}">
                <span>Hire hours</span>
                <select name="hireHours" ${showHire ? '' : 'disabled'}>
                  <option value="2">2 hours</option>
                  <option value="4">4 hours</option>
                  <option value="8">8 hours</option>
                </select>
              </label>
            </div>

            <div class="field-block">
              <label class="field-label">Payment method</label>
              <div class="segmented-row">${paymentOptions()}</div>
            </div>

            <label class="field field-full">
              <span>Notes for the driver</span>
              <textarea name="notes" rows="3" placeholder="Stock size, pickup landmark, or route note">${escapeHtml(draft.notes)}</textarea>
            </label>

            <button type="submit" class="primary-btn">Get quotes</button>
          </form>

          <aside class="booking-side">
            <section class="card side-panel">
              <div class="side-head">
                <div>
                  <p class="section-kicker">Vehicle options</p>
                  <h2>${state.quotes.length ? `${state.quotes.length} fit this task` : 'Waiting for a quote request'}</h2>
                </div>
                <span class="status-pill">EcoCash ready</span>
              </div>
              <div class="quote-list">${renderQuoteCards()}</div>
            </section>
            ${renderReviewCard()}
          </aside>
        </div>
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
              <p class="section-kicker">Tracking</p>
              <h1>No live route yet.</h1>
              <p class="lede">A route appears here after a booking is confirmed.</p>
            </div>
          </section>
          <article class="card helper-card">
            <h3>Start from the booking flow.</h3>
            <p>Quotes and tracking become meaningful only after the route, task, and payment method are defined.</p>
            <a href="#/book" class="primary-btn">Start booking</a>
          </article>
        </div>
      `;
    }

    const stage = Data.STATUS_STAGES[booking.statusIndex];
    const timeline = Data.STATUS_STAGES.map((entry, index) => `
      <li class="timeline-step${index <= booking.statusIndex ? ' done' : ''}">
        <strong>${escapeHtml(entry.label)}</strong>
        <span>${escapeHtml(entry.detail)}</span>
      </li>
    `).join('');

    return `
      <div class="page page-track">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Tracking</p>
            <h1>${escapeHtml(booking.quote.vehicleName)} to ${escapeHtml(booking.dropoffLabel)}</h1>
            <p class="lede">${escapeHtml(stage.detail)}</p>
          </div>
          <span class="status-pill">${escapeHtml(stage.label)}</span>
        </section>

        <div class="track-layout">
          <article class="card route-card">
            <p class="section-kicker">Route summary</p>
            <h2>${escapeHtml(booking.pickupLabel)} to ${escapeHtml(booking.dropoffLabel)}</h2>
            <div class="route-grid">
              <div><dt>Driver</dt><dd>${escapeHtml(booking.driver.name)}</dd></div>
              <div><dt>Vehicle</dt><dd>${escapeHtml(booking.quote.vehicleName)} / ${escapeHtml(booking.driver.plate)}</dd></div>
              <div><dt>Payment</dt><dd>${escapeHtml(booking.paymentMethod)}</dd></div>
              <div><dt>Fare</dt><dd>${Data.formatMoney(booking.quote.fareUsd)}</dd></div>
            </div>
            <div class="route-actions">
              <a href="#/account" class="secondary-btn">Open account</a>
              ${booking.statusIndex < Data.STATUS_STAGES.length - 1 ? '<button type="button" class="primary-btn" data-advance-booking>Advance trip status</button>' : '<a href="#/book" class="primary-btn">Book another route</a>'}
            </div>
          </article>

          <article class="card timeline-card">
            <p class="section-kicker">Progress</p>
            <ol class="timeline-list">${timeline}</ol>
          </article>
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
              <h1>Sign in to save routes and payments.</h1>
              <p class="lede">Account state matters once the booking starts compounding across repeat trips.</p>
            </div>
          </section>
          <article class="card helper-card">
            <h3>No signed-in user.</h3>
            <p>Create an account to store recent bookings, payment habits, and dispatch history.</p>
            <a href="#/auth?next=/account" class="primary-btn">Sign in</a>
          </article>
        </div>
      `;
    }

    const bookings = state.bookings.length
      ? state.bookings.slice().reverse().map((booking) => `
        <article class="history-row">
          <div>
            <strong>${escapeHtml(booking.quote.vehicleName)}</strong>
            <span>${escapeHtml(booking.pickupLabel)} to ${escapeHtml(booking.dropoffLabel)}</span>
          </div>
          <span>${Data.formatMoney(booking.quote.fareUsd)}</span>
        </article>
      `).join('')
      : '<p class="empty-copy">No past bookings yet.</p>';

    return `
      <div class="page page-account">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Account</p>
            <h1>${escapeHtml(state.session.user.name)}</h1>
            <p class="lede">${escapeHtml(state.session.user.phone)}${state.session.user.email ? ` / ${escapeHtml(state.session.user.email)}` : ''}</p>
          </div>
          <button type="button" class="secondary-btn" data-logout>Log out</button>
        </section>

        <div class="account-grid">
          <article class="card">
            <p class="section-kicker">Preferred payments</p>
            <div class="check-grid">
              ${Data.PAYMENT_METHODS.map((method) => `<span>${escapeHtml(method.label)} / ${escapeHtml(method.note)}</span>`).join('')}
            </div>
          </article>
          <article class="card">
            <p class="section-kicker">Recent bookings</p>
            <div class="history-list">${bookings}</div>
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
              <p class="lede">Open the account page or continue back to booking.</p>
            </div>
          </section>
          <article class="card helper-card">
            <a href="#/account" class="primary-btn">Open account</a>
          </article>
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
            <p class="lede">Auth gates the booking confirmation so payment state and route history can persist cleanly.</p>
          </div>
        </section>

        <form class="card auth-card" id="auth-form" data-next="${escapeHtml(next)}">
          <div class="segmented-row">
            <button type="button" class="segmented-pill${state.authMode === 'signin' ? ' active' : ''}" data-auth-mode="signin">Sign in</button>
            <button type="button" class="segmented-pill${state.authMode === 'signup' ? ' active' : ''}" data-auth-mode="signup">Create account</button>
          </div>

          ${state.authMode === 'signup' ? `
            <label class="field">
              <span>Full name</span>
              <input type="text" name="name" placeholder="Rumbidzai Moyo" required>
            </label>
          ` : ''}
          <label class="field">
            <span>Phone</span>
            <input type="tel" name="phone" placeholder="+263 77 123 4567" required>
          </label>
          <label class="field">
            <span>Email</span>
            <input type="email" name="email" placeholder="optional@example.com" ${state.authMode === 'signup' ? 'required' : ''}>
          </label>
          <label class="field">
            <span>Password</span>
            <input type="password" name="password" placeholder="At least 6 characters" minlength="6" required>
          </label>

          <button type="submit" class="primary-btn">${state.authMode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>
      </div>
    `;
  }

  function renderNotFoundView() {
    return `
      <div class="page">
        <article class="card helper-card">
          <h1>Route not found.</h1>
          <p>The requested screen does not exist in this prototype.</p>
          <a href="#/" class="primary-btn">Return home</a>
        </article>
      </div>
    `;
  }

  function applyDraftValues() {
    const form = document.getElementById('quote-form');
    if (!form) return;

    form.elements.pickup.value = state.draft.pickup;
    form.elements.dropoff.value = state.draft.dropoff;
    form.elements.schedule.value = state.draft.schedule;
    form.elements.passengers.value = String(state.draft.passengers);
    form.elements.loadLevel.value = state.draft.loadLevel;
    form.elements.hireHours.value = String(state.draft.hireHours);
  }

  function render() {
    const route = currentRoute();
    const views = {
      '/': renderHomeView,
      '/book': renderBookView,
      '/track': renderTrackView,
      '/account': renderAccountView,
      '/auth': () => renderAuthView(route.params),
    };

    root.innerHTML = (views[route.path] || renderNotFoundView)();
    syncNavigation(route.path);
    applyDraftValues();
  }

  async function handleQuoteSubmit(form) {
    const formData = new FormData(form);
    const draft = {
      ...state.draft,
      pickup: formData.get('pickup'),
      dropoff: formData.get('dropoff'),
      schedule: formData.get('schedule'),
      passengers: Number(formData.get('passengers') || state.draft.passengers),
      loadLevel: formData.get('loadLevel') || state.draft.loadLevel,
      hireHours: Number(formData.get('hireHours') || state.draft.hireHours),
      notes: formData.get('notes') || '',
    };

    const result = await Data.requestQuotes(state.apiBase, draft);
    setState({
      ...state,
      draft,
      quotes: result.quotes,
      selectedVehicleId: result.quotes.length ? result.quotes[0].vehicleId : null,
    });
    notify(result.source === 'local' ? 'Quotes generated from local prototype logic.' : 'Quotes loaded from the API.');
  }

  async function handleAuthSubmit(form) {
    const route = currentRoute();
    const next = form.dataset.next || route.params.get('next') || '/account';
    const payload = Object.fromEntries(new FormData(form).entries());
    let result;

    if (state.authMode === 'signup') {
      result = await Data.registerUser(state.apiBase, payload);
    } else {
      result = await Data.loginUser(state.apiBase, payload, state.session ? state.session.user : null);
    }

    setState({
      ...state,
      session: {
        token: result.token,
        user: result.user,
      },
    });

    notify(result.source === 'local' ? 'Signed in with the local prototype session.' : 'Signed in with the API.');
    navigate(next);
  }

  async function handleConfirmBooking() {
    if (!state.selectedVehicleId) {
      notify('Choose a vehicle first.');
      return;
    }

    if (!state.session) {
      navigate('/auth?next=/book');
      return;
    }

    const result = await Data.createBooking(state.apiBase, {
      request: state.draft,
      vehicleId: state.selectedVehicleId,
    }, state.session);

    const booking = result.booking || result;
    setState({
      ...state,
      bookings: [...state.bookings, booking],
      activeBookingId: booking.id,
    });
    notify(result.source === 'local' ? 'Booking stored in local prototype state.' : 'Booking created through the API.');
    navigate('/track');
  }

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const routeTrigger = target.closest('[data-route]');
    if (routeTrigger instanceof HTMLElement) {
      navigate(routeTrigger.dataset.route);
      return;
    }

    const intentTrigger = target.closest('[data-intent]');
    if (intentTrigger instanceof HTMLElement) {
      setState({
        ...state,
        draft: {
          ...state.draft,
          intent: intentTrigger.dataset.intent,
        },
        quotes: [],
        selectedVehicleId: null,
      });
      return;
    }

    const paymentTrigger = target.closest('[data-payment]');
    if (paymentTrigger instanceof HTMLElement) {
      setState({
        ...state,
        draft: {
          ...state.draft,
          paymentMethod: paymentTrigger.dataset.payment,
        },
      });
      return;
    }

    const quoteTrigger = target.closest('[data-select-quote]');
    if (quoteTrigger instanceof HTMLElement) {
      setState({
        ...state,
        selectedVehicleId: quoteTrigger.dataset.selectQuote,
      });
      return;
    }

    const authModeTrigger = target.closest('[data-auth-mode]');
    if (authModeTrigger instanceof HTMLElement) {
      setState({
        ...state,
        authMode: authModeTrigger.dataset.authMode,
      });
      return;
    }

    if (target.closest('[data-confirm-booking]')) {
      handleConfirmBooking();
      return;
    }

    if (target.closest('[data-advance-booking]')) {
      const booking = latestBooking();
      if (!booking) return;

      const updated = state.bookings.map((entry) => (
        entry.id === booking.id
          ? { ...entry, statusIndex: Math.min(entry.statusIndex + 1, Data.STATUS_STAGES.length - 1) }
          : entry
      ));

      setState({
        ...state,
        bookings: updated,
      });
      return;
    }

    if (target.closest('[data-logout]')) {
      setState({
        ...state,
        session: null,
      });
      notify('Session cleared.');
    }
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
    }
  });

  window.addEventListener('hashchange', render);
  window.addEventListener('scroll', () => syncNavigation(currentRoute().path), { passive: true });

  if (!window.location.hash) {
    window.location.hash = '#/';
  }
  render();
}());
