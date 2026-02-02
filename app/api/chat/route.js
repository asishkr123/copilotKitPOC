import { CopilotRuntime, InMemoryAgentRunner, createCopilotEndpointSingleRoute } from '@copilotkitnext/runtime'
import { BuiltInAgent, defineTool } from '@copilotkitnext/agent'
import { z } from 'zod'
import { createMcpAgentTools } from '@/mcp/mcpAgentTools'
import path from 'path'
import fs from 'fs'

const THREAD_DIR = path.join(process.cwd(), '.chat-threads')

function ensureDir() {
  if (!fs.existsSync(THREAD_DIR)) {
    fs.mkdirSync(THREAD_DIR, { recursive: true })
  }
}

function threadFile(threadId) {
  ensureDir()
  return path.join(THREAD_DIR, `${threadId}.json`)
}

function saveThread(threadId, messages) {
  try {
    fs.writeFileSync(threadFile(threadId), JSON.stringify(messages, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to save thread', e)
  }
}

const MAIA_SYSTEM_PROMPT = `
You are Maia, a data assistant for the US Dashboard.
You have access to analytics tools that provide real dashboard data.

CONTEXT:
- We have data for brand rankings by product category: e.g. shampoos, detergents, skin care, hair care, body wash.
- Categories are organized in a hierarchy (division, category, subCategory, article type).
- When the user asks for top brands, best brands, or rankings in a category, use the tool whose description says it returns brand rankings or top brands by category.
- If you need valid category values, use the tool that lists available categories or hierarchy nodes.
- When calling any tool that accepts date or region: use current year-month (YYYY-MM) and a sensible default region if the user did not specify.
- Never invent data. Prefer calling a tool that matches the user intent; if nothing returns data, explain what is available.

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
   - For kpi-single: ensure {label: string, value: string|number}
   - For text-plain: ensure {text: string}
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
    componentId: z.string().describe('Component ID from MCP response (e.g., "chart-bar", "kpi-single")'),
    componentData: z.object({}).passthrough().describe('NORMALIZED component data. For charts: {title, data:[{x,y}]}. For KPI: {label, value}. For text: {text}.')
  }),
  execute: async ({ componentId, componentData }) => {
    return {
      success: true,
      componentId,
      componentData,
      message: `Component ${componentId} has been rendered in the UI. Briefly describe what it shows.`
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
              saveThread(threadId, finalMessages)
            }
          }
          await close().catch(() => {})
        })
        return new Response(readable, { status: res.status, headers: res.headers })
      }
      if (body.method === 'agent/run') {
        const finalMessages = body?.body?.messages
        if (finalMessages?.length) {
          saveThread(threadId, finalMessages)
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
s
