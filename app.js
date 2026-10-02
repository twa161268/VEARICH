//-------------------------------------- MULAI APP.JS

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const stokistRoutes = require('./routes/stokistRoutes');
const reportRoutes = require('./routes/reportRoutes');
const authRoutes = require('./routes/authRoutes');
const mloginRoutes = require('./routes/mloginRoutes');
const transaksiRoutes = require('./routes/transaksiRoutes');
const registerRoutes = require('./routes/registerRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');
const asset = require('./utils/asset');
const app = express();

if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET belum diset pada environment production.');
}

// Vercel berjalan di belakang proxy. Ini diperlukan agar secure cookie
// bekerja dengan benar pada HTTPS production.
app.set('trust proxy', 1);

// Session disimpan di PostgreSQL agar tetap tersedia antar-request
// dan antar-instance/serverless function di Vercel.
app.use(
  session({
    store: new pgSession({
      pool: db.pool,
      schemaName: 'public',
      tableName: 'user_sessions',
      pruneSessionInterval: 900,
      disableTouch: true,
    }),

    secret: process.env.SESSION_SECRET || 'secret123',
    name: 'vch.sid',
    resave: false,
    saveUninitialized: false,

    cookie: {
      maxAge: 1000 * 60 * 60 * 8, // 8 jam
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    },
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Helper global untuk versioning asset JS/CSS berdasarkan Git commit.
app.locals.asset = asset;

//----------------Ini saat Menu terbuka-----------
app.get('/', (req, res) => {
  res.render('index', {
    isLogin: !!req.session.user,
    user: req.session.user || null,
  });
});

//-----------------------------------------------

// ROUTE HALAMAN DASHBOARD (penilaian.ejs)
//app.get('/penilaian', (req, res) => {
//  res.render('penilaian');
//});

// API ROUTES
app.use('/stokist', stokistRoutes);
app.use('/transaksi', transaksiRoutes);
app.use('/report', reportRoutes);
app.use('/mlogin', mloginRoutes);
app.use('/register', registerRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/', authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log(`Server berjalan di http://localhost:${PORT}`)
);
