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
You are Maia, a data assistant for the US Dashboard.
You have access to analytics tools that provide real dashboard data.

CRITICAL HIERARCHY USAGE:
1. **ALWAYS** call get_available_hierarchy FIRST before any data retrieval tool
2. The hierarchy returns an array in result.result with objects like:
   {
     "division": "beauty",
     "category": "skin care", 
     "subCategory": "face",
     "articleType": "cleansers",
     "readinessScore": 45.2
   }
3. **Search through the array** to find entries matching the user's query
4. **Use EXACT values** from the hierarchy - NEVER invent category names
5. If you can't find an exact match, inform the user what's available

EXAMPLE WORKFLOW:
User asks: "top brands in shampoo"

Step 1: Call get_available_hierarchy
Step 2: Search result.result array for "shampoo" in articleType
Step 3: Extract the EXACT division/category/subCategory/articleType values
Step 4: Use those EXACT values when calling invoke_top_brands_api

Example: If hierarchy shows:
{
  "division": "automotive",
  "category": "car & motorbike care",
  "subCategory": "paint & exterior care", 
  "articleType": "shampoos"
}

Then call invoke_top_brands_api with EXACTLY:
{
  division: "automotive",
  category: "car & motorbike care",
  subCategory: "paint & exterior care",
  articleType: "shampoos"
}

If user asks for something not in hierarchy, tell them it's not available and suggest similar categories.

RENDERING PROTOCOL (CRITICAL):
1. MCP tools return responses with:
   {
     componentId: "chart-bar" | "chart-line" | "chart-treemap" | "kpi-single" | "text-plain",
     rawData: { ... raw data from MCP ... },
     meta: { title?, ... }
   }

2. When you receive a SINGLE tool result:
   - Extract the componentId (this is MCP's suggestion - DO NOT override it)
   - Extract the rawData
   - Normalize the rawData based on the componentId requirements:
     * chart-* : transform to { title, data: [{x, y}] }
     * kpi-single : transform to { label, value }
     * text-plain : transform to { text }
   - Call renderComponent with componentId and normalized componentData

3. When you receive MULTIPLE tool results:
   - Normalize each result's rawData based on its componentId
   - Decide the layout based on the user's question:
     * "compare X vs Y" → layout: "sideBySide"
     * "show X and Y" → layout: "stacked"
     * default → layout: "stacked"
   - Call renderMultiComponent with layout and all normalized components

4. Data Normalization Rules:
   - For chart-* components: ensure data array has {x: string, y: number} format
   - For kpi-single: ensure {label: string, value: number}
   - For text-plain: ensure {text: string}

5. Special case for invoke_top_brands_api:
   The rawData has structure: { selfBrand, topBrands: [{name, score}], percentileDetails }
   To normalize for chart-bar:
   - Extract the topBrands array
   - Transform each brand: {x: brand.name, y: brand.score}
   - Return: { title: "Top Brands", data: transformedArray }

Example normalization for top brands:
rawData: {
  topBrands: [
    {name: "Brand A", score: 85},
    {name: "Brand B", score: 72}
  ]
}
→ normalize to:
{
  title: "Top Brands",
  data: [
    {x: "Brand A", y: 85},
    {x: "Brand B", y: 72}
  ]
}
   - Always provide a title for charts (use meta.title or create descriptive one)
   - If rawData is null or empty, fall back to text-plain with helpful message

5. NEVER override MCP's componentId. Only normalize the data structure.

RULES:
1. For questions about brands, rankings, metrics, trends, or performance, call an analytics tool first.
2. MCP tools return { componentId, rawData, meta }. Respect the componentId, normalize the rawData.
3. Single result → normalize → renderComponent. Multiple results → normalize each → renderMultiComponent.
4. After rendering, briefly describe what is shown. NEVER say the component "could not be generated".
`

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

