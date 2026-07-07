import { useRef, useCallback } from 'react'

/**
 * Simpan file PDF sebagai object URL di memory (tidak ke localStorage).
 * fileMap: { [rowId]: objectURL }
 * Object URL direvoke saat diganti / row dihapus untuk mencegah memory leak.
 */
export function useFileStore() {
  const fileMap = useRef({})

  const setFile = useCallback((rowId, file) => {
    // revoke URL lama kalau ada
    if (fileMap.current[rowId]) {
      URL.revokeObjectURL(fileMap.current[rowId])
    }
    if (file) {
      fileMap.current[rowId] = URL.createObjectURL(file)
    } else {
      delete fileMap.current[rowId]
    }
  }, [])

  const getFile = useCallback((rowId) => {
    return fileMap.current[rowId] || null
  }, [])

  const removeFile = useCallback((rowId) => {
    if (fileMap.current[rowId]) {
      URL.revokeObjectURL(fileMap.current[rowId])
      delete fileMap.current[rowId]
    }
  }, [])

  return { setFile, getFile, removeFile }
}
