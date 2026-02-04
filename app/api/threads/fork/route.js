import { NextResponse } from 'next/server'
import { 
  forkThread as forkThreadFile, 
  loadThreadMetadata,
  saveThreadMetadata 
} from '@/lib/storage/filesystem'

/**
 * POST /api/threads/fork
 * Fork/copy a thread to create a new independent thread
 * Body: { sourceThreadId: string, title?: string }
 */
export async function POST(req) {
  try {
    const { sourceThreadId, title } = await req.json()
    
    if (!sourceThreadId) {
      return NextResponse.json(
        { error: 'sourceThreadId is required' },
        { status: 400 }
      )
    }
    
    // Generate new thread ID
    const newThreadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    
    // Fork the messages and context
    const messageCount = await forkThreadFile(sourceThreadId, newThreadId)
    
    // Get source metadata for title
    const sourceMeta = await loadThreadMetadata(sourceThreadId)
    
    // Create metadata for forked thread
    await saveThreadMetadata(newThreadId, {
      title: title || `Copy of ${sourceMeta?.title || 'Shared Chat'}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount,
      forkedFrom: sourceThreadId
    })
    
    console.log(`[Fork API] Forked thread ${sourceThreadId} → ${newThreadId} (${messageCount} messages)`)
    
    return NextResponse.json({
      success: true,
      newThreadId,
      sourceThreadId,
      messageCount
    })
  } catch (error) {
    console.error('[Fork API] Error forking thread:', error)
    return NextResponse.json(
      { error: 'Failed to fork thread' },
      { status: 500 }
    )
  }
}
