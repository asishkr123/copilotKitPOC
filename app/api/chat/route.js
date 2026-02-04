
import {
  CopilotRuntime,
  InMemoryAgentRunner,
  createCopilotEndpointSingleRoute
} from '@copilotkitnext/runtime'
import { BuiltInAgent, defineTool } from '@copilotkitnext/agent'
import { z } from 'zod'
import { createMcpAgentTools } from '../../mcp/mcpAgentTools'
import { saveMessages, loadMessages } from '../../../lib/storage/filesystem'
import {
  generateContext,
  saveContext,
  loadContext,
  buildContextPrompt
} from '../../../lib/context/generator'

/* -------------------------------------------------- */
/* Message type inference                             */
/* -------------------------------------------------- */
function inferMessageType(msg) {
  if (msg.role === 'tool') return 'ResultMessage'
  if (msg.role === 'assistant' && msg.toolCalls?.length > 0) {
    return 'ActionExecutionMessage'
  }
  return 'TextMessage'
}

/* -------------------------------------------------- */
/* SYSTEM PROMPT                                     */
/* -------------------------------------------------- */
 const MAIA_SYSTEM_PROMPT = `
// You are MAIA — an intelligent, tool-driven assistant.
// Your primary responsibility is to:
// 1. Understand the user's intent
// 2. Decide whether tools are required
// 3. Select the correct tool(s)
// 4. Execute tools in the correct order
// 5. Correctly chain tool outputs as inputs to subsequent tools
// 6. Render responses using the UI components suggested by the tools
// You MUST follow the rules below exactly.
// ───────────────────────────────────────
// CORE OPERATING PRINCIPLES
// ────────────────────────────────────────
// 1. TOOL-FIRST THINKING
// - If a user question involves data, metrics, rankings, trends, comparisons, analysis, or facts:
//   → You MUST attempt to use an appropriate tool.
// - Do NOT answer data questions from assumptions or memory.
// 2. INTENT → PLAN → EXECUTE
// - First infer the user's intent.
// - Then decide:
//   a) Which tool(s) are required
//   b) Whether tools must be called sequentially
// - If multiple tools are required, create an implicit execution plan and follow it step-by-step.
// 3. TOOL CHAINING (CRITICAL)
// - When calling multiple tools:
//   - ALWAYS extract required parameters from previous tool responses.
//   - NEVER invent, guess, or transform identifiers unless explicitly instructed.
//   - Reuse exact values (IDs, keys, names, componentId, etc.) returned by tools.

// Example:
// - Tool A returns: { categoryId: "abc123" }
// - Tool B requires categoryId
// → You MUST pass "abc123" exactly.

// If a required parameter is missing:
// - STOP
// - Ask the user for clarification OR explain what information is unavailable.

// ────────────────────────────────────────
// MCP RESPONSE & RENDERING CONTRACT (CRITICAL)
// ────────────────────────────────────────
// All MCP tools return responses in the following shape:
// {
//   componentId: string,
//   rawData: object | null,
//   meta: object | null
// }
// RULES:
// 1. You MUST ALWAYS use the componentId returned by the tool.
//    - NEVER override it
//    - NEVER substitute it
//    - NEVER infer a different component
// 2. componentId determines HOW the response is rendered.
//    You are responsible only for NORMALIZING the rawData.
// 3. If rawData is null, empty, or invalid:
//    - Fallback to a text-based response using componentId = "text-plain"
//    - Explain clearly and helpfully what data is missing.
// 4. USER-REQUESTED CHART TYPE OVERRIDE (EXCEPTION):
//    - If the user explicitly asks for a specific chart type (e.g., "treemap", "line chart", "bar chart"),
//      you MUST render that chart type and not anything else.
//    - In that case, call renderChartSpec with spec.type set to the requested chart type.
// ────────────────────────────────────────
// DATA NORMALIZATION RULES
// ────────────────────────────────────────
// Normalize data ONLY — do not reinterpret it.
// • chart-* components:
//   Normalize to:
//   {
//     title: string,
//     data: Array<{ x: string, y: number }>
//   }

// • kpi-single:
//   Normalize to:
//   {
//     label: string,
//     value: number
//   }

// • text-plain:
//   Normalize to:
//   {
//     text: string
//   }

// - Always provide a meaningful title for charts.
//   Use meta.title if provided, otherwise generate a descriptive title.
// ───────────────────────────────────────
// MULTI-TOOL & MULTI-COMPONENT RESPONSES
// ────────────────────────────────────────
// If multiple tool calls are required:
// 1. Execute them in the correct order.
// 2. Normalize each tool response independently.
// 3. Decide layout based on user intent:
//    - Comparisons → "sideBySide"
//    - Combined insights → "stacked"
//    - Default → "stacked"

// Then call:
// - renderMultiComponent(layout, components[])
// Each component MUST preserve its original componentId.
// ────────────────────────────────────────
// ERROR HANDLING & UNCERTAINTY
// ────────────────────────────────────────
// - If a tool fails:
//   - Do NOT hallucinate results.
//   - Explain what failed and why.
// - If user intent is ambiguous:
//   - Ask ONE clarifying question before calling tools.
// - If requested data does not exist:
//   - Clearly state what is available instead.
// ────────────────────────────────────────
// FINAL RESPONSE RULES
// ────────────────────────────────────────
// 1. Always render data via components when tools are used.
// 2. After rendering, briefly explain what the user is seeing.
// 3. NEVER say:
//    - "I cannot generate this component"
//    - "The chart could not be rendered"
// 4. Be precise, factual, and deterministic.
// 5. Never expose internal reasoning or tool selection logic.
// You are not a chatbot.
// You are a data execution and rendering agent.`

/* -------------------------------------------------- */
/* UI RENDER TOOL                                    */
/* -------------------------------------------------- */
const renderComponentTool = defineTool({
  name: 'renderComponent',
  description:
    'Renders a UI component. Normalize raw MCP data before calling.',
  parameters: z.object({
    componentId: z.string(),
    componentData: z.any()
  }),
  execute: async ({ componentId, componentData }) => {
    return {
      componentId,
      rawData: componentData,
      meta: componentData?.meta || {}
    }
  }
})

/* -------------------------------------------------- */
/* POST HANDLER                                      */
/* -------------------------------------------------- */
export async function POST(req) {
  const { tools: mcpTools, close } = await createMcpAgentTools()

  const url = new URL(req.url)
  const threadId =
    url.searchParams.get('threadId') ||
    req.headers.get('x-thread-id') ||
    'default'

  let body = null
  try {
    body = await req.clone().json()
  } catch {}

  /* ---------- Load rolling context ---------- */
  const existingContext = await loadContext(threadId).catch(() => null)
  const systemPrompt = buildContextPrompt(
    MAIA_SYSTEM_PROMPT,
    existingContext
  )

  const agent = new BuiltInAgent({
    model: 'openai/gpt-4o-mini',
    prompt: systemPrompt,
    maxSteps: 7,
    tools: [...mcpTools, renderComponentTool]
  })

  agent.description = 'Maia, data assistant for the US Dashboard'

  const runtime = new CopilotRuntime({
    agents: { default: agent },
    runner: new InMemoryAgentRunner()
  })

  const singleRoute = createCopilotEndpointSingleRoute({
    runtime,
    basePath: '/api/chat'
  })

  const METHODS = ['info', 'agent/run', 'agent/connect', 'agent/stop', 'transcribe']

  let closeDeferred = false

  try {
    if (body?.method && METHODS.includes(body.method)) {
      const res = await singleRoute.fetch(req)

      /* ---------- STREAMING RESPONSE ---------- */
      if (res?.body && typeof res.body.getReader === 'function') {
        closeDeferred = true

        const reader = res.body.getReader()

        const readable = new ReadableStream({
          async start(controller) {
            while (true) {
              const { done, value } = await reader.read()
              if (done) break
              controller.enqueue(value)
            }

            controller.close()

            /* ---------- SAVE MESSAGES & CONTEXT ---------- */
            if (body.method === 'agent/run' && body?.body?.messages?.length) {
              const finalMessages = body.body.messages
              
              // Serialize messages with type information
              const messagesToSave = finalMessages.map(msg => ({
                id: msg.id,
                role: msg.role,
                content: msg.content,
                toolCalls: msg.toolCalls,
                toolCallId: msg.toolCallId,
                createdAt: msg.createdAt || new Date().toISOString(),
                type: inferMessageType(msg)
              }))

              console.log('[Chat API] Saving', messagesToSave.length, 'messages to thread', threadId)
              await saveMessages(threadId, messagesToSave).catch(err =>
                console.error('[Chat API] Failed to save messages:', err)
              )

              /* ---------- INCREMENTAL CONTEXT GENERATION ---------- */
              // Use last 5 messages to generate/update context
              const last5Messages = messagesToSave.slice(-5)
              const existingContext = await loadContext(threadId).catch(() => null)
              
              const newContext = await generateContext(last5Messages, existingContext)
              await saveContext(threadId, newContext).catch(err =>
                console.error('[Chat API] Failed to save context:', err)
              )
              
              console.log('[Chat API] ✅ Messages and context saved for thread:', threadId)
            }

            await close().catch(() => {})
          }
        })

        return new Response(readable, {
          status: res.status,
          headers: res.headers
        })
      }

      return res
    }

    return new Response(
      JSON.stringify({
        error: 'invalid_request',
        message: 'Invalid Copilot method'
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    )
  } finally {
    if (!closeDeferred) {
      await close()
    }
  }
}
