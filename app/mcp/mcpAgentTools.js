import { createMCPClient } from '@ai-sdk/mcp'
import { defineTool, convertJsonSchemaToZodSchema } from '@copilotkitnext/agent'
import { getMcpConfig } from '../config/mcp'
import { z } from 'zod'
import { normalizeToolResult } from './normalizeToolResult'

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

  // Special handling for data retrieval tools
  if (toolName.includes('top_brands') || toolName.includes('market_share')) {
    return `
CRITICAL: Before calling this tool, you MUST have already called get_available_hierarchy and extracted the EXACT category values from its result.

This tool requires exact division/category/subCategory/articleType values that exist in the hierarchy.
DO NOT guess or invent category names like "hair care & styling" - they will fail.
ONLY use values you found by searching through the hierarchy result array.

${base}

When you call this tool, you must explain in your response which hierarchy entry you used.
`.trim()
  }

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
          // Use same date as hierarchy to ensure consistency
          adjustedArgs.date = '2026-01'
        }

        console.log(`[MCP Tool] Calling ${name} with args:`, JSON.stringify(adjustedArgs, null, 2))

        try {
          const result = await tool.execute(adjustedArgs, {})
          
          // Check if the MCP tool returned success=false BEFORE normalizing
          if (result.content?.[0]?.text) {
            try {
              const parsedResult = JSON.parse(result.content[0].text)
              if (parsedResult.success === false) {
                const errorMsg = parsedResult.message || 'No data available'
                console.error(`[MCP Tool] ${name} failed:`, {
                  message: parsedResult.message,
                  errorCode: parsedResult.errorCode,
                  args: adjustedArgs
                })
                // Return simple text to avoid OpenAI rejection
                return `Error: ${name} failed with parameters ${JSON.stringify(adjustedArgs)}. No data available.`
              }
            } catch (e) {
              // Not JSON or parsing failed, continue with normalization
            }
          }
          
          const normalized = normalizeToolResult(result)
          
          console.log(`[MCP Tool] ${name} returned:`, {
            componentId: normalized.componentId,
            hasData: !!normalized.rawData,
            success: 'success'
          })
          
          return normalized
        } catch (e) {
          console.error(`[MCP Tool] ${name} error:`, e?.message || e)
          // Return simple error text
          return String(e?.message || 'Tool execution error')
        }
      }
    })
  })

  return {
    tools: agentTools,
    close: () => client.close()
  }
}
