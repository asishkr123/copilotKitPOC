import { v4 as uuidv4 } from 'uuid'

/**
 * Thread Management Utilities (Client-side)
 * Handles thread creation, switching, and localStorage persistence
 */

const THREADS_KEY = 'maia-threads'
const CURRENT_THREAD_KEY = 'maia-current-thread'

/**
 * Legacy function for backwards compatibility
 */
export function getOrCreateThreadId() {
  return getCurrentThreadId() || createNewThread()
}

/**
 * Get all threads from localStorage
 */
export function getThreads() {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(THREADS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (err) {
    console.error('[Thread Utils] Error loading threads:', err)
    return []
  }
}

/**
 * Save threads to localStorage
 */
export function saveThreads(threads) {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(THREADS_KEY, JSON.stringify(threads))
  } catch (err) {
    console.error('[Thread Utils] Error saving threads:', err)
  }
}

/**
 * Get current thread ID
 */
export function getCurrentThreadId() {
  if (typeof window === 'undefined') return null
  
  // Check URL params first (for shared threads)
  const params = new URLSearchParams(window.location.search)
  const sharedThread = params.get('shareThread')
  if (sharedThread) {
    return sharedThread
  }
  
  // Then check localStorage
  return localStorage.getItem(CURRENT_THREAD_KEY)
}

/**
 * Set current thread ID
 */
export function setCurrentThreadId(threadId) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(CURRENT_THREAD_KEY, threadId)
  
  // Update thread list with last accessed time
  const threads = getThreads()
  const existingIndex = threads.findIndex(t => t.id === threadId)
  
  if (existingIndex >= 0) {
    threads[existingIndex].lastAccessed = new Date().toISOString()
  } else {
    threads.push({
      id: threadId,
      name: `Thread ${threads.length + 1}`,
      created: new Date().toISOString(),
      lastAccessed: new Date().toISOString()
    })
  }
  
  saveThreads(threads)
}

/**
 * Create a new thread
 */
export function createNewThread() {
  const newThreadId = uuidv4()
  
  const threads = getThreads()
  threads.push({
    id: newThreadId,
    name: `Thread ${threads.length + 1}`,
    created: new Date().toISOString(),
    lastAccessed: new Date().toISOString()
  })
  
  saveThreads(threads)
  setCurrentThreadId(newThreadId)
  
  return newThreadId
}

/**
 * Delete a thread
 */
export function deleteThread(threadId) {
  const threads = getThreads()
  const filtered = threads.filter(t => t.id !== threadId)
  saveThreads(filtered)
  
  // If deleting current thread, switch to most recent
  if (getCurrentThreadId() === threadId) {
    const mostRecent = filtered.sort((a, b) => 
      new Date(b.lastAccessed) - new Date(a.lastAccessed)
    )[0]
    
    if (mostRecent) {
      setCurrentThreadId(mostRecent.id)
    } else {
      // No threads left, create new one
      createNewThread()
    }
  }
}

/**
 * Rename a thread
 */
export function renameThread(threadId, newName) {
  const threads = getThreads()
  const thread = threads.find(t => t.id === threadId)
  
  if (thread) {
    thread.name = newName
    saveThreads(threads)
  }
}

/**
 * Fork/Share a thread (creates a copy with new ID)
 */
export async function forkThread(sourceThreadId, title) {
  try {
    // Call backend API to fork the thread (server generates new ID)
    const response = await fetch('/api/threads/fork', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sourceThreadId,
        title: title || 'Shared Thread (copy)'
      })
    })
    
    if (!response.ok) {
      throw new Error('Failed to fork thread')
    }
    
    const data = await response.json()
    const newThreadId = data.newThreadId
    
    // Add to local thread list
    const threads = getThreads()
    threads.push({
      id: newThreadId,
      name: title || 'Shared Thread (copy)',
      created: new Date().toISOString(),
      lastAccessed: new Date().toISOString(),
      forkedFrom: sourceThreadId
    })
    
    saveThreads(threads)
    setCurrentThreadId(newThreadId)
    
    return newThreadId
  } catch (err) {
    console.error('[Thread Utils] Error forking thread:', err)
    throw err
  }
}

/**
 * Get shareable URL for a thread
 */
export function getShareableUrl(threadId) {
  if (typeof window === 'undefined') return ''
  
  const url = new URL(window.location.href)
  url.searchParams.set('shareThread', threadId)
  return url.toString()
}

/**
 * Check if current page has a shared thread and handle it
 */
export async function handleSharedThread() {
  if (typeof window === 'undefined') return null
  
  const params = new URLSearchParams(window.location.search)
  const sharedThreadId = params.get('shareThread')
  
  if (!sharedThreadId) return null
  
  // Check if thread already exists in localStorage
  const threads = getThreads()
  const exists = threads.find(t => t.id === sharedThreadId)
  
  if (exists) {
    // Thread already in our list, just switch to it
    setCurrentThreadId(sharedThreadId)
    return sharedThreadId
  }
  
  // New shared thread - fork it to create our own copy
  try {
    const newThreadId = await forkThread(sharedThreadId)
    
    // Clear URL parameter after forking
    const url = new URL(window.location.href)
    url.searchParams.delete('shareThread')
    window.history.replaceState({}, '', url.toString())
    
    return newThreadId
  } catch (err) {
    console.error('[Thread Utils] Error handling shared thread:', err)
    return null
  }
}
