// Simple Express server to handle forms and serve EJS pages
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const session = require('express-session');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../frontend/public/uploads');
    require('fs').mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Setup session
app.use(session({
  secret: 'munipuri-secret-key-1234',
  resave: false,
  saveUninitialized: true,
}));

// Setup EJS for rendering pages
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve frontend assets from /frontend/public
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Utility to append to JSON file (creates file if missing)
async function appendToFile(filePath, obj) {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    let data = [];
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      data = JSON.parse(raw || '[]');
    } catch (err) {
      data = [];
    }
    data.push(obj);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing file', err);
  }
}

// Read events file
async function readEvents() {
  const filePath = path.join(__dirname, 'data', 'events.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

// Write events file
async function writeEvents(events) {
  const filePath = path.join(__dirname, 'data', 'events.json');
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(events, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing events file', err);
  }
}

// Read alumni file
async function readAlumni() {
  const filePath = path.join(__dirname, 'data', 'alumni.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

// Write alumni file
async function writeAlumni(alumni) {
  const filePath = path.join(__dirname, 'data', 'alumni.json');
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(alumni, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing alumni file', err);
  }
}

// Read gallery file
async function readGallery() {
  const filePath = path.join(__dirname, 'data', 'gallery.json');
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [];
  }
}

// Write gallery file
async function writeGallery(gallery) {
  const filePath = path.join(__dirname, 'data', 'gallery.json');
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(gallery, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing gallery file', err);
  }
}

// Authentication middleware
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

app.post('/api/contact', async (req, res) => {
  const entry = { ...req.body, receivedAt: new Date().toISOString() };
  await appendToFile(path.join(__dirname, 'data', 'messages.json'), entry);
  res.json({ ok: true, message: 'Contact message received' });
});

app.post('/api/register', async (req, res) => {
  const member = { ...req.body, registeredAt: new Date().toISOString() };
  await appendToFile(path.join(__dirname, 'data', 'members.json'), member);
  res.json({ ok: true, message: 'Registration received' });
});

app.post('/api/newsletter', async (req, res) => {
  const sub = { email: req.body.email, subscribedAt: new Date().toISOString() };
  await appendToFile(path.join(__dirname, 'data', 'newsletter.json'), sub);
  res.json({ ok: true, message: 'Subscribed to newsletter' });
});

// Admin Authentication Routes
app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.isAdmin = true;
    res.redirect('/admin/dashboard');
  } else {
    res.render('admin-login', { error: 'Invalid username or password' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/admin/login');
});

// Admin Dashboard
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  const events = await readEvents();
  const alumniList = await readAlumni();
  const gallery = await readGallery();
  res.render('admin-dashboard', { events, alumniList, gallery });
});

// Admin API
app.post('/admin/api/events', requireAdmin, upload.single('attachment'), async (req, res) => {
  const events = await readEvents();
  const newEvent = {
    id: Date.now(),
    title: req.body.title,
    date: req.body.date,
    time: req.body.time,
    location: req.body.location,
    description: req.body.description,
    attachment: req.file ? `/uploads/${req.file.filename}` : null,
    isPast: false
  };
  events.push(newEvent);
  await writeEvents(events);
  res.json({ ok: true, message: 'Event added successfully' });
});

app.delete('/admin/api/events/:id', requireAdmin, async (req, res) => {
  let events = await readEvents();
  events = events.filter(e => e.id !== parseInt(req.params.id));
  await writeEvents(events);
  res.json({ ok: true });
});

app.post('/admin/api/gallery', requireAdmin, upload.single('image'), async (req, res) => {
  if(!req.file) {
    return res.status(400).json({ ok: false, message: 'Image is required' });
  }
  const gallery = await readGallery();
  const newItem = {
    id: Date.now(),
    title: req.body.title || 'Untitled Image',
    image: `/uploads/${req.file.filename}`
  };
  gallery.push(newItem);
  await writeGallery(gallery);
  res.json({ ok: true, message: 'Gallery item added successfully' });
});

app.delete('/admin/api/gallery/:id', requireAdmin, async (req, res) => {
  let gallery = await readGallery();
  gallery = gallery.filter(g => g.id !== parseInt(req.params.id));
  await writeGallery(gallery);
  res.json({ ok: true });
});

app.post('/admin/api/alumni', requireAdmin, upload.single('image'), async (req, res) => {
  const alumni = await readAlumni();
  const newAlumni = {
    id: Date.now(),
    name: req.body.name,
    batch: req.body.batch,
    profession: req.body.profession,
    image: req.file ? `/uploads/${req.file.filename}` : `https://ui-avatars.com/api/?name=${encodeURIComponent(req.body.name)}&background=random`
  };
  alumni.push(newAlumni);
  await writeAlumni(alumni);
  res.json({ ok: true, message: 'Alumni added successfully' });
});

app.delete('/admin/api/alumni/:id', requireAdmin, async (req, res) => {
  let alumni = await readAlumni();
  alumni = alumni.filter(a => a.id !== parseInt(req.params.id));
  await writeAlumni(alumni);
  res.json({ ok: true });
});

// Render EJS Views
app.get('/', (req, res) => res.render('index'));
app.get('/about', (req, res) => res.render('about'));
app.get('/events', async (req, res) => {
  const events = await readEvents();
  const upcoming = events.filter(e => !e.isPast);
  const past = events.filter(e => e.isPast);
  res.render('events', { upcoming, past });
});
app.get('/gallery', async (req, res) => {
  const gallery = await readGallery();
  res.render('gallery', { gallery });
});
app.get('/alumni', async (req, res) => {
  const alumniList = await readAlumni();
  res.render('alumni', { alumniList });
});

// Fallback / 404
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// For Vercel Serverless Function compatibility, only listen if run directly
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
}

module.exports = app;
