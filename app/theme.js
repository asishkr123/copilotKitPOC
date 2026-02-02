'use client'
import { createTheme } from '@mui/material/styles'

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2'
    },
    secondary: {
      main: '#00468b'
    }
  }
})

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#bb86fc'
    },
    secondary: {
      main: '#8b0000'
    }
  }
})

/** Maia / US Dashboard dark theme. Matches global.css --bg-page, --bg-panel, --text-primary, --text-secondary. */
export const maiaTheme = createTheme({
  palette: {
    primary: { main: '#bb86fc' },
    secondary: { main: '#8b0000' },
    background: {},
    text: {
      primary: '#e5e7eb',
      secondary: '#9ca3af'
    }
  }
})
