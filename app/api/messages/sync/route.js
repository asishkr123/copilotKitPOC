import { loadMessages, saveMessages } from '../../../../lib/storage/filesystem'
import { generateContext, saveContext, loadContext } from '../../../../lib/context/generator'

/**
 * Message type inference
 */
function inferMessageType(msg) {
  if (msg.role === 'tool') return 'ResultMessage'
  if (msg.role === 'assistant' && msg.toolCalls?.length > 0) {
    return 'ActionExecutionMessage'
  }
  return 'TextMessage'
}

/**
 * POST /api/messages/sync
 * Endpoint for frontend to sync complete conversation including assistant responses
 */
export async function POST(req) {
  try {
    const { threadId, messages } = await req.json()

    if (!threadId || !messages?.length) {
      return new Response(
        JSON.stringify({ error: 'Missing threadId or messages' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Serialize messages with type information
    const incomingMessages = messages.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      toolCalls: msg.toolCalls,
      toolCallId: msg.toolCallId,
      createdAt: msg.createdAt || new Date().toISOString(),
      type: inferMessageType(msg)
    }))

    const existingMessages = await loadMessages(threadId)
    const existingIds = new Set(
      existingMessages.map(m => m.id).filter(Boolean)
    )

    const mergedMessages = [...existingMessages]
    for (const msg of incomingMessages) {
      if (msg.id && existingIds.has(msg.id)) continue
      mergedMessages.push(msg)
      if (msg.id) existingIds.add(msg.id)
    }

    console.log('[Sync API] Saving', mergedMessages.length, 'messages for thread', threadId)

    // Save messages
    await saveMessages(threadId, mergedMessages)

    // Generate and save context from last 5 messages
    const last5Messages = mergedMessages.slice(-5)
    const existingContext = await loadContext(threadId).catch(() => null)
    const newContext = await generateContext(last5Messages, existingContext)
    await saveContext(threadId, newContext)

    console.log('[Sync API] ✅ Messages and context synced for thread:', threadId)

    return new Response(
      JSON.stringify({ success: true, saved: mergedMessages.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Sync API] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to sync messages' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
