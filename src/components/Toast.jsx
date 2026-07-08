import { useEffect, useState } from 'react'

export default function Toast({ message, type = 'success', onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setVisible(true), 10)
    const t2 = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 300)
    }, 2500)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onClose])

  const base = 'fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl text-sm font-semibold transition-all duration-300'
  const color = type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
  const anim = visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'

  return (
    <div className={`${base} ${color} ${anim}`}>
      {type === 'success' ? (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span>{message}</span>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }}
        className="ml-2 opacity-70 hover:opacity-100 text-lg leading-none">&times;</button>
    </div>
  )
}

export function useToast() {
  const [toast, setToast] = useState(null)
  const showToast = (message, type = 'success') => setToast({ message, type })
  const closeToast = () => setToast(null)
  return { toast, showToast, closeToast }
}
