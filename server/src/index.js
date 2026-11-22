import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { auth, adminOnly } from './auth.js';

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());

const asyncRoute = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validTime = (start, end) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(start) && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(end) && start < end;

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'Campus Hall Booking API' }));

app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password, department, className } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({ message: 'Name, email and password (minimum 6 characters) are required' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.execute('INSERT INTO users (name,email,password_hash,department,class_name,role) VALUES (?,?,?,?,?,\'cr\')', [name, email.toLowerCase(), hash, department || null, className || null]);
    res.status(201).json({ message: 'Account created. You can now log in.', userId: result.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Email already registered' });
    throw e;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.execute('SELECT * FROM users WHERE email=?', [(email || '').toLowerCase()]);
  if (!rows.length || !(await bcrypt.compare(password || '', rows[0].password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
  const user = rows[0];
  const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department, className: user.class_name } });
}));

app.get('/api/halls', auth, asyncRoute(async (_req, res) => {
  const [rows] = await pool.query('SELECT id,name,capacity,location FROM halls WHERE is_active=1 ORDER BY name');
  res.json(rows);
}));

app.get('/api/bookings', auth, asyncRoute(async (req, res) => {
  const own = req.user.role === 'admin' ? '' : ' AND b.user_id=?';
  const params = req.user.role === 'admin' ? [] : [req.user.id];
  const [rows] = await pool.query(`SELECT b.*,h.name AS hall_name,u.name AS booked_by FROM bookings b JOIN halls h ON h.id=b.hall_id JOIN users u ON u.id=b.user_id WHERE b.status='confirmed'${own} ORDER BY b.booking_date DESC,b.start_time`, params);
  res.json(rows);
}));

app.get('/api/availability', auth, asyncRoute(async (req, res) => {
  const { date, start, end } = req.query;
  if (!date || !validTime(start || '', end || '')) return res.status(400).json({ message: 'Provide date, start and end time (HH:MM)' });
  const [halls] = await pool.execute('SELECT id,name,capacity,location FROM halls WHERE is_active=1 ORDER BY name');
  const [booked] = await pool.execute("SELECT hall_id FROM bookings WHERE booking_date=? AND status='confirmed' AND start_time < ? AND end_time > ?", [date, end, start]);
  const [blocked] = await pool.execute('SELECT hall_id FROM hall_blocks WHERE block_date=? AND start_time < ? AND end_time > ?', [date, end, start]);
  const unavailable = new Set([...booked, ...blocked].map(x => x.hall_id));
  res.json(halls.map(h => ({ ...h, available: !unavailable.has(h.id) })));
}));

app.post('/api/bookings', auth, asyncRoute(async (req, res) => {
  const { hallId, purpose, date, start, end } = req.body;
  if (!hallId || !purpose || !date || !validTime(start || '', end || '')) return res.status(400).json({ message: 'Complete all booking fields. End time must be after start time.' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // Lock the hall row so simultaneous requests for the same hall are serialized.
    const [hall] = await conn.execute('SELECT id FROM halls WHERE id=? AND is_active=1 FOR UPDATE', [hallId]);
    if (!hall.length) { await conn.rollback(); return res.status(404).json({ message: 'Hall not found' }); }
    const [conflicts] = await conn.execute("SELECT id FROM bookings WHERE hall_id=? AND booking_date=? AND status='confirmed' AND start_time < ? AND end_time > ? FOR UPDATE", [hallId, date, end, start]);
    const [blocks] = await conn.execute('SELECT id FROM hall_blocks WHERE hall_id=? AND block_date=? AND start_time < ? AND end_time > ? FOR UPDATE', [hallId, date, end, start]);
    if (conflicts.length || blocks.length) {
      const [queued] = await conn.execute("SELECT id FROM waitlist WHERE hall_id=? AND user_id=? AND booking_date=? AND start_time=? AND end_time=? AND status='waiting'", [hallId, req.user.id, date, start, end]);
      if (!queued.length) await conn.execute("INSERT INTO waitlist (hall_id,user_id,purpose,booking_date,start_time,end_time) VALUES (?,?,?,?,?,?)", [hallId, req.user.id, purpose, date, start, end]);
      await conn.commit();
      return res.status(409).json({ message: 'This hall is occupied. You have been added to the waiting list.' });
    }
    const [result] = await conn.execute('INSERT INTO bookings (hall_id,user_id,purpose,booking_date,start_time,end_time) VALUES (?,?,?,?,?,?)', [hallId, req.user.id, purpose, date, start, end]);
    await conn.commit();
    res.status(201).json({ message: 'Hall booked successfully!', bookingId: result.insertId });
  } catch (e) { await conn.rollback(); throw e; }
  finally { conn.release(); }
}));

app.get('/api/waitlist', auth, asyncRoute(async (req, res) => {
  const own = req.user.role === 'admin' ? '' : ' AND w.user_id=?';
  const params = req.user.role === 'admin' ? [] : [req.user.id];
  const [rows] = await pool.query(`SELECT w.*,h.name AS hall_name,u.name AS requested_by FROM waitlist w JOIN halls h ON h.id=w.hall_id JOIN users u ON u.id=w.user_id WHERE w.status='waiting'${own} ORDER BY w.created_at`, params);
  res.json(rows);
}));

app.delete('/api/bookings/:id', auth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute('SELECT * FROM bookings WHERE id=?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Booking not found' });
  if (req.user.role !== 'admin' && rows[0].user_id !== req.user.id) return res.status(403).json({ message: 'You cannot cancel this booking' });
  await pool.execute("UPDATE bookings SET status='cancelled' WHERE id=?", [req.params.id]);
  res.json({ message: 'Booking cancelled. The waiting list can now be reviewed by the Hall In-charge.' });
}));

app.post('/api/admin/halls/:id/block', auth, adminOnly, asyncRoute(async (req, res) => {
  const { date, start, end, reason } = req.body;
  if (!date || !validTime(start || '', end || '') || !reason) return res.status(400).json({ message: 'Date, valid time range and reason are required' });
  const [result] = await pool.execute('INSERT INTO hall_blocks (hall_id,block_date,start_time,end_time,reason,created_by) VALUES (?,?,?,?,?,?)', [req.params.id, date, start, end, reason, req.user.id]);
  res.status(201).json({ message: 'Hall slot blocked', blockId: result.insertId });
}));

app.get('/api/admin/summary', auth, adminOnly, asyncRoute(async (_req, res) => {
  const [[{ halls }]] = await pool.query('SELECT COUNT(*) AS halls FROM halls WHERE is_active=1');
  const [[{ bookings }]] = await pool.query("SELECT COUNT(*) AS bookings FROM bookings WHERE status='confirmed' AND booking_date=CURDATE()");
  const [[{ waiting }]] = await pool.query("SELECT COUNT(*) AS waiting FROM waitlist WHERE status='waiting'");
  res.json({ halls, bookingsToday: bookings, waiting });
}));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error. Check the server terminal and database connection.' });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Campus Hall API running at http://localhost:${port}`));
