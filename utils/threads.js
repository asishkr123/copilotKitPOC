import { v4 as uuidv4 } from 'uuid'

export function getOrCreateThreadId() {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem('maia-thread-id')
  if (stored) return stored

  const id = uuidv4()
  localStorage.setItem('maia-thread-id', id)
  return id
}
