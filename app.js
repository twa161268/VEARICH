//-------------------------------------- MULAI APP.JS

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const nilaiRoutes = require('./routes/nilaiRoutes');
const nilaiidkRoutes = require('./routes/nilaiidkRoutes');
const stokistRoutes = require('./routes/stokistRoutes');
const simpanRoutes = require('./routes/simpanRoutes');
const reportRoutes = require('./routes/reportRoutes');
const authRoutes = require('./routes/authRoutes');
const mloginRoutes = require('./routes/mloginRoutes');
const reffnilaiRoutes = require('./routes/reffnilaiRoutes');
const pinregRoutes = require('./routes/pinregRoutes');
const pembayaranRoutes = require('./routes/pembayaranRoutes');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const db = require('./db');
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

//----------------Ini saat Menu terbuka-----------
app.get('/', (req, res) => {
  res.render('index', {
    isLogin: !!req.session.user,
    user: req.session.user || null,
  });
});

//-----------------------------------------------

// ROUTE HALAMAN DASHBOARD (penilaian.ejs)
app.get('/penilaian', (req, res) => {
  res.render('penilaian');
});

// API ROUTES
app.use('/nilai', nilaiRoutes);
app.use('/stokist', stokistRoutes);
app.use('/pinreg', pinregRoutes);
app.use('/pembayaran', pembayaranRoutes);
//app.use("/refnilai", refnilaiRoutes);
app.use('/nilaiidk', nilaiidkRoutes);
app.use('/simpan', simpanRoutes);
app.use('/report', reportRoutes);
app.use('/mlogin', mloginRoutes);
app.use('/reffnilai', reffnilaiRoutes);
app.use('/', authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () =>
  console.log(`Server berjalan di http://localhost:${PORT}`)
);
