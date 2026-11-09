# Perbaikan koneksi database dan navigasi Back/Forward

## Yang diubah
- `db.js`: batas koneksi per proses dibuat konservatif (default 3, dapat diatur dengan `DB_POOL_MAX`), timeout koneksi 10 detik, idle timeout 10 detik, daur ulang client setelah 7.500 penggunaan, serta log antrean pool tanpa mencetak kredensial.
- `public/js/loading.js`: reset overlay dan penghitung request pada event `pageshow`/`pagehide` agar halaman yang dipulihkan dari Back/Forward Cache tidak tertutup overlay loading lama.
- `.env` berisi kredensial asli tidak disertakan dalam ZIP. Gunakan `.env.example` sebagai contoh.

## Wajib dilakukan sebelum menjalankan
1. Di Supabase buka **Project Settings > Database > Connection string**.
2. Pilih **Transaction pooler** dan salin URI lengkapnya. Pastikan port `6543`.
3. Isi `DATABASE_URL2` pada `.env` lokal dan Environment Variables Vercel dengan URI tersebut. Jangan mengubah host/user berdasarkan tebakan; gunakan URI yang ditampilkan dashboard proyek.
4. Isi `SESSION_SECRET` dengan string acak minimal 32 karakter.
5. Restart aplikasi lokal dan redeploy Vercel setelah Environment Variables diperbarui.

## Catatan kompatibilitas
Aplikasi menggunakan transaksi `BEGIN/COMMIT/ROLLBACK` dan advisory transaction lock (`pg_advisory_xact_lock`). Keduanya berada dalam cakupan transaksi dan sesuai untuk Transaction Pooler. Jangan menggunakan fitur yang memerlukan state session-level PostgreSQL pada koneksi yang sama. Lakukan pengujian seluruh alur inventory, register, pembayaran, dan laporan setelah mengganti pooler.

## Batasan
`DB_POOL_MAX=3` adalah batas per proses Node.js, bukan batas global. Jika beberapa proses/instance berjalan, total koneksi client tetap merupakan penjumlahan seluruh proses. Jangan menaikkan nilai ini tanpa memeriksa jumlah instance dan batas pooler Supabase.
