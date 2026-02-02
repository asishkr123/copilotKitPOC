'use client'

import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'

/**
 * Simple text display component
 * Component ID: text-plain
 * 
 * @param {Object} props
 * @param {string} props.text - Text content to display
 */
export function TextRenderer({ text }) {
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
        {text}
      </Typography>
    </Paper>
  )
}
