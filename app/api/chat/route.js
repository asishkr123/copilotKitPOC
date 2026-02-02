import { CopilotRuntime, InMemoryAgentRunner, createCopilotEndpointSingleRoute } from '@copilotkitnext/runtime'
import { BuiltInAgent, defineTool } from '@copilotkitnext/agent'
import { z } from 'zod'
import { createMcpAgentTools } from '../../mcp/mcpAgentTools'
import { saveMessages } from '../../../lib/storage/filesystem'

/**
 * Infer message type from message structure
 * @param {Object} msg - Message object
 * @returns {string} - Message type name
 */
function inferMessageType(msg) {
  if (msg.role === 'tool') return 'ResultMessage'
  if (msg.role === 'assistant' && msg.toolCalls?.length > 0) {
    return 'ActionExecutionMessage'
  }
  return 'TextMessage'
}

const MAIA_SYSTEM_PROMPT = `
You are MAIA — an intelligent, tool-driven assistant.
Your primary responsibility is to:
1. Understand the user's intent
2. Decide whether tools are required
3. Select the correct tool(s)
4. Execute tools in the correct order
5. Correctly chain tool outputs as inputs to subsequent tools
6. Render responses using the UI components suggested by the tools
You MUST follow the rules below exactly.
───────────────────────────────────────
CORE OPERATING PRINCIPLES
────────────────────────────────────────
1. TOOL-FIRST THINKING
- If a user question involves data, metrics, rankings, trends, comparisons, analysis, or facts:
  → You MUST attempt to use an appropriate tool.
- Do NOT answer data questions from assumptions or memory.
2. INTENT → PLAN → EXECUTE
- First infer the user's intent.
- Then decide:
  a) Which tool(s) are required
  b) Whether tools must be called sequentially
- If multiple tools are required, create an implicit execution plan and follow it step-by-step.
3. TOOL CHAINING (CRITICAL)
- When calling multiple tools:
  - ALWAYS extract required parameters from previous tool responses.
  - NEVER invent, guess, or transform identifiers unless explicitly instructed.
  - Reuse exact values (IDs, keys, names, componentId, etc.) returned by tools.

Example:
- Tool A returns: { categoryId: "abc123" }
- Tool B requires categoryId
→ You MUST pass "abc123" exactly.

If a required parameter is missing:
- STOP
- Ask the user for clarification OR explain what information is unavailable.

────────────────────────────────────────
MCP RESPONSE & RENDERING CONTRACT (CRITICAL)
────────────────────────────────────────
All MCP tools return responses in the following shape:
{
  componentId: string,
  rawData: object | null,
  meta: object | null
}
RULES:
1. You MUST ALWAYS use the componentId returned by the tool.
   - NEVER override it
   - NEVER substitute it
   - NEVER infer a different component
2. componentId determines HOW the response is rendered.
   You are responsible only for NORMALIZING the rawData.
3. If rawData is null, empty, or invalid:
   - Fallback to a text-based response using componentId = "text-plain"
   - Explain clearly and helpfully what data is missing.
────────────────────────────────────────
DATA NORMALIZATION RULES
────────────────────────────────────────
Normalize data ONLY — do not reinterpret it.
• chart-* components:
  Normalize to:
  {
    title: string,
    data: Array<{ x: string, y: number }>
  }

• kpi-single:
  Normalize to:
  {
    label: string,
    value: number
  }

• text-plain:
  Normalize to:
  {
    text: string
  }

- Always provide a meaningful title for charts.
  Use meta.title if provided, otherwise generate a descriptive title.
───────────────────────────────────────
MULTI-TOOL & MULTI-COMPONENT RESPONSES
────────────────────────────────────────
If multiple tool calls are required:
1. Execute them in the correct order.
2. Normalize each tool response independently.
3. Decide layout based on user intent:
   - Comparisons → "sideBySide"
   - Combined insights → "stacked"
   - Default → "stacked"

Then call:
- renderMultiComponent(layout, components[])
Each component MUST preserve its original componentId.
────────────────────────────────────────
ERROR HANDLING & UNCERTAINTY
────────────────────────────────────────
- If a tool fails:
  - Do NOT hallucinate results.
  - Explain what failed and why.
- If user intent is ambiguous:
  - Ask ONE clarifying question before calling tools.
- If requested data does not exist:
  - Clearly state what is available instead.
────────────────────────────────────────
FINAL RESPONSE RULES
────────────────────────────────────────
1. Always render data via components when tools are used.
2. After rendering, briefly explain what the user is seeing.
3. NEVER say:
   - "I cannot generate this component"
   - "The chart could not be rendered"
4. Be precise, factual, and deterministic.
5. Never expose internal reasoning or tool selection logic.
You are not a chatbot.
You are a data execution and rendering agent.`


/**
 * Main rendering tool - renders a single component with normalized data
 */
const renderComponentTool = defineTool({
  name: 'renderComponent',
  description: 'Renders a UI component. You must normalize the raw MCP data into the correct structure for the componentId before calling this tool.',
  parameters: z.object({
    componentId: z.string().describe('The component ID (chart-bar, chart-line, kpi-single, text-plain, etc.)'),
    componentData: z.any().describe('The normalized data for this component. For charts: {title, data: [{x, y}]}. For KPI: {label, value}. For text: {text}'),
  }),
  execute: async ({ componentId, componentData }) => {
    console.log('[renderComponent] Called with componentId:', componentId)
    console.log('[renderComponent] Full componentData:', JSON.stringify(componentData, null, 2))

    // Validate that data is properly formatted for charts
    if (componentId.startsWith('chart-') && componentData) {
      if (!componentData.data || !Array.isArray(componentData.data)) {
        console.error('[renderComponent] ERROR: Chart component missing data array!', componentData)
        return {
          componentId: 'text-plain',
          rawData: { text: 'Error: Chart data is not properly formatted. Expected {data: [{x, y}]} but got: ' + JSON.stringify(componentData) }
        }
      }
      
      // Filter out invalid entries and warn
      const originalLength = componentData.data.length
      componentData.data = componentData.data.filter(item => {
        if (!item || item.x === undefined || item.x === null || item.y === undefined || item.y === null) {
          console.warn('[renderComponent] Filtering out invalid data item:', item)
          return false
        }
        return true
      })
      
      // Ensure x values are strings for chart labels
      componentData.data = componentData.data.map(item => ({
        ...item,
        x: String(item.x),
        y: Number(item.y)
      }))
      
      if (componentData.data.length !== originalLength) {
        console.warn(`[renderComponent] Filtered out ${originalLength - componentData.data.length} invalid items`)
      }
      
      console.log('[renderComponent] Final validated data count:', componentData.data.length)
    }

    return {
      componentId,
      rawData: componentData,
      meta: componentData.meta || {}
    }
  }
})

/**
 * Multi-component rendering tool - renders multiple components in a layout
 */
const renderMultiComponentTool = defineTool({
  name: 'renderMultiComponent',
  description: 'Renders multiple components in a layout. Use when multiple MCP tools return data. Choose layout based on user query intent.',
  parameters: z.object({
    layout: z.enum(['sideBySide', 'stacked', 'grid']).describe('Layout type: sideBySide for comparisons, stacked for sequential, grid for dashboards'),
    components: z.array(
      z.object({
        componentId: z.string(),
        componentData: z.any()
      })
    ).describe('Array of components with their componentId and componentData from MCP responses')
  }),
  execute: async ({ layout, components }) => {
    return {
      success: true,
      componentId: 'multi-component',
      componentData: { layout, components },
      message: `Multi-component layout (${layout}) rendered with ${components.length} components.`
    }
  }
})

/**
 * Legacy tool for backward compatibility
 * @deprecated Use renderComponent instead
 */
const renderChartSpecTool = defineTool({
  name: 'renderChartSpec',
  description: '[LEGACY] Use renderComponent instead. This tool is kept for backward compatibility only.',
  parameters: z.object({
    spec: z.object({
      title: z.string(),
      type: z.enum(['bar', 'line', 'treemap']),
      data: z.array(
        z.object({
          x: z.string(),
          y: z.number()
        })
      )
    })
  }),
  execute: async ({ spec }) => {
    const chartType = spec?.type || 'bar'
    return {
      success: true,
      componentId: `chart-${chartType}`,
      componentData: spec,
      message: `The ${chartType} chart has been rendered in the UI. Briefly describe what it shows.`
    }
  }
})

export async function POST(req) {
  const { tools: mcpTools, close } = await createMcpAgentTools()
  const url = new URL(req.url)
  const threadId = url.searchParams.get('threadId') || req.headers.get('x-thread-id') || 'default'
  const agent = new BuiltInAgent({
    model: 'openai/gpt-4o-mini',
    prompt: MAIA_SYSTEM_PROMPT,
    maxSteps: 7,
    tools: [...mcpTools, renderComponentTool, renderMultiComponentTool, renderChartSpecTool]
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
  let body
  try {
    body = await req.clone().json()
  } catch {}

  let closeDeferred = false
  try {
    if (body?.method && METHODS.includes(body.method)) {
      const res = await singleRoute.fetch(req)

      if (res?.body && typeof res.body.getReader === 'function') {
        closeDeferred = true
        const { readable, writable } = new TransformStream()
        res.body.pipeTo(writable).finally(async () => {
          if (body.method === 'agent/run') {
            const finalMessages = body?.body?.messages
            if (finalMessages?.length) {
              // Serialize messages with type information using inference
              const messagesToSave = finalMessages.map(msg => ({
                ...msg,
                type: inferMessageType(msg),
                id: msg.id,
                role: msg.role,
                content: msg.content,
                toolCalls: msg.toolCalls,
                toolCallId: msg.toolCallId,
                createdAt: msg.createdAt || new Date().toISOString()
              }))
              await saveMessages(threadId, messagesToSave).catch(err => 
                console.error('Failed to save messages:', err)
              )
            }
          }
          await close().catch(() => {})
        })
        return new Response(readable, { status: res.status, headers: res.headers })
      }
      if (body.method === 'agent/run') {
        const finalMessages = body?.body?.messages
        if (finalMessages?.length) {
          // Serialize messages with type information using inference
          const messagesToSave = finalMessages.map(msg => ({
            ...msg,
            type: inferMessageType(msg),
            id: msg.id,
            role: msg.role,
            content: msg.content,
            toolCalls: msg.toolCalls,
            toolCallId: msg.toolCallId,
            createdAt: msg.createdAt || new Date().toISOString()
          }))
          await saveMessages(threadId, messagesToSave).catch(err =>
            console.error('Failed to save messages:', err)
          )
        }
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

