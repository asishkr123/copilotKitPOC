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
  if (!result || typeof result !== 'object') {
    return { text: String(result || '') }
  }

  // Check if result has the expected MCP structure
  if (!result.content || !Array.isArray(result.content)) {
    return { text: JSON.stringify(result) }
  }

  let componentIdFromMeta = null
  
  // Extract componentId from _meta if present
  const firstContent = result.content.find(c => c?.type === 'text')
  if (firstContent?._meta?.component) {
    componentIdFromMeta = firstContent._meta.component
  }

  // Try to parse the text content
  let parsed = null
  const textContent = firstContent?.text
  if (textContent && typeof textContent === 'string') {
    try {
      parsed = JSON.parse(textContent)
    } catch (e) {
      return { text: textContent }
    }
  }

  // New format: MCP provides componentId + raw data
  if (parsed && typeof parsed === 'object') {
    const componentId = componentIdFromMeta || parsed.componentId || null
    const meta = parsed.meta || {}
    
    if (componentId) {
      const rawData = parsed.data || parsed.rawData || parsed.result || parsed
      return {
        componentId,
        rawData,
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

