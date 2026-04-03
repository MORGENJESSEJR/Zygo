'use strict';

(function initZygoData() {
  const STORAGE_KEY = 'zygo-app-state-v1';
  const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : window.location.origin;

  const AREAS = [
    { id: 'mbare', label: 'Mbare Musika', x: 1, y: 1 },
    { id: 'magaba', label: 'Magaba', x: 2, y: 2 },
    { id: 'cbd', label: 'Harare CBD', x: 4, y: 4 },
    { id: 'avondale', label: 'Avondale', x: 6, y: 5 },
    { id: 'borrowdale', label: 'Borrowdale', x: 8, y: 7 },
    { id: 'southerton', label: 'Southerton', x: 3, y: 1 },
    { id: 'belvedere', label: 'Belvedere', x: 4, y: 5 },
    { id: 'waterfalls', label: 'Waterfalls', x: 2, y: 0 },
  ];

  const AREA_MAP = Object.fromEntries(AREAS.map((area) => [area.id, area]));

  const VEHICLES = [
    { id: 'taxi', name: 'Taxi', intents: ['move-me'], baseFare: 3.2, perKm: 0.78, etaBase: 5, seats: 4, cargo: 'light', hourly: 0 },
    { id: 'sedan', name: 'Sedan', intents: ['move-me', 'hire-vehicle'], baseFare: 4.4, perKm: 0.88, etaBase: 7, seats: 4, cargo: 'medium', hourly: 6.5 },
    { id: 'scooter', name: 'Scooter', intents: ['move-me', 'move-goods'], baseFare: 2.4, perKm: 0.56, etaBase: 4, seats: 1, cargo: 'light', hourly: 3.8 },
    { id: 'cart', name: 'Cart', intents: ['move-goods'], baseFare: 2.1, perKm: 0.42, etaBase: 10, seats: 0, cargo: 'medium', hourly: 2.6 },
    { id: 'pickup', name: 'Pickup', intents: ['move-goods', 'hire-vehicle'], baseFare: 5.8, perKm: 1.04, etaBase: 11, seats: 2, cargo: 'heavy', hourly: 9.8 },
    { id: 'truck', name: 'Truck', intents: ['move-goods', 'hire-vehicle'], baseFare: 8.5, perKm: 1.38, etaBase: 16, seats: 2, cargo: 'bulk', hourly: 16.0 },
  ];

  const DRIVER_POOL = {
    taxi: { name: 'Farai N.', phone: '+263 77 321 4928', plate: 'AFR 2481', rating: 4.8 },
    sedan: { name: 'Tariro M.', phone: '+263 78 731 5050', plate: 'AGT 1184', rating: 4.9 },
    scooter: { name: 'Kuda P.', phone: '+263 71 664 2053', plate: 'SC-19', rating: 4.7 },
    cart: { name: 'Tendai G.', phone: '+263 71 155 2309', plate: 'CT-08', rating: 4.6 },
    pickup: { name: 'Nyasha C.', phone: '+263 77 507 4081', plate: 'PUK 4402', rating: 4.9 },
    truck: { name: 'Simba D.', phone: '+263 77 290 1012', plate: 'TRK 9024', rating: 4.8 },
  };

  const PAYMENT_METHODS = [
    { id: 'ecocash', label: 'EcoCash', note: 'Instant mobile money' },
    { id: 'cash', label: 'Cash', note: 'Pay on pickup or dropoff' },
    { id: 'card', label: 'Card', note: 'Visa or Mastercard' },
    { id: 'transfer', label: 'Transfer', note: 'Use for scheduled hire' },
  ];

  const STATUS_STAGES = [
    { id: 'confirmed', label: 'Booking confirmed', detail: 'Dispatch accepted the request.' },
    { id: 'driver_en_route', label: 'Driver en route', detail: 'The vehicle is moving toward pickup.' },
    { id: 'at_pickup', label: 'At pickup', detail: 'Driver has arrived at the pickup point.' },
    { id: 'on_trip', label: 'On trip', detail: 'Trip or delivery is in progress.' },
    { id: 'completed', label: 'Completed', detail: 'Route closed and payment reconciled.' },
  ];

  function createId(prefix) {
    const seed = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    return `${prefix}-${seed}`.toUpperCase();
  }

  function defaultDraft() {
    return {
      intent: 'move-me',
      pickup: 'mbare',
      dropoff: 'avondale',
      schedule: 'now',
      paymentMethod: 'ecocash',
      passengers: 1,
      loadLevel: 'light',
      hireHours: 2,
      notes: '',
    };
  }

  function defaultState() {
    return {
      apiBase: API_BASE,
      session: null,
      authMode: 'signin',
      draft: defaultDraft(),
      quotes: [],
      selectedVehicleId: null,
      bookings: [],
      activeBookingId: null,
    };
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();

      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        draft: { ...defaultDraft(), ...(parsed.draft || {}) },
        quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
        bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      };
    } catch (error) {
      return defaultState();
    }
  }

  function saveState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  function getAreaLabel(id) {
    return AREA_MAP[id] ? AREA_MAP[id].label : id;
  }

  function getDistanceKm(pickupId, dropoffId) {
    const start = AREA_MAP[pickupId];
    const end = AREA_MAP[dropoffId];
    if (!start || !end) return 6;
    if (start.id === end.id) return 2.5;

    const dx = start.x - end.x;
    const dy = start.y - end.y;
    return Math.max(2.5, Math.round((Math.sqrt((dx * dx) + (dy * dy)) * 2.9) * 10) / 10);
  }

  function scoreCargoLevel(value) {
    const ranking = { light: 1, medium: 2, heavy: 3, bulk: 4 };
    return ranking[value] || 1;
  }

  function matchesRequest(vehicle, request) {
    if (!vehicle.intents.includes(request.intent)) return false;
    if (request.intent === 'move-me') {
      return request.passengers <= vehicle.seats;
    }

    const loadScore = scoreCargoLevel(request.loadLevel);
    return scoreCargoLevel(vehicle.cargo) >= loadScore;
  }

  function getPaymentLabels(intent) {
    return intent === 'hire-vehicle'
      ? ['EcoCash', 'Card', 'Transfer']
      : ['EcoCash', 'Cash', 'Card'];
  }

  function buildReason(vehicle, request) {
    if (request.intent === 'move-me') {
      if (vehicle.id === 'scooter') return 'Fastest fit for one rider with a light load.';
      if (vehicle.id === 'taxi') return 'Lowest-friction option for a standard city ride.';
      return 'More cabin room for rider comfort and mixed luggage.';
    }

    if (request.intent === 'move-goods') {
      if (vehicle.id === 'cart') return 'Practical for short local moves and lighter stock.';
      if (vehicle.id === 'pickup') return 'Balanced fit for stock volume and same-day flexibility.';
      return 'Best for heavier cargo or repeated drop-offs.';
    }

    if (vehicle.id === 'sedan') return 'Useful when the task is time-bound but still rider-led.';
    if (vehicle.id === 'pickup') return 'Flexible for mixed passenger and cargo scheduling.';
    return 'Built for longer use windows and heavier route plans.';
  }

  function getLocalQuotes(request) {
    const distanceKm = getDistanceKm(request.pickup, request.dropoff);
    const demandFactor = request.schedule === 'later' ? 0.95 : 1;
    const loadFactor = request.intent === 'move-me' ? 0 : (scoreCargoLevel(request.loadLevel) - 1) * 1.25;

    return VEHICLES
      .filter((vehicle) => matchesRequest(vehicle, request))
      .map((vehicle, index) => {
        const tripFare = request.intent === 'hire-vehicle'
          ? vehicle.baseFare + (vehicle.hourly * Math.max(1, request.hireHours)) + (distanceKm * 0.25)
          : vehicle.baseFare + (vehicle.perKm * distanceKm) + loadFactor;
        const fareUsd = Math.round((tripFare * demandFactor) * 100) / 100;
        const etaMinutes = vehicle.etaBase + Math.max(0, Math.round(distanceKm / 1.8)) + (request.schedule === 'later' ? 6 : 0);

        return {
          id: `${vehicle.id}-${index + 1}`,
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          fareUsd,
          etaMinutes,
          distanceKm,
          paymentLabels: getPaymentLabels(request.intent),
          fitReason: buildReason(vehicle, request),
        };
      })
      .sort((left, right) => left.fareUsd - right.fareUsd);
  }

  function createBookingFromLocal(request, vehicleId, session) {
    const quote = getLocalQuotes(request).find((entry) => entry.vehicleId === vehicleId) || getLocalQuotes(request)[0];
    const driver = DRIVER_POOL[quote.vehicleId];
    const bookingId = createId('ZG');

    return {
      id: bookingId,
      routeCode: `RT-${bookingId.slice(-5)}`,
      riderName: session && session.user ? session.user.name : 'Guest rider',
      riderPhone: session && session.user ? session.user.phone : '+263 77 000 0000',
      request,
      quote,
      driver,
      paymentMethod: request.paymentMethod,
      pickupLabel: getAreaLabel(request.pickup),
      dropoffLabel: getAreaLabel(request.dropoff),
      statusIndex: 0,
      createdAt: new Date().toISOString(),
    };
  }

  async function apiRequest(base, path, options) {
    const response = await window.fetch(`${base}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(options && options.headers ? options.headers : {}),
      },
      ...options,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => ({ detail: 'Request failed.' }));
      const error = new Error(payload.detail || 'Request failed.');
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  async function requestQuotes(base, request) {
    try {
      return await apiRequest(base, '/quotes', {
        method: 'POST',
        body: JSON.stringify(request),
      });
    } catch (error) {
      return { source: 'local', quotes: getLocalQuotes(request) };
    }
  }

  async function registerUser(base, payload) {
    try {
      return await apiRequest(base, '/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return {
        source: 'local',
        token: createId('session'),
        user: {
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
        },
      };
    }
  }

  async function loginUser(base, payload, fallbackUser) {
    try {
      return await apiRequest(base, '/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return {
        source: 'local',
        token: createId('session'),
        user: fallbackUser || {
          name: payload.phone,
          phone: payload.phone,
          email: payload.email || '',
        },
      };
    }
  }

  async function createBooking(base, payload, session) {
    try {
      return await apiRequest(base, '/bookings', {
        method: 'POST',
        headers: session && session.token ? { Authorization: `Bearer ${session.token}` } : {},
        body: JSON.stringify(payload),
      });
    } catch (error) {
      return {
        source: 'local',
        booking: createBookingFromLocal(payload.request, payload.vehicleId, session),
      };
    }
  }

  window.ZygoData = {
    API_BASE,
    AREAS,
    VEHICLES,
    PAYMENT_METHODS,
    STATUS_STAGES,
    defaultDraft,
    defaultState,
    loadState,
    saveState,
    formatMoney,
    getAreaLabel,
    getDistanceKm,
    getLocalQuotes,
    requestQuotes,
    registerUser,
    loginUser,
    createBooking,
  };
}());
