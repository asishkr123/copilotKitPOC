import { createMCPClient } from '@ai-sdk/mcp'
import { defineTool, convertJsonSchemaToZodSchema } from '@copilotkitnext/agent'
import { getMcpConfig } from '@/config/mcp'
import { z } from 'zod'
import { normalizeToolResult } from '@/mcp/mcp-client'

/**
 * Get the raw JSON Schema from an MCP tool's inputSchema (from the server).
 * The AI SDK wraps it; we need the plain object for convertJsonSchemaToZodSchema.
 */
function getInputJsonSchema(tool) {
  const schema = tool?.inputSchema
  if (schema == null) return null
  if (typeof schema.jsonSchema !== 'undefined') return schema.jsonSchema
  if (typeof schema === 'object' && typeof schema.type === 'string') return schema
  return null
}

function isObjectSchema(schema) {
  return schema && typeof schema === 'object' && (schema.type === 'object' || !schema.type)
}

function parametersFromTool(tool) {
  const raw = getInputJsonSchema(tool)
  if (!raw || !isObjectSchema(raw)) return z.object({}).passthrough()
  try {
    return convertJsonSchemaToZodSchema(raw, true)
  } catch {
    return z.object({}).passthrough()
  }
}

/**
 * Give the agent enough context to decide when to use each tool.
 * We use the MCP server's description and add a short, generic wrapper — no tool names or per-tool overrides.
 */
function buildAgentToolDescription(toolName, mcpDescription) {
  const base =
    typeof mcpDescription === 'string' && mcpDescription.trim()
      ? mcpDescription.trim()
      : `Analytics tool: ${toolName}`

  return `
Use this tool when the user asks for factual, data-backed answers about brands, rankings, metrics, performance, trends, or analytics. Do not answer such questions from general knowledge.

It returns structured data (numbers, lists, metrics, or datasets), not natural-language text.

${base}
`.trim()
}

export async function createMcpAgentTools() {
  const { httpUrl, headers } = getMcpConfig()

  const client = await createMCPClient({
    transport: { type: 'http', url: httpUrl, headers },
    name: 'maia-mcp-client'
  })

  const toolSet = await client.tools()

  if (!toolSet || Object.keys(toolSet).length === 0) {
    await client.close()
    throw new Error('MCP server returned no tools')
  }

  const agentTools = Object.entries(toolSet).map(([name, tool]) => {
    const rawSchema = getInputJsonSchema(tool)
    const hasDateParam =
      rawSchema?.properties && typeof rawSchema.properties.date !== 'undefined'
    const hasRegionParam =
      rawSchema?.properties && typeof rawSchema.properties.region !== 'undefined'

    return defineTool({
      name,
      description: buildAgentToolDescription(name, tool.description),
      parameters: parametersFromTool(tool),
      execute: async (args) => {
        const adjustedArgs = { ...(args ?? {}) }

        if (hasRegionParam && (adjustedArgs.region == null || adjustedArgs.region === '')) {
          adjustedArgs.region = 'in'
        }

        if (hasDateParam) {
          // Always use a date six months in the past (YYYY-MM) and ignore incoming `date` in args
          const sixMonthsAgo = new Date()
          sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
          const sixMonthsYYYYMM = `${sixMonthsAgo.getFullYear()}-${String(
            sixMonthsAgo.getMonth() + 1
          ).padStart(2, '0')}`
          adjustedArgs.date = sixMonthsYYYYMM
        }

        try {
          const result = await tool.execute(adjustedArgs, {})
          return normalizeToolResult(result)
        } catch (e) {
          return { text: String(e?.message || 'Tool error'), success: false }
        }
      }
    })
  })

  return {
    tools: agentTools,
    close: () => client.close()
  }
}
