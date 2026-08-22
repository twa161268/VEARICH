/*
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { isAuth } = require('./middleware/auth');

const nilaiRoutes = require('./routes/nilaiRoutes');
const nilaiidkRoutes = require('./routes/nilaiidkRoutes');
const stokistRoutes = require('./routes/stokistRoutes');
const simpanRoutes = require('./routes/simpanRoutes');
const reportRoutes = require('./routes/reportRoutes');
const authRoutes = require('./routes/authRoutes');
const mloginRoutes = require('./routes/mloginRoutes');
const reffnilaiRoutes = require('./routes/reffnilaiRoutes');
const pinregRoutes = require('./routes/pinregRoutes');
const session = require('express-session');
const app = express();

// ✅ PASANG SESSION DI SINI (SEBELUM ROUTE)
app.use(
  session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: true,
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


*/
//-------------------------------------- MULAI APP.JS

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { isAuth } = require('./middleware/auth');

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
const app = express();

// ✅ PASANG SESSION DI SINI (SEBELUM ROUTE)
app.use(
  session({
    secret: 'secret123',
    resave: false,
    saveUninitialized: true,
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
