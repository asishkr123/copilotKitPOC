'use client'

import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import { getComponentById } from '@/components/component-registry'

/**
 * Multi-component layout renderer
 * Component ID: multi-component
 * 
 * Renders multiple components in different layouts
 * 
 * @param {Object} props
 * @param {string} props.layout - Layout type: 'sideBySide' | 'stacked' | 'grid'
 * @param {Array} props.components - Array of {componentId, componentData}
 */
export function MultiComponentRenderer({ layout, components }) {
  if (!Array.isArray(components) || components.length === 0) {
    return null
  }

  const renderComponent = (comp, idx) => {
    const Component = getComponentById(comp.componentId)
    const key = `component-${idx}`

    // Handle chart components (need spec prop)
    if (comp.componentId?.startsWith('chart-')) {
      const chartType = comp.componentId.replace('chart-', '')
      return <Component key={key} spec={{ ...comp.componentData, type: chartType }} />
    }

    // Handle other components (direct props)
    return <Component key={key} {...comp.componentData} />
  }

  // Side-by-side layout (2 columns)
  if (layout === 'sideBySide') {
    return (
      <Grid container spacing={2}>
        {components.map((comp, idx) => (
          <Grid item xs={12} md={6} key={idx}>
            {renderComponent(comp, idx)}
          </Grid>
        ))}
      </Grid>
    )
  }

  // Stacked layout (vertical)
  if (layout === 'stacked') {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {components.map((comp, idx) => renderComponent(comp, idx))}
      </Box>
    )
  }

  // Grid layout (responsive grid)
  return (
    <Grid container spacing={2}>
      {components.map((comp, idx) => (
        <Grid item xs={12} md={components.length > 2 ? 6 : 12} key={idx}>
          {renderComponent(comp, idx)}
        </Grid>
      ))}
    </Grid>
  )
}
