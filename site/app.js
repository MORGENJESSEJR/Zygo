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

  function renderHomeView() {
    const active = latestBooking();
    const supplyCount = state.driverProfiles.length;
    const activeCard = active
      ? `
        <article class="card">
          <p class="section-kicker">Active trip</p>
          <h3>${escapeHtml(active.driver.driverName)} to ${escapeHtml(active.dropoffLabel)}</h3>
          <p>${escapeHtml(active.stateDetail)}</p>
          <a href="#/track" class="inline-link">Open trip safety panel</a>
        </article>
      `
      : `
        <article class="card">
          <p class="section-kicker">Active trip</p>
          <h3>No trip in motion.</h3>
          <p>Book a dispatch ride, shared ride, goods move, or vehicle hire from one place.</p>
          <a href="#/book" class="inline-link">Start booking</a>
        </article>
      `;

    return `
      <div class="page page-home">
        <section class="hero-panel">
          <div class="hero-copy">
            <p class="section-kicker">Mobility, shared rides, and haulage</p>
            <h1>Book rides. Offer seats. Confirm safe arrival.</h1>
            <p class="lede">Zygo now works as a two-sided marketplace: riders can book dispatch trips or shared rides, while private drivers can onboard their own cars, upload vehicle proof, and enter the review queue.</p>
            <div class="hero-chip-row">
              <span class="hero-chip">Shared ride mode</span>
              <span class="hero-chip">Driver and car onboarding</span>
              <span class="hero-chip">Start PIN and end PIN</span>
            </div>
            <div class="hero-chip-row">
              <a href="#/book" class="primary-btn">Book a trip</a>
              <a href="#/drive" class="secondary-btn">Drive with Zygo</a>
            </div>
          </div>

          <div class="hero-workbench card">
            <div class="workbench-head">
              <div>
                <p class="section-kicker">Safety logic</p>
                <h2>Trust is enforced in the trip flow.</h2>
              </div>
              <span class="status-pill">Live on Railway</span>
            </div>
            <div class="workbench-grid">
              <article>
                <h3>1. Driver reaches pickup</h3>
                <p>The rider does not begin the trip until the correct car is present.</p>
              </article>
              <article>
                <h3>2. Start PIN unlocks trip</h3>
                <p>The rider confirms the right driver before movement begins.</p>
              </article>
              <article>
                <h3>3. End PIN closes trip</h3>
                <p>The ride stays open until the rider confirms safe arrival.</p>
              </article>
            </div>
          </div>
        </section>

        <section class="home-grid">
          <article class="card">
            <p class="section-kicker">Shared ride</p>
            <h3>Private car seats can be offered on known routes.</h3>
            <p>Approved drivers publish commute corridors and fare-per-seat so riders can match onto a verified seat instead of ordering a full private trip.</p>
          </article>
          <article class="card">
            <p class="section-kicker">Supply</p>
            <h3>${supplyCount} driver profile${supplyCount === 1 ? '' : 's'} linked to this account.</h3>
            <p>Each profile stores driver identity, plate number, route corridor, and both driver and vehicle images.</p>
          </article>
          ${activeCard}
        </section>

        <section class="home-foot card">
          <div>
            <p class="section-kicker">System depth</p>
            <h2>What this build now includes</h2>
          </div>
          <div class="check-grid">
            <span>Dispatch rides, goods, and hire flows</span>
            <span>Shared ride matching with approved drivers</span>
            <span>Driver and vehicle onboarding with images</span>
            <span>Trip safety alerts plus PIN confirmation</span>
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
          <span>${escapeHtml(preview.plateNumber || '')}${preview.seats ? ` / ${preview.seats} seats` : ''}</span>
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
          <div class="quote-head">
            <div>
              <p class="section-kicker">${escapeHtml(quote.vehicleName)}</p>
              <h3>${Data.formatMoney(quote.fareUsd)}</h3>
            </div>
            <span class="quote-meta">${quote.etaMinutes} min</span>
          </div>
          ${renderDriverPreview(quote)}
          <p>${escapeHtml(quote.fitReason)}</p>
          <div class="quote-meta-row">
            <span>${quote.distanceKm} km</span>
            <span>${quote.paymentLabels.join(' / ')}</span>
          </div>
          <button type="button" class="secondary-btn" data-select-choice="${quote.selectionType}:${quote.selectionId}">${chosen ? 'Selected' : 'Choose this option'}</button>
        </article>
      `;
    }).join('');
  }

  function renderReviewCard() {
    const quote = selectedQuote();
    if (!quote) return '';

    return `
      <article class="review-card card">
        <div class="review-head">
          <div>
            <p class="section-kicker">Review</p>
            <h3>${escapeHtml(quote.vehicleName)} from ${escapeHtml(Data.getAreaLabel(state.bookingDraft.pickup))} to ${escapeHtml(Data.getAreaLabel(state.bookingDraft.dropoff))}</h3>
          </div>
          <span class="status-pill">${Data.formatMoney(quote.fareUsd)}</span>
        </div>
        <dl class="review-grid">
          <div><dt>Task</dt><dd>${escapeHtml(intentLabel(state.bookingDraft.intent))}</dd></div>
          <div><dt>Payment</dt><dd>${escapeHtml(paymentLabel(state.bookingDraft.paymentMethod))}</dd></div>
          <div><dt>Passengers</dt><dd>${state.bookingDraft.passengers}</dd></div>
          <div><dt>ETA</dt><dd>${quote.etaMinutes} min</dd></div>
        </dl>
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

    return `
      <div class="page page-book">
        <section class="page-heading">
          <div>
            <p class="section-kicker">Booking flow</p>
            <h1>Match the route to the right supply.</h1>
            <p class="lede">Dispatch modes use platform inventory. Shared ride uses approved private drivers and their onboarded vehicles.</p>
          </div>
        </section>

        <div class="booking-layout">
          <form class="card form-card" id="quote-form">
            <div class="field-block">
              <label class="field-label">Transport task</label>
              <div class="segmented-row">
                <button type="button" class="segmented-pill${draft.intent === 'move-me' ? ' active' : ''}" data-intent="move-me">Move me</button>
                <button type="button" class="segmented-pill${draft.intent === 'shared-ride' ? ' active' : ''}" data-intent="shared-ride">Shared ride</button>
                <button type="button" class="segmented-pill${draft.intent === 'move-goods' ? ' active' : ''}" data-intent="move-goods">Move goods</button>
                <button type="button" class="segmented-pill${draft.intent === 'hire-vehicle' ? ' active' : ''}" data-intent="hire-vehicle">Hire a vehicle</button>
              </div>
            </div>

            <div class="field-grid">
              <label class="field">
                <span>Pickup area</span>
                <select name="pickup">${areaOptions(draft.pickup)}</select>
              </label>
              <label class="field">
                <span>Dropoff area</span>
                <select name="dropoff">${areaOptions(draft.dropoff)}</select>
              </label>
              <label class="field">
                <span>Schedule</span>
                <select name="schedule">
                  <option value="now"${draft.schedule === 'now' ? ' selected' : ''}>As soon as possible</option>
                  <option value="today"${draft.schedule === 'today' ? ' selected' : ''}>Later today</option>
                  <option value="later"${draft.schedule === 'later' ? ' selected' : ''}>Scheduled</option>
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

            <label class="field field-full">
              <span>Trip notes</span>
              <textarea name="notes" rows="3" placeholder="Pickup landmark, stock details, or safety note">${escapeHtml(draft.notes)}</textarea>
            </label>

            <button type="submit" class="primary-btn">${isShared ? 'Find shared rides' : 'Get quotes'}</button>
          </form>

          <aside class="booking-side">
            <section class="card side-panel">
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
        </div>
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
      const nextDraft = {
        ...state.bookingDraft,
        pickup: String(formData.get('pickup')),
        dropoff: String(formData.get('dropoff')),
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
