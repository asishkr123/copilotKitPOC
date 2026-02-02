function toChartSpec(raw) {
  const type = raw.chartType || 'bar'
  const title = typeof raw.title === 'string' ? raw.title : 'Chart'

  const data = Array.isArray(raw.data)
    ? raw.data.map((p) => ({
        x: String(p?.label ?? ''),
        y: Number(p?.value) || 0
      }))
    : []

  return { type, title, data }
}

export const mcpAdapter = {
  async query(nlQuery) {
    const payload = await mcpClient.execute({ query: nlQuery })

    // KPI
    if (
      payload &&
      typeof payload === 'object' &&
      payload.label != null &&
      payload.value != null &&
      !Array.isArray(payload.data)
    ) {
      return {
        ok: true,
        data: {
          label: String(payload.label),
          value: payload.value
        }
      }
    }

    // Chart
    if (payload && typeof payload === 'object' && Array.isArray(payload.data) && payload.chartType) {
      return {
        ok: true,
        data: toChartSpec(payload)
      }
    }

    // List / Raw dataset (IMPORTANT FIX)
    if (Array.isArray(payload?.data)) {
      return {
        ok: true,
        data: payload.data
      }
    }

    // Text
    if (typeof payload === 'string') {
      return { ok: true, data: payload }
    }

    if (payload?.text) {
      return { ok: true, data: String(payload.text) }
    }

    throw new Error('Unsupported MCP payload')
  }
}
