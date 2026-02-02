import { createMCPClient } from '@ai-sdk/mcp'
import { getMcpConfig } from '../config/mcp'

export function normalizeToolResult(result) {
  if (result == null) {
    throw new Error('MCP returned empty result')
  }

  if (result.isError) {
    const msg = result.content?.find((c) => c?.type === 'text')?.text || 'MCP tool error'
    throw new Error(msg)
  }

  if (result.toolResult != null) {
    return unwrapPayload(result.toolResult)
  }

  if (Array.isArray(result.content)) {
    const text = result.content
      .filter((c) => c?.type === 'text' && c?.text)
      .map((c) => c.text)
      .join(' ')

    if (!text) {
      throw new Error('MCP returned empty content')
    }

    try {
      return unwrapPayload(JSON.parse(text))
    } catch {
      return { text }
    }
  }

  throw new Error('Unsupported MCP response shape')
}

function unwrapPayload(obj) {
  if (obj == null || typeof obj !== 'object') return obj

  if (Array.isArray(obj.data)) return obj
  if (Array.isArray(obj.result?.data)) {
    return { ...obj, data: obj.result.data }
  }

  return obj
}

export const mcpClient = {
  async execute({ query }) {
    const { httpUrl, headers, queryToolName } = getMcpConfig()

    const client = await createMCPClient({
      transport: { type: 'http', url: httpUrl, headers },
      name: 'maia-mcp-client'
    })

    try {
      const toolSet = await client.tools()
      const toolNames = Object.keys(toolSet || {})

      if (toolNames.length === 0) {
        throw new Error('MCP server returned no tools')
      }

      const toolName = queryToolName && toolSet[queryToolName] ? queryToolName : toolNames[0]

      const tool = toolSet[toolName]

      const result = await tool.execute({ query }, {})
      return normalizeToolResult(result)
    } finally {
      await client.close()
    }
  }
}
