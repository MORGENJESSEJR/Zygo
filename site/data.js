'use strict';

(function initZygoData() {
  const STORAGE_KEY = 'zygo-app-state-v2';
  const API_BASE = window.location.protocol === 'file:' ? 'http://127.0.0.1:8000' : window.location.origin;

  const AREAS = [
    { id: 'mbare', label: 'Mbare Musika', subtitle: 'Market rank and long-distance pickup zone', aliases: ['mbare', 'musika', 'market', 'rank'] },
    { id: 'magaba', label: 'Magaba', subtitle: 'Industrial welding and workshops cluster', aliases: ['magaba', 'siyephambili', 'workshops'] },
    { id: 'cbd', label: 'Harare CBD', subtitle: 'Town, Copacabana, First Street, Julius Nyerere', aliases: ['cbd', 'town', 'copacabana', 'first street', 'city centre'] },
    { id: 'avondale', label: 'Avondale', subtitle: 'Shopping centre, medical, and residential stops', aliases: ['avondale', 'avondale shops'] },
    { id: 'borrowdale', label: 'Borrowdale', subtitle: 'Village, Brooke, and northern residential route', aliases: ['borrowdale', 'sam levy', 'village', 'brooke'] },
    { id: 'southerton', label: 'Southerton', subtitle: 'Factories and wholesale distribution corridor', aliases: ['southerton', 'industry', 'factories'] },
    { id: 'belvedere', label: 'Belvedere', subtitle: 'Schools, sports club, and west-side housing', aliases: ['belvedere'] },
    { id: 'waterfalls', label: 'Waterfalls', subtitle: 'High-density southern route and homes', aliases: ['waterfalls'] },
  ];

  const AREA_MAP = Object.fromEntries(AREAS.map((area) => [area.id, area]));

  const PAYMENT_METHODS = [
    { id: 'ecocash', label: 'EcoCash', note: 'Instant mobile money' },
    { id: 'cash', label: 'Cash', note: 'Pay on pickup or dropoff' },
    { id: 'card', label: 'Card', note: 'Visa or Mastercard' },
    { id: 'transfer', label: 'Transfer', note: 'Use for scheduled hire' },
  ];

  const BOOKING_STATES = [
    { id: 'driver_en_route', label: 'Driver en route', detail: 'The driver is moving toward the pickup point.' },
    { id: 'awaiting_start_pin', label: 'Awaiting start PIN', detail: 'Confirm the right driver and vehicle before the trip begins.' },
    { id: 'on_trip', label: 'On trip', detail: 'The trip is active and the route is underway.' },
    { id: 'awaiting_end_pin', label: 'Awaiting end PIN', detail: 'The rider must confirm safe arrival before closing the trip.' },
    { id: 'completed', label: 'Completed', detail: 'Trip closed after the correct end PIN was confirmed.' },
    { id: 'safety_alert', label: 'Safety alert', detail: 'The trip is flagged for safety review.' },
  ];

  const DRIVER_VEHICLE_TYPES = [
    { id: 'hatchback', label: 'Hatchback' },
    { id: 'sedan', label: 'Sedan' },
    { id: 'suv', label: 'SUV' },
    { id: 'pickup', label: 'Pickup' },
    { id: 'truck', label: 'Truck' },
    { id: 'scooter', label: 'Scooter' },
  ];

  function normalizeSearch(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getAreaById(id) {
    return AREA_MAP[id] || null;
  }

  function findAreaMatch(query) {
    const normalized = normalizeSearch(query);
    if (!normalized) return null;
    return AREAS.find((area) => [area.label, ...(area.aliases || [])].some((term) => normalizeSearch(term) === normalized)) || null;
  }

  function searchAreas(query, options) {
    const normalized = normalizeSearch(query);
    const excludeId = options && options.excludeId ? options.excludeId : '';
    return AREAS
      .map((area, index) => {
        if (area.id === excludeId) return null;
        const terms = [area.label, area.subtitle || '', ...(area.aliases || [])].map(normalizeSearch);
        if (!normalized) return { ...area, score: index };
        if (normalizeSearch(area.label).startsWith(normalized)) return { ...area, score: 0 };
        if ((area.aliases || []).some((alias) => normalizeSearch(alias).startsWith(normalized))) return { ...area, score: 1 };
        if (terms.some((term) => term.includes(normalized))) return { ...area, score: 2 };
        if (normalized.split(' ').every((token) => terms.some((term) => term.includes(token)))) return { ...area, score: 3 };
        return null;
      })
      .filter(Boolean)
      .sort((left, right) => left.score - right.score)
      .slice(0, 6)
      .map(({ score, ...area }) => area);
  }

  function defaultBookingDraft() {
    return {
      intent: 'move-me',
      pickup: 'mbare',
      pickupText: 'Mbare Musika',
      dropoff: 'avondale',
      dropoffText: 'Avondale',
      schedule: 'now',
      paymentMethod: 'ecocash',
      passengers: 1,
      loadLevel: 'light',
      hireHours: 2,
      notes: '',
    };
  }

  function defaultDriverDraft() {
    return {
      driverName: '',
      driverPhone: '',
      bio: '',
      vehicleType: 'sedan',
      vehicleLabel: '',
      plateNumber: '',
      seats: 3,
      homeArea: 'mbare',
      routeArea: 'cbd',
      availability: '',
      farePerSeat: 1.5,
      sharedRideEnabled: true,
      driverPhotoData: '',
      vehiclePhotoData: '',
    };
  }

  function defaultState() {
    return {
      apiBase: API_BASE,
      session: null,
      authMode: 'signin',
      bookingDraft: defaultBookingDraft(),
      driverDraft: defaultDriverDraft(),
      quotes: [],
      selectedChoice: null,
      bookings: [],
      activeBookingId: null,
      driverProfiles: [],
      reviewQueue: [],
      loading: false,
    };
  }

  function normalizeBookingDraft(draft) {
    const fallback = defaultBookingDraft();
    const next = { ...fallback, ...(draft || {}) };
    next.pickupText = next.pickupText || getAreaLabel(next.pickup);
    next.dropoffText = next.dropoffText || getAreaLabel(next.dropoff);
    return next;
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      const parsed = JSON.parse(raw);
      return {
        ...defaultState(),
        ...parsed,
        bookingDraft: normalizeBookingDraft(parsed.bookingDraft || {}),
        driverDraft: { ...defaultDriverDraft(), ...(parsed.driverDraft || {}) },
        quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
        bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
        driverProfiles: Array.isArray(parsed.driverProfiles) ? parsed.driverProfiles : [],
        reviewQueue: Array.isArray(parsed.reviewQueue) ? parsed.reviewQueue : [],
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
    }).format(value || 0);
  }

  function getAreaLabel(id) {
    return AREA_MAP[id] ? AREA_MAP[id].label : id;
  }

  function bookingRequestPayload(request) {
    return {
      intent: request.intent,
      pickup: request.pickup,
      dropoff: request.dropoff,
      schedule: request.schedule,
      paymentMethod: request.paymentMethod,
      passengers: request.passengers,
      loadLevel: request.loadLevel,
      hireHours: request.hireHours,
      notes: request.notes,
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

  function authHeaders(session) {
    return session && session.token ? { Authorization: `Bearer ${session.token}` } : {};
  }

  function payload(request) {
    return {
      method: 'POST',
      body: JSON.stringify(request),
    };
  }

  async function registerUser(base, formData) {
    return apiRequest(base, '/auth/register', payload(formData));
  }

  async function loginUser(base, formData) {
    return apiRequest(base, '/auth/login', payload(formData));
  }

  async function requestQuotes(base, request) {
    return apiRequest(base, '/quotes', payload(bookingRequestPayload(request)));
  }

  async function createBooking(base, session, request) {
    return apiRequest(base, '/bookings', {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({
        ...request,
        request: bookingRequestPayload(request.request),
      }),
    });
  }

  async function listBookings(base, session) {
    return apiRequest(base, '/bookings', {
      method: 'GET',
      headers: authHeaders(session),
    });
  }

  async function listDriverProfiles(base, session, query) {
    const suffix = query ? `?${query}` : '';
    return apiRequest(base, `/driver-profiles${suffix}`, {
      method: 'GET',
      headers: authHeaders(session),
    });
  }

  async function submitDriverProfile(base, session, request) {
    return apiRequest(base, '/driver-profiles', {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify(request),
    });
  }

  async function approveDriverProfile(base, session, profileId) {
    return apiRequest(base, `/driver-profiles/${profileId}/approve`, {
      method: 'POST',
      headers: authHeaders(session),
    });
  }

  async function markDriverArrived(base, session, bookingId) {
    return apiRequest(base, `/bookings/${bookingId}/driver-arrived`, {
      method: 'POST',
      headers: authHeaders(session),
    });
  }

  async function confirmTripStart(base, session, bookingId, pin) {
    return apiRequest(base, `/bookings/${bookingId}/confirm-start`, {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({ pin }),
    });
  }

  async function markDropoffArrived(base, session, bookingId) {
    return apiRequest(base, `/bookings/${bookingId}/dropoff-arrived`, {
      method: 'POST',
      headers: authHeaders(session),
    });
  }

  async function confirmTripCompletion(base, session, bookingId, pin) {
    return apiRequest(base, `/bookings/${bookingId}/confirm-complete`, {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({ pin }),
    });
  }

  async function raiseSafetyAlert(base, session, bookingId, reason) {
    return apiRequest(base, `/bookings/${bookingId}/safety-alert`, {
      method: 'POST',
      headers: authHeaders(session),
      body: JSON.stringify({ reason }),
    });
  }

  window.ZygoData = {
    API_BASE,
    AREAS,
    PAYMENT_METHODS,
    BOOKING_STATES,
    DRIVER_VEHICLE_TYPES,
    defaultBookingDraft,
    defaultDriverDraft,
    defaultState,
    loadState,
    saveState,
    formatMoney,
    getAreaLabel,
    getAreaById,
    findAreaMatch,
    searchAreas,
    registerUser,
    loginUser,
    requestQuotes,
    createBooking,
    listBookings,
    listDriverProfiles,
    submitDriverProfile,
    approveDriverProfile,
    markDriverArrived,
    confirmTripStart,
    markDropoffArrived,
    confirmTripCompletion,
    raiseSafetyAlert,
  };
}());
