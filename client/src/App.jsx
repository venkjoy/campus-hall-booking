import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Building2, ClipboardList, LogOut,
  ShieldCheck, Clock3, RefreshCw, Users, MapPin, Sparkles,
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ---------- helpers ---------- */
const localDate = (d = new Date()) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

const readStorage = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const fmtDate = (v) => String(v).slice(0, 10);
const fmtTime = (v) => String(v).slice(0, 5);

const EMPTY_FORM = { name: '', email: '', password: '', department: '', className: '' };

/* ---------- small components ---------- */
function Notice({ type, children, onClose }) {
  return (
    <div className={`notice ${type}`} role={type === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      <button type="button" aria-label="Dismiss" onClick={onClose}>×</button>
    </div>
  );
}

function HallCard({ hall, onSelect, selected }) {
  const { available } = hall;
  const state = available === true ? 'available' : available === false ? 'occupied' : 'unknown';
  const label = available === true ? 'Available' : available === false ? 'Occupied' : 'Check slot';
  return (
    <article className={`hall-card is-${state} ${selected ? 'selected' : ''}`}>
      <div className="hall-top">
        <div className="hall-icon"><Building2 size={20} /></div>
        <span className={`status ${state}`}><i className="dot" />{label}</span>
      </div>
      <h3>{hall.name}</h3>
      <div className="hall-meta">
        <span><MapPin size={14} /> {hall.location || 'Campus'}</span>
        <span><Users size={14} /> {hall.capacity}</span>
      </div>
      <button
        type="button"
        className={available === false ? 'secondary full' : 'primary full'}
        onClick={() => onSelect(hall.id)}
      >
        {selected ? '✓ Selected' : available === false ? 'Join waiting list' : 'Select hall'}
      </button>
    </article>
  );
}

function BookingsTable({ rows, showUser, canCancel, onCancel }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Hall</th>
            {showUser && <th>Booked by</th>}
            <th>Date</th>
            <th>Time</th>
            <th>Purpose</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.id}>
              <td><b>{b.hall_name}</b></td>
              {showUser && <td>{b.booked_by}</td>}
              <td>{fmtDate(b.booking_date)}</td>
              <td>{fmtTime(b.start_time)} – {fmtTime(b.end_time)}</td>
              <td>{b.purpose}</td>
              <td>
                {canCancel(b)
                  ? <button type="button" className="text-danger" onClick={() => onCancel(b.id)}>Cancel</button>
                  : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AuthScreen({ onAuthed, request }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    setError(''); setMessage(''); setLoading(true);
    try {
      const data = await request(`/auth/${mode}`, { method: 'POST', body: JSON.stringify(form) });
      if (mode === 'register') {
        setMessage(data.message || 'Account created. Please log in.');
        setForm((f) => ({ ...EMPTY_FORM, email: f.email }));
        setMode('login');
      } else {
        onAuthed(data.token, data.user);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-wrap">
      <div className="auth-split">
        <aside className="auth-aside">
          <div className="brand-icon"><Building2 size={26} /></div>
          <h2>Book campus halls in seconds.</h2>
          <p>No more register visits. Check live availability, reserve instantly, or join the waiting list.</p>
          <ul>
            <li>Live availability by date and time</li>
            <li>Automatic waiting list</li>
            <li>Instant confirmation for free slots</li>
          </ul>
        </aside>

        <section className="auth-card">
          <p className="eyebrow">CAMPUS FACILITIES</p>
          <h1>{mode === 'login' ? 'Welcome back' : 'Create CR account'}</h1>
          <p className="muted">
            {mode === 'login' ? 'Log in to book an examination hall.' : 'Class Representatives can register here.'}
          </p>

          <div className="tabs" role="tablist">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Login</button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create CR account</button>
          </div>

          <form onSubmit={submit} className="form-stack">
            {mode === 'register' && (
              <>
                <label>Full name<input required autoComplete="name" value={form.name} onChange={set('name')} /></label>
                <label>Department<input value={form.department} onChange={set('department')} /></label>
                <label>Class / Section<input value={form.className} onChange={set('className')} /></label>
              </>
            )}
            <label>Email<input type="email" required autoComplete="email" value={form.email} onChange={set('email')} /></label>
            <label>
              Password
              <input
                type="password" required minLength={6}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password} onChange={set('password')}
              />
            </label>
            <button className="primary full lg" disabled={loading}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Create account'}
            </button>
          </form>

          {message && <p className="success">{message}</p>}
          {error && <p className="error">{error}</p>}
          <p className="tiny muted">Admin accounts must be created by the database administrator.</p>
        </section>
      </div>
    </main>
  );
}

/* ---------- main app ---------- */
export default function App() {
  const today = localDate();

  const [token, setToken] = useState(() => localStorage.getItem('campus_token') || '');
  const [user, setUser] = useState(() => readStorage('campus_user', null));
  const [tab, setTab] = useState('book');

  const [halls, setHalls] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [checking, setChecking] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [date, setDate] = useState(today);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('11:00');
  const [purpose, setPurpose] = useState('');
  const [selectedHall, setSelectedHall] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [block, setBlock] = useState({ hallId: '', date: today, start: '09:00', end: '17:00', reason: '' });

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isAdmin = user?.role === 'admin';
  const timeValid = Boolean(start && end && start < end);

  /* auth / api */
  const logout = useCallback(() => {
    localStorage.removeItem('campus_token');
    localStorage.removeItem('campus_user');
    setToken(''); setUser(null);
    setAvailability([]); setBookings([]); setWaitlist([]); setHalls([]);
    setTab('book');
  }, []);

  const request = useCallback(async (path, options = {}) => {
    const res = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && token) {
      logout();
      throw new Error('Session expired. Please log in again.');
    }
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }, [token, logout]);

  function handleAuthed(newToken, newUser) {
    localStorage.setItem('campus_token', newToken);
    localStorage.setItem('campus_user', JSON.stringify(newUser));
    setToken(newToken); setUser(newUser);
  }

  /* data loading */
  const loadData = useCallback(async () => {
    if (!token) return;
    try {
      const [h, b, w] = await Promise.all([request('/halls'), request('/bookings'), request('/waitlist')]);
      setHalls(h); setBookings(b); setWaitlist(w);
      setSelectedHall((cur) => cur || (h.length ? String(h[0].id) : ''));
      setBlock((v) => (v.hallId || !h.length ? v : { ...v, hallId: String(h[0].id) }));
    } catch (e) {
      setError(e.message);
    }
  }, [token, request]);

  useEffect(() => { loadData(); }, [loadData]);

  /* auto availability check (debounced, ignores stale responses) */
  useEffect(() => {
    if (!token || tab !== 'book') return;
    if (!timeValid) { setAvailability([]); return; }

    let cancelled = false;
    setChecking(true);
    const id = setTimeout(async () => {
      try {
        const q = new URLSearchParams({ date, start, end }).toString();
        const data = await request(`/availability?${q}`);
        if (!cancelled) setAvailability(data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);

    return () => { cancelled = true; clearTimeout(id); };
  }, [token, tab, date, start, end, timeValid, refreshKey, request]);

  /* auto-dismiss notices */
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(''), 4500);
    return () => clearTimeout(id);
  }, [message]);

  /* actions */
  const refresh = () => setRefreshKey((k) => k + 1);

  async function bookHall(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (!selectedHall) return setError('Please select a hall.');
    if (!timeValid) return setError('End time must be after start time.');

    setSubmitting(true);
    try {
      const data = await request('/bookings', {
        method: 'POST',
        body: JSON.stringify({ hallId: Number(selectedHall), purpose: purpose.trim(), date, start, end }),
      });
      setMessage(data.message);
      setPurpose('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
      await loadData();
      refresh();
    }
  }

  async function cancelBooking(id) {
    if (!window.confirm('Cancel this booking?')) return;
    setError(''); setMessage('');
    try {
      const data = await request(`/bookings/${id}`, { method: 'DELETE' });
      setMessage(data.message);
      await loadData();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function blockHall(e) {
    e.preventDefault();
    setError(''); setMessage('');
    if (block.start >= block.end) return setError('Block end time must be after start time.');
    try {
      const data = await request(`/admin/halls/${block.hallId}/block`, {
        method: 'POST',
        body: JSON.stringify({ date: block.date, start: block.start, end: block.end, reason: block.reason.trim() }),
      });
      setMessage(data.message);
      setBlock((v) => ({ ...v, reason: '' }));
      await loadData();
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  function selectHall(id) {
    setSelectedHall(String(id));
    document.getElementById('booking-form')?.scrollIntoView({ behavior: 'smooth' });
  }

  /* derived */
  const hallList = availability.length ? availability : halls.map((h) => ({ ...h, available: null }));
  const selectedAvailability = availability.find((h) => String(h.id) === selectedHall)?.available;
  const bookLabel = submitting
    ? 'Please wait…'
    : selectedAvailability === false ? 'Join waiting list' : selectedAvailability === true ? 'Book hall' : 'Book / Join waiting list';

  const todaysBookings = useMemo(
    () => bookings.filter((b) => fmtDate(b.booking_date) === today).length,
    [bookings, today],
  );

  const firstName = user?.name?.split(' ')[0] || 'there';
  const freeCount = availability.filter((h) => h.available).length;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const titles = { book: 'Find and book a hall', history: 'Booking history', admin: 'Hall management' };

  if (!token) return <AuthScreen onAuthed={handleAuthed} request={request} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon small"><Building2 size={18} /></div>
          <div><b>Campus Hall</b><span>Booking Portal</span></div>
        </div>

        <div className="nav-label">WORKSPACE</div>
        <button className={tab === 'book' ? 'nav active' : 'nav'} onClick={() => setTab('book')}>
          <CalendarDays size={18} /> Book a hall
        </button>
        <button className={tab === 'history' ? 'nav active' : 'nav'} onClick={() => setTab('history')}>
          <ClipboardList size={18} /> My bookings
        </button>

        {isAdmin && (
          <>
            <div className="nav-label">ADMINISTRATION</div>
            <button className={tab === 'admin' ? 'nav active' : 'nav'} onClick={() => setTab('admin')}>
              <ShieldCheck size={18} /> Hall management
            </button>
          </>
        )}

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">{user?.name?.[0]?.toUpperCase()}</div>
            <div>
              <b>{user?.name}</b>
              <span>{isAdmin ? 'Hall In-charge' : 'Class Representative'}</span>
            </div>
          </div>
          <button className="nav" onClick={logout}><LogOut size={18} /> Sign out</button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <p className="eyebrow">CAMPUS FACILITIES / {tab.toUpperCase()}</p>
            <h1>{titles[tab]}</h1>
          </div>
          <div className="profile-pill"><span className="online-dot" />{user?.name}</div>
        </header>

        {message && <Notice type="success" onClose={() => setMessage('')}>{message}</Notice>}
        {error && <Notice type="error" onClose={() => setError('')}>{error}</Notice>}

        {tab === 'book' && (
          <>
            <section className="hero">
              <div>
                <p className="hero-kicker"><Sparkles size={14} /> {greeting}</p>
                <h2>Hi {firstName}, which hall do you need?</h2>
                <p>Pick a date and time below. Free halls are confirmed instantly.</p>
              </div>
              <div className="hero-meta">
                <b>{availability.length ? freeCount : '–'}</b>
                <span>{availability.length ? 'halls free for your slot' : 'check a slot'}</span>
              </div>
            </section>

            <section className="panel search-panel">
              <div className="section-title">
                <div>
                  <h2>Check availability</h2>
                  <p className="muted">Pick a date and time slot. Results update automatically.</p>
                </div>
                <button type="button" className="secondary" onClick={refresh} disabled={checking}>
                  <RefreshCw size={16} className={checking ? 'spin' : ''} /> {checking ? 'Checking…' : 'Refresh'}
                </button>
              </div>
              <div className="filters">
                <label><span>Date</span>
                  <input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value || today)} />
                </label>
                <label><span>Start time</span>
                  <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                </label>
                <label><span>End time</span>
                  <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                </label>
              </div>
              {!timeValid && <p className="field-error">End time must be after start time.</p>}
            </section>

            <div className="section-heading">
              <div>
                <h2>Available halls</h2>
                <p className="muted">Availability is checked against confirmed bookings and blocked slots.</p>
              </div>
              <span className="count">{hallList.length} halls</span>
            </div>

            <div className="hall-grid">
              {hallList.map((h) => (
                <HallCard key={h.id} hall={h} selected={String(h.id) === selectedHall} onSelect={selectHall} />
              ))}
            </div>

            <section className="panel booking-panel" id="booking-form">
              <div>
                <h2>Booking details</h2>
                <p className="muted">Available slots are confirmed instantly. Occupied slots place you in the waiting list.</p>
              </div>
              <form className="filters booking-fields" onSubmit={bookHall}>
                <label><span>Hall</span>
                  <select required value={selectedHall} onChange={(e) => setSelectedHall(e.target.value)}>
                    <option value="">Select a hall</option>
                    {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </label>
                <label className="wide"><span>Purpose</span>
                  <input
                    required maxLength={255}
                    placeholder="e.g. Internal assessment / project review"
                    value={purpose} onChange={(e) => setPurpose(e.target.value)}
                  />
                </label>
                <button className="primary submit-book" type="submit" disabled={submitting || !timeValid}>
                  {bookLabel}
                </button>
              </form>
            </section>
          </>
        )}

        {tab === 'history' && (
          <section className="panel">
            <h2>Your confirmed bookings</h2>
            {bookings.length === 0 ? (
              <p className="muted empty">No bookings found yet.</p>
            ) : (
              <BookingsTable
                rows={bookings}
                canCancel={(b) => isAdmin || b.user_id === user?.id}
                onCancel={cancelBooking}
              />
            )}

            <h2 className="subheading">Waiting list</h2>
            {waitlist.length === 0 ? (
              <p className="muted">No active waiting-list requests.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Hall</th><th>Date</th><th>Time</th><th>Status</th></tr></thead>
                  <tbody>
                    {waitlist.map((w) => (
                      <tr key={w.id}>
                        <td><b>{w.hall_name}</b></td>
                        <td>{fmtDate(w.booking_date)}</td>
                        <td>{fmtTime(w.start_time)} – {fmtTime(w.end_time)}</td>
                        <td><span className="status waiting"><i className="dot" />Waiting</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {tab === 'admin' && isAdmin && (
          <>
            <div className="stats">
              <div className="stat panel"><Building2 /><span>Active halls</span><b>{halls.length}</b></div>
              <div className="stat panel"><ClipboardList /><span>Today's bookings</span><b>{todaysBookings}</b></div>
              <div className="stat panel"><Clock3 /><span>Waiting requests</span><b>{waitlist.length}</b></div>
            </div>

            <section className="panel">
              <h2>Block a hall slot</h2>
              <p className="muted">Use this for maintenance, exams or other college reservations.</p>
              <form className="filters booking-fields" onSubmit={blockHall}>
                <label><span>Hall</span>
                  <select required value={block.hallId} onChange={(e) => setBlock({ ...block, hallId: e.target.value })}>
                    {halls.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
                  </select>
                </label>
                <label><span>Date</span>
                  <input type="date" min={today} required value={block.date} onChange={(e) => setBlock({ ...block, date: e.target.value })} />
                </label>
                <label><span>Start</span>
                  <input type="time" required value={block.start} onChange={(e) => setBlock({ ...block, start: e.target.value })} />
                </label>
                <label><span>End</span>
                  <input type="time" required value={block.end} onChange={(e) => setBlock({ ...block, end: e.target.value })} />
                </label>
                <label className="wide"><span>Reason</span>
                  <input required value={block.reason} onChange={(e) => setBlock({ ...block, reason: e.target.value })} placeholder="Reason for blocking this slot" />
                </label>
                <button className="primary submit-book">Block slot</button>
              </form>
            </section>

            <section className="panel">
              <h2>All current bookings</h2>
              {bookings.length === 0
                ? <p className="muted empty">No bookings yet.</p>
                : <BookingsTable rows={bookings} showUser canCancel={() => true} onCancel={cancelBooking} />}
            </section>
          </>
        )}

        <footer>Campus Hall Booking System <span>·</span> Prototype</footer>
      </main>
    </div>
  );
}