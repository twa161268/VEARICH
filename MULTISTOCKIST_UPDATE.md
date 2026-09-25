# Multi-Stockist Access Scope Update

Baseline: `app_22092026(1).zip`

## Access rules
- `role=admin`: global access to all stockists and warehouses.
- `role=stokist`: scope is always `users.stkid`.
- ADMIN `users.stkid` is NULL.
- A transaction must still contain a real `stkid`; ADMIN selects it when creating a transaction.
- Inventory resolves `stkid -> sb_gudang -> gudang_id`.

## Database migration
Run:

```sql
ALTER TABLE public.users
  ALTER COLUMN stkid DROP NOT NULL;

UPDATE public.users
SET stkid = NULL
WHERE LOWER(role) = 'admin';
```

The same SQL is included in:
`sql/20260922_multistockist_access.sql`

## Updated areas
- Pembelian PIN (`/pinreg`)
- Pembelian PIN & Pengiriman / Register (`/transaksi`)
- Inventory context for ADMIN / STOCKIST
- Inventory transactions
- Inventory stock balance / movement / reports / pickup
- Inventory warehouse master scope
- Product master is global and ADMIN-managed
- Global inventory master mutation is ADMIN-only, except warehouse can be managed within the STOCKIST scope
- User management allows ADMIN without STKID and requires STKID for STOCKIST users

## Important
Run the SQL migration before creating/logging in ADMIN accounts with `stkid=NULL`.

The application source and UI retain the existing project structure and table names.

## Update 22 Sep 2026 — Registrasi Member mengikuti scope Pembelian PIN

- Halaman **Registrasi Member** sekarang memakai pola scope stockist yang sama dengan **Pembelian PIN**.
- **ADMIN** dapat melihat `Semua Stockist` atau memilih satu stockist melalui filter.
- **STOCKIST** otomatis dibatasi ke `req.session.stkid`; tidak dapat memilih stockist lain melalui query/filter.
- Saat membuka Register No, stockist berasal dari `tr_kirim.stkid` (transaksi PIN yang menjadi sumber PIN). Tidak ada input stockist baru di form registrasi member karena registrasi member melekat pada Register No tersebut.
- ADMIN dapat membuka Register No milik stockist mana pun; STOCKIST hanya dapat membuka Register No miliknya sendiri.
- Server-side scope diterapkan pada list/detail/lock transaksi registrasi.
- Data stockist dan nama stockist ditampilkan pada daftar dan detail registrasi.
