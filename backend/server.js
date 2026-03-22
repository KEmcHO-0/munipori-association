// Express server configured for MongoDB Atlas and Cloudinary
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const session = require('express-session');
const mongoose = require('mongoose');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// 1. MONGODB DATABASE CONNECTION
// ==========================================
// Vercel serverless approach: maintain cached connection
let isConnected = false;
async function connectToDatabase() {
  if (isConnected) return;
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI is missing from environment variables');
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
    isConnected = true;
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
}

// Middleware to ensure DB connection on every request
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// ==========================================
// 2. MONGOOSE MODELS
// ==========================================
const Event = mongoose.models.Event || mongoose.model('Event', new mongoose.Schema({
  title: String,
  date: String,
  time: String,
  location: String,
  description: String,
  attachment: String,
  isPast: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}));

const Gallery = mongoose.models.Gallery || mongoose.model('Gallery', new mongoose.Schema({
  title: String,
  image: String,
  createdAt: { type: Date, default: Date.now }
}));

const Alumni = mongoose.models.Alumni || mongoose.model('Alumni', new mongoose.Schema({
  name: String,
  batch: String,
  profession: String,
  image: String,
  createdAt: { type: Date, default: Date.now }
}));

const Registration = mongoose.models.Registration || mongoose.model('Registration', new mongoose.Schema({
  fullName: String,
  studentId: String,
  department: String,
  phone: String,
  email: String,
  registeredAt: { type: Date, default: Date.now }
}));

const Donation = mongoose.models.Donation || mongoose.model('Donation', new mongoose.Schema({
  amount: String,
  donorName: String,
  donorEmail: String,
  paymentMethod: String,
  hasReceipt: Boolean,
  donatedAt: { type: Date, default: Date.now }
}));

const Subscription = mongoose.models.Subscription || mongoose.model('Subscription', new mongoose.Schema({
  email: String,
  subscribedAt: { type: Date, default: Date.now }
}));

// ==========================================
// 3. CLOUDINARY & MULTER UPLOADS
// ==========================================
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
} else {
  console.warn("Cloudinary environment variables missing! Using fallback for config");
}

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'munipuri_association',
    allowed_formats: ['jpg', 'png', 'jpeg', 'gif', 'pdf', 'webp']
  }
});
const upload = multer({ storage: storage });

// ==========================================
// 4. EXPRESS CONFIGURATION & VIEWS
// ==========================================
app.use(session({
  secret: 'munipuri-secret-key-1234',
  resave: false,
  saveUninitialized: true,
}));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../frontend/views'));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Admin authentication middleware
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

// ==========================================
// 5. PUBLIC API ROUTES
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    await Registration.create(req.body);
    res.json({ ok: true, message: 'Registration successful' });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/donate', upload.single('receipt'), async (req, res) => {
  try {
    const data = { ...req.body, hasReceipt: !!req.file };
    await Donation.create(data);
    res.json({ ok: true, message: 'Donation processed via MongoDB' });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

app.post('/api/newsletter', async (req, res) => {
  try {
    await Subscription.create({ email: req.body.email });
    res.json({ ok: true, message: 'Subscribed to newsletter' });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// ==========================================
// 6. ADMIN AUTH ROUTES
// ==========================================
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

// ==========================================
// 7. ADMIN DASHBOARD & API
// ==========================================
app.get('/admin/dashboard', requireAdmin, async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    const alumniList = await Alumni.find().sort({ createdAt: -1 });
    const gallery = await Gallery.find().sort({ createdAt: -1 });
    
    // Map _id to id for EJS templates to work without changes
    const mapWithId = (arr) => arr.map(doc => ({ ...doc.toObject(), id: doc._id.toString() }));
    
    res.render('admin-dashboard', { 
      events: mapWithId(events), 
      alumniList: mapWithId(alumniList), 
      gallery: mapWithId(gallery) 
    });
  } catch (err) {
    res.render('admin-dashboard', { events: [], alumniList: [], gallery: [] });
  }
});

app.post('/admin/api/events', requireAdmin, upload.single('attachment'), async (req, res) => {
  try {
    const newEvent = {
        title: req.body.title,
        date: req.body.date,
        time: req.body.time,
        location: req.body.location,
        description: req.body.description,
        attachment: req.file ? req.file.path : null, // uses Cloudinary secure_url
        isPast: false
    };
    await Event.create(newEvent);
    res.json({ ok: true, message: 'Event added successfully' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error saving event' });
  }
});

app.delete('/admin/api/events/:id', requireAdmin, async (req, res) => {
  try {
    await Event.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

app.post('/admin/api/gallery', requireAdmin, upload.single('image'), async (req, res) => {
  if(!req.file) return res.status(400).json({ ok: false, message: 'Image is required' });
  try {
    const newItem = {
      title: req.body.title || 'Untitled Image',
      image: req.file.path // uses Cloudinary secure_url
    };
    await Gallery.create(newItem);
    res.json({ ok: true, message: 'Gallery item added successfully' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error saving gallery image' });
  }
});

app.delete('/admin/api/gallery/:id', requireAdmin, async (req, res) => {
  try {
    await Gallery.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

app.post('/admin/api/alumni', requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const newAlumni = {
      name: req.body.name,
      batch: req.body.batch,
      profession: req.body.profession,
      image: req.file ? req.file.path : `https://ui-avatars.com/api/?name=${encodeURIComponent(req.body.name)}&background=random`
    };
    await Alumni.create(newAlumni);
    res.json({ ok: true, message: 'Alumni added successfully' });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Error saving alumni' });
  }
});

app.delete('/admin/api/alumni/:id', requireAdmin, async (req, res) => {
  try {
    await Alumni.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false });
  }
});

// ==========================================
// 8. FRONTEND PAGE RENDERING (EJS)
// ==========================================
app.get('/', (req, res) => res.render('index', { currentPath: '/' }));
app.get('/about', (req, res) => res.render('about', { currentPath: '/about' }));

app.get('/events', async (req, res) => {
  try {
    const events = await Event.find().sort({ createdAt: -1 });
    const upcoming = events.filter(e => !e.isPast);
    const past = events.filter(e => e.isPast);
    res.render('events', { upcoming, past, currentPath: '/events' });
  } catch (err) {
    res.render('events', { upcoming: [], past: [], currentPath: '/events' });
  }
});

app.get('/gallery', async (req, res) => {
  try {
    const gallery = await Gallery.find().sort({ createdAt: -1 });
    res.render('gallery', { gallery, currentPath: '/gallery' });
  } catch (err) {
    res.render('gallery', { gallery: [], currentPath: '/gallery' });
  }
});

app.get('/alumni', async (req, res) => {
  try {
    const alumniList = await Alumni.find().sort({ createdAt: -1 });
    res.render('alumni', { alumniList, currentPath: '/alumni' });
  } catch (err) {
    res.render('alumni', { alumniList: [], currentPath: '/alumni' });
  }
});

app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  if (req.originalUrl.includes('/api/')) {
    res.status(500).json({ ok: false, message: err.message || 'Internal Server Error' });
  } else {
    res.status(500).send('Internal Server Error: ' + err.message);
  }
});

// Fallback / 404
app.use((req, res) => {
  res.status(404).send('Page not found');
});

// ==========================================
// 9. START SERVER OR EXPORT FOR VERCEL
// ==========================================
if (require.main === module) {
  connectToDatabase().then(() => {
    app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
  });
}

module.exports = app;
