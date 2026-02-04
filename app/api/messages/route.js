import { NextResponse } from 'next/server'
import {  loadMessages, loadMessagesPaginated, listThreads, saveMessages } from '../../../lib/storage/filesystem'

/**
 * GET /api/messages?threadId=xxx&limit=5&offset=0
 * Load messages for a specific thread with pagination
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const threadId = searchParams.get('threadId')
  const limit = parseInt(searchParams.get('limit') || '5')
  const offset = parseInt(searchParams.get('offset') || '0')

  if (!threadId) {
    return NextResponse.json(
      { error: 'threadId parameter is required' },
      { status: 400 }
    )
  }

  try {
    // Use pagination if limit is provided, otherwise load all
    const messages = limit > 0 
      ? await loadMessagesPaginated(threadId, limit, offset)
      : await loadMessages(threadId)
    
    // Check if there are more messages
    const hasMore = messages.length === limit
    
    return NextResponse.json({
      threadId,
      messages,
      count: messages.length,
      hasMore
    })
  } catch (error) {
    console.error('Failed to load messages:', error)
    return NextResponse.json(
      { error: 'Failed to load messages' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/messages
 * List all available threads
 */
export async function POST(req) {
  try {
    const threads = await listThreads()
    return NextResponse.json({
      threads,
      count: threads.length
    })
  } catch (error) {
    console.error('Failed to list threads:', error)
    return NextResponse.json(
      { error: 'Failed to list threads' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/messages
 * Save messages for a thread (called from frontend)
 */
export async function PUT(req) {
  try {
    const { threadId, messages } = await req.json()

    if (!threadId) {
      return NextResponse.json(
        { error: 'threadId is required' },
        { status: 400 }
      )
    }

    if (!Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'messages must be an array' },
        { status: 400 }
      )
    }

    await saveMessages(threadId, messages)
    
    return NextResponse.json({
      success: true,
      threadId,
      count: messages.length
    })
  } catch (error) {
    console.error('Failed to save messages:', error)
    return NextResponse.json(
      { error: 'Failed to save messages' },
      { status: 500 }
    )
  }
}
