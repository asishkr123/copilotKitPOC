import fs from 'fs/promises'
import path from 'path'

const STORAGE_DIR = path.join(process.cwd(), '.chat-threads')

/**
 * Ensure storage directory exists
 */
export async function ensureStorageDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true })
  } catch (err) {
    // Directory might already exist, ignore
  }
}

/**
 * Get file path for a thread
 */
function getThreadFilePath(threadId) {
  return path.join(STORAGE_DIR, `${threadId}.json`)
}

/**
 * Save messages for a thread
 * @param {string} threadId - Thread ID
 * @param {Array} messages - Array of message objects
 */
export async function saveMessages(threadId, messages) {
  try {
    await ensureStorageDir()
    const filePath = getThreadFilePath(threadId)
    await fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf-8')
  } catch (err) {
    console.error(`Failed to save messages for thread ${threadId}:`, err)
    throw err
  }
}

/**
 * Load messages for a thread
 * @param {string} threadId - Thread ID
 * @returns {Promise<Array>} Array of message objects
 */
export async function loadMessages(threadId) {
  try {
    const filePath = getThreadFilePath(threadId)
    const data = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    if (err.code === 'ENOENT') {
      // File doesn't exist, return empty array
      return []
    }
    console.error(`Failed to load messages for thread ${threadId}:`, err)
    throw err
  }
}

/**
 * List all saved thread IDs
 * @returns {Promise<Array<string>>} Array of thread IDs
 */
export async function listThreads() {
  try {
    await ensureStorageDir()
    const files = await fs.readdir(STORAGE_DIR)
    return files
      .filter(file => file.endsWith('.json'))
      .map(file => file.replace('.json', ''))
  } catch (err) {
    console.error('Failed to list threads:', err)
    return []
  }
}

/**
 * Delete a thread (optional, for cleanup)
 * @param {string} threadId - Thread ID to delete
 */
export async function deleteThread(threadId) {
  try {
    const filePath = getThreadFilePath(threadId)
    await fs.unlink(filePath)
    
    // Also delete context and metadata files
    const contextPath = path.join(STORAGE_DIR, `${threadId}-context.json`)
    const metaPath = path.join(STORAGE_DIR, `${threadId}-meta.json`)
    
    await fs.unlink(contextPath).catch(() => {})
    await fs.unlink(metaPath).catch(() => {})
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`Failed to delete thread ${threadId}:`, err)
      throw err
    }
  }
}

/**
 * Load messages with pagination
 * @param {string} threadId - Thread ID
 * @param {number} limit - Number of messages to return
 * @param {number} offset - Number of messages to skip from the end
 * @returns {Promise<Array>} Array of message objects
 */
export async function loadMessagesPaginated(threadId, limit = 5, offset = 0) {
  try {
    const allMessages = await loadMessages(threadId)
    
    // Get messages from the end (most recent first)
    const totalMessages = allMessages.length
    const startIndex = Math.max(0, totalMessages - offset - limit)
    const endIndex = totalMessages - offset
    
    return allMessages.slice(startIndex, endIndex)
  } catch (err) {
    console.error(`Failed to load paginated messages for thread ${threadId}:`, err)
    return []
  }
}

/**
 * Save thread metadata
 * @param {string} threadId - Thread ID
 * @param {Object} metadata - Metadata object
 */
export async function saveThreadMetadata(threadId, metadata) {
  try {
    await ensureStorageDir()
    const metaPath = path.join(STORAGE_DIR, `${threadId}-meta.json`)
    await fs.writeFile(metaPath, JSON.stringify(metadata, null, 2), 'utf-8')
  } catch (err) {
    console.error(`Failed to save metadata for thread ${threadId}:`, err)
  }
}

/**
 * Load thread metadata
 * @param {string} threadId - Thread ID
 * @returns {Promise<Object|null>} Metadata object or null
 */
export async function loadThreadMetadata(threadId) {
  try {
    const metaPath = path.join(STORAGE_DIR, `${threadId}-meta.json`)
    const data = await fs.readFile(metaPath, 'utf-8')
    return JSON.parse(data)
  } catch (err) {
    if (err.code === 'ENOENT') {
      return null
    }
    console.error(`Failed to load metadata for thread ${threadId}:`, err)
    return null
  }
}

/**
 * List all threads with metadata
 * @returns {Promise<Array>} Array of thread metadata objects
 */
export async function listThreadsWithMetadata() {
  try {
    const threadIds = await listThreads()
    const threadsWithMeta = await Promise.all(
      threadIds
        .filter(id => !id.endsWith('-context') && !id.endsWith('-meta'))
        .map(async (threadId) => {
          const meta = await loadThreadMetadata(threadId)
          const messages = await loadMessages(threadId)
          
          return {
            threadId,
            title: meta?.title || 'Untitled Chat',
            createdAt: meta?.createdAt || new Date().toISOString(),
            updatedAt: meta?.updatedAt || new Date().toISOString(),
            messageCount: messages.length,
            lastMessage: messages.length > 0 ? messages[messages.length - 1].content : null
          }
        })
    )
    
    // Sort by updatedAt (most recent first)
    return threadsWithMeta.sort((a, b) => 
      new Date(b.updatedAt) - new Date(a.updatedAt)
    )
  } catch (err) {
    console.error('Failed to list threads with metadata:', err)
    return []
  }
}

/**
 * Fork a thread (copy messages to new thread)
 * @param {string} sourceThreadId - Source thread ID
 * @param {string} newThreadId - New thread ID
 * @returns {Promise<number>} Number of messages copied
 */
export async function forkThread(sourceThreadId, newThreadId) {
  try {
    const sourceMessages = await loadMessages(sourceThreadId)
    await saveMessages(newThreadId, sourceMessages)
    
    // Copy context if it exists
    const contextPath = path.join(STORAGE_DIR, `${sourceThreadId}-context.json`)
    const newContextPath = path.join(STORAGE_DIR, `${newThreadId}-context.json`)
    
    try {
      const contextData = await fs.readFile(contextPath, 'utf-8')
      await fs.writeFile(newContextPath, contextData, 'utf-8')
    } catch (err) {
      // Context file might not exist, that's okay
    }
    
    return sourceMessages.length
  } catch (err) {
    console.error(`Failed to fork thread ${sourceThreadId}:`, err)
    throw err
  }
}
