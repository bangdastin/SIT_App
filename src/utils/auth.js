/**
 * Baca semua akun dari environment variables (VITE_USER_xxx=password).
 * Format key: VITE_USER_<username> = <password>
 *
 * Catatan keamanan:
 * - Ini adalah autentikasi frontend-only untuk aplikasi demo/intranet.
 * - Credentials terbaca di browser — JANGAN gunakan untuk sistem produksi
 *   yang membutuhkan keamanan tinggi. Untuk produksi gunakan backend auth.
 */
function buildAccountMap() {
  const accounts = {}
  const prefix   = 'VITE_USER_'
  Object.entries(import.meta.env).forEach(([key, val]) => {
    if (key.startsWith(prefix)) {
      const username = key.slice(prefix.length).toLowerCase()
      accounts[username] = val
    }
  })
  return accounts
}

const ACCOUNTS = buildAccountMap()

export function validateLogin(username, password) {
  const key  = username.trim().toLowerCase()
  const pass = ACCOUNTS[key]
  return pass !== undefined && pass === password.trim()
}

export function getAccountList() {
  return Object.keys(ACCOUNTS)
}
