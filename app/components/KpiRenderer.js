'use client'

import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

/**
 * Simple KPI card component
 * Component ID: kpi-single
 * 
 * @param {Object} props
 * @param {string} props.label - KPI label
 * @param {string|number} props.value - KPI value
 */
export function KpiRenderer({ label, value }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h4" component="div" fontWeight="bold">
        {value}
      </Typography>
    </Paper>
  )
}
