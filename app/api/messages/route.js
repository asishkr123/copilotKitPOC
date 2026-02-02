import { NextResponse } from 'next/server'
import { loadMessages, listThreads, saveMessages } from '../../../lib/storage/filesystem'

/**
 * GET /api/messages?threadId=xxx
 * Load messages for a specific thread
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const threadId = searchParams.get('threadId')

  if (!threadId) {
    return NextResponse.json(
      { error: 'threadId parameter is required' },
      { status: 400 }
    )
  }

  try {
    const messages = await loadMessages(threadId)
    return NextResponse.json({
      threadId,
      messages,
      count: messages.length
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
