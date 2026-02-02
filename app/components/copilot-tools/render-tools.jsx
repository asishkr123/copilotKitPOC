'use client'

import { useTheme } from '@mui/material/styles'
import Paper from '@mui/material/Paper'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { useRenderToolCall } from '@copilotkit/react-core'
import { ChartSpecRenderer, chartSpecSchema } from '../charts'

// function ChartSkeleton() {
//   return (
//     <Paper variant="outlined" sx={{ p: 1.5, height: 140 }}>
//       <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1.5 }} />
//       <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 80 }}>
//         {[40, 65, 45, 80, 55].map((h, i) => (
//           <Skeleton key={i} variant="rectangular" sx={{ flex: 1, height: h, borderRadius: 1 }} />
//         ))}
//       </Box>
//     </Paper>
//   )
// }

export const useRenderTools = () => {
  const theme = useTheme()

  /**
   * Main rendering tool - renders a single component based on componentId
   */
  useRenderToolCall({
    name: 'renderComponent',
    description: 'Renders a UI component based on MCP response componentId',
    parameters: [
      {
        name: 'componentId',
        type: 'string',
        description: 'Component ID from MCP (e.g., "chart-bar", "kpi-single")',
        required: true
      },
      {
        name: 'componentData',
        type: 'object',
        description: 'Component-specific data from MCP',
        required: true
      }
    ],
    render: ({ status, args, result }) => {
      // Log for debugging
      fetch('http://127.0.0.1:7242/ingest/b57db9a2-24f2-4fcd-96f2-55ee4fcb5b67', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: 'render-tools.jsx:renderComponent',
          message: 'renderComponent called',
          data: { status, componentId: args?.componentId, hasComponentData: !!args?.componentData },
          timestamp: Date.now()
        })
      }).catch(() => {})

      const componentId = args?.componentId || result?.componentId
      const componentData = args?.componentData || result?.componentData

      if (!componentId || !componentData) {
        return (
          <Typography variant="body2" color="text.secondary">
            Could not load component - missing componentId or componentData.
          </Typography>
        )
      }

      // Handle chart components
      if (componentId.startsWith('chart-')) {
        const chartType = componentId.replace('chart-', '')
        const spec = {
          ...componentData,
          type: chartType,
          color: componentData.color || theme.palette.text.primary
        }

        if (!spec.data || spec.data.length === 0) {
          return (
            <Typography variant="body2" color="text.secondary">
              No data available for chart.
            </Typography>
          )
        }

        return <ChartSpecRenderer spec={spec} />
      }

      // Handle KPI component
      if (componentId === 'kpi-single') {
        return (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              {componentData.label || '—'}
            </Typography>
            <Typography variant="h4" component="div" fontWeight="bold">
              {componentData.value || '—'}
            </Typography>
          </Paper>
        )
      }

      // Handle text component
      if (componentId === 'text-plain') {
        return (
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
              {componentData.text || ''}
            </Typography>
          </Paper>
        )
      }

      // Fallback
      return (
        <Typography variant="body2" color="text.secondary">
          Unknown component type: {componentId}
        </Typography>
      )
    }
  })

  /**
   * Multi-component rendering tool
   */
  useRenderToolCall({
    name: 'renderMultiComponent',
    description: 'Renders multiple components in a layout',
    parameters: [
      {
        name: 'layout',
        type: 'string',
        description: 'Layout type: sideBySide, stacked, or grid',
        required: true
      },
      {
        name: 'components',
        type: 'array',
        description: 'Array of {componentId, componentData} objects',
        required: true
      }
    ],
    render: ({ args, result }) => {
      const layout = args?.layout || result?.componentData?.layout || 'stacked'
      const components = args?.components || result?.componentData?.components || []

      if (!Array.isArray(components) || components.length === 0) {
        return (
          <Typography variant="body2" color="text.secondary">
            No components to render.
          </Typography>
        )
      }

      const renderSingleComponent = (comp, idx) => {
        const { componentId, componentData } = comp

        // Handle chart components
        if (componentId?.startsWith('chart-')) {
          const chartType = componentId.replace('chart-', '')
          const spec = {
            ...componentData,
            type: chartType,
            color: componentData.color || theme.palette.text.primary
          }
          return <ChartSpecRenderer key={idx} spec={spec} />
        }

        // Handle KPI component
        if (componentId === 'kpi-single') {
          return (
            <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {componentData.label || '—'}
              </Typography>
              <Typography variant="h4" component="div" fontWeight="bold">
                {componentData.value || '—'}
              </Typography>
            </Paper>
          )
        }

        // Handle text component
        if (componentId === 'text-plain') {
          return (
            <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {componentData.text || ''}
              </Typography>
            </Paper>
          )
        }

        // Fallback
        return (
          <Typography key={idx} variant="body2" color="text.secondary">
            Unknown component: {componentId}
          </Typography>
        )
      }

      // Side-by-side layout
      if (layout === 'sideBySide') {
        return (
          <Grid container spacing={2}>
            {components.map((comp, idx) => (
              <Grid item xs={12} md={6} key={idx}>
                {renderSingleComponent(comp, idx)}
              </Grid>
            ))}
          </Grid>
        )
      }

      // Stacked layout
      if (layout === 'stacked') {
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {components.map((comp, idx) => renderSingleComponent(comp, idx))}
          </Box>
        )
      }

      // Grid layout
      return (
        <Grid container spacing={2}>
          {components.map((comp, idx) => (
            <Grid item xs={12} md={components.length > 2 ? 6 : 12} key={idx}>
              {renderSingleComponent(comp, idx)}
            </Grid>
          ))}
        </Grid>
      )
    }
  })

  /**
   * Legacy renderChartSpec tool - for backward compatibility
   */
  useRenderToolCall({
    name: 'renderChartSpec',
    description: 'Renders a bar, line, or treemap chart from a chart spec',
    parameters: [
      {
        name: 'spec',
        type: 'object',
        description: "Chart spec: { title: string, type: 'bar'|'line'|'treemap', data: [{x: string, y: number}] }",
        required: true
      }
    ],
    render: ({ status, args, result }) => {
      // Prefer args.spec; fallback to result.spec when toolMessage arrives before args are final
      const raw = args?.spec ?? (typeof result === 'object' && result?.spec ? result.spec : null)
      const fromResult =
        typeof result === 'string'
          ? (() => {
              try {
                return JSON.parse(result)?.spec
              } catch {
                return null
              }
            })()
          : result?.componentData || null

      const spec = raw ?? fromResult

      if (!spec || typeof spec !== 'object' || !Array.isArray(spec.data) || spec.data.length === 0) {
        return (
          <Typography variant="body2" color="text.secondary">
            Couldn&apos;t load chart.
          </Typography>
        )
      }

      // Normalize into canonical shape
      const normalized = {
        title: typeof spec.title === 'string' && spec.title.trim().length > 0 ? spec.title : 'Chart',
        type: spec.type === 'treemap' || spec.type === 'bar' || spec.type === 'line' ? spec.type : 'bar',
        data: spec.data.map((p) => ({
          x: typeof p.x === 'string' ? p.x : typeof p.label === 'string' ? p.label : String(p.x ?? p.label ?? ''),
          y: typeof p.y === 'number' ? p.y : typeof p.value === 'number' ? p.value : Number(p.y ?? p.value) || 0
        })),
        color: typeof spec.color === 'string' ? spec.color : undefined
      }

      const parsed = chartSpecSchema.safeParse(normalized)
      const finalSpec = parsed.success ? parsed.data : normalized

      return (
        <ChartSpecRenderer
          spec={{
            ...finalSpec,
            color: finalSpec.color || theme.palette.text.primary
          }}
        />
      )
    }
  })
}

