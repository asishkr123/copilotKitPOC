import { NextResponse } from 'next/server'
import { 
  listThreadsWithMetadata, 
  saveThreadMetadata, 
  deleteThread as deleteThreadFile 
} from '@/lib/storage/filesystem'

/**
 * GET /api/threads
 * List all threads with metadata
 */
export async function GET(req) {
  try {
    const threads = await listThreadsWithMetadata()
    
    return NextResponse.json({
      threads,
      count: threads.length
    })
  } catch (error) {
    console.error('[Threads API] Error listing threads:', error)
    return NextResponse.json(
      { error: 'Failed to list threads' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/threads
 * Create a new thread
 */
export async function POST(req) {
  try {
    const {  title = 'New Chat' } = await req.json()
    
    // Generate new thread ID
    const threadId = `thread-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    
    // Create metadata
    await saveThreadMetadata(threadId, {
      title,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messageCount: 0
    })
    
    return NextResponse.json({
      threadId,
      title,
      success: true
    })
  } catch (error) {
    console.error('[Threads API] Error creating thread:', error)
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/threads?thread Id=xxx
 * Delete a thread
 */
export async function DELETE(req) {
  const { searchParams } = new URL(req.url)
  const threadId = searchParams.get('threadId')
  
  if (!threadId) {
    return NextResponse.json(
      { error: 'threadId parameter is required' },
      { status: 400 }
    )
  }
  
  try {
    await deleteThreadFile(threadId)
    
    return NextResponse.json({
      success: true,
      threadId
    })
  } catch (error) {
    console.error('[Threads API] Error deleting thread:', error)
    return NextResponse.json(
      { error: 'Failed to delete thread' },
      { status: 500 }
    )
  }
}

/**
 * PATCH /api/threads?threadId=xxx
 * Update thread metadata
 */
export async function PATCH(req) {
  const { searchParams } = new URL(req.url)
  const threadId = searchParams.get('threadId')
  
  if (!threadId) {
    return NextResponse.json(
      { error: 'threadId parameter is required' },
      { status: 400 }
    )
  }
  
  try {
    const updates = await req.json()
    
    // Merge with existing metadata
    const metadata = {
      ...updates,
      updatedAt: new Date().toISOString()
    }
    
    await saveThreadMetadata(threadId, metadata)
    
    return NextResponse.json({
      success: true,
      threadId,
      metadata
    })
  } catch (error) {
    console.error('[Threads API] Error updating thread:', error)
    return NextResponse.json(
      { error: 'Failed to update thread' },
      { status: 500 }
    )
  }
}
