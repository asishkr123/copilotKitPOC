/**
 * Normalize MCP tool result to extract componentId suggestion and raw data
 * 
 * New MCP response format:
 * {
 *   componentId: "chart-bar" | "chart-line" | "chart-treemap" | "kpi-single" | "text-plain",
 *   data: [...],  // Raw data from MCP
 *   meta?: { title?, description?, ... }
 * }
 * 
 * The agent will normalize the raw data based on componentId.
 */
export function normalizeToolResult(result) {
  if (result == null) {
    return {
      componentId: 'text-plain',
      rawData: null,
      meta: {}
    }
  }

  if (result.isError) {
    const msg = result.content?.find((c) => c?.type === 'text')?.text || 'MCP tool error'
    return {
      componentId: 'text-plain',
      rawData: { text: `Error: ${msg}` },
      meta: {}
    }
  }

  // Extract the actual data from MCP response
  let parsed = result
  
  if (result.toolResult != null) {
    parsed = result.toolResult
  } else if (Array.isArray(result.content)) {
    const text = result.content
      .filter((c) => c?.type === 'text' && c?.text)
      .map((c) => c.text)
      .join(' ')
    
    if (text) {
      try {
        parsed = JSON.parse(text)
      } catch {
        return {
          componentId: 'text-plain',
          rawData: { text },
          meta: {}
        }
      }
    }
  }

  // New format: MCP provides componentId + raw data
  if (parsed && typeof parsed === 'object') {
    const componentId = parsed.componentId || null
    const meta = parsed.meta || {}
    
    // If componentId is provided, return it with raw data for agent normalization
    if (componentId) {
      return {
        componentId,
        rawData: parsed.data || parsed.rawData || parsed,
        meta
      }
    }

    // Legacy format inference for backward compatibility
    // KPI format: { label, value }
    if (parsed.label != null && parsed.value != null && !Array.isArray(parsed.data)) {
      return {
        componentId: 'kpi-single',
        rawData: parsed,
        meta
      }
    }

    // Chart format: { chartType, data, title }
    if (parsed.chartType && Array.isArray(parsed.data)) {
      const chartType = parsed.chartType === 'treemap' || parsed.chartType === 'line' 
        ? parsed.chartType 
        : 'bar'
      
      return {
        componentId: `chart-${chartType}`,
        rawData: parsed,
        meta
      }
    }

    // Raw data array: { data: [...] }
    if (Array.isArray(parsed.data)) {
      return {
        componentId: 'chart-bar',
        rawData: parsed,
        meta
      }
    }

    // Plain text
    if (parsed.text) {
      return {
        componentId: 'text-plain',
        rawData: parsed,
        meta
      }
    }

    // Just raw data, no structure - default to chart-bar
    return {
      componentId: 'chart-bar',
      rawData: parsed,
      meta
    }
  }

  // Fallback: treat as text
  return {
    componentId: 'text-plain',
    rawData: { text: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2) },
    meta: {}
  }
}

