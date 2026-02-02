import { z } from 'zod'

/**
 * Canonical chart spec shared by mcp-adapter, render-tools, and ChartSpecRenderer.
 * ChartSpec: { title, type: 'bar'|'line', data: [{x,y}], color? }
 */
export const chartSpecSchema = z.object({
  title: z.string(),
  type: z.enum(['bar', 'line', 'treemap']),
  data: z.array(
    z.object({
      x: z.string(),
      y: z.number()
    })
  ),
  color: z.string().optional()
})
