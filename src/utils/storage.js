export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

export function saveToStorage(key, rows) {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch {
    console.warn('localStorage penuh saat menyimpan', key)
  }
}

export function loadFromStorage(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || []
  } catch {
    return []
  }
}
