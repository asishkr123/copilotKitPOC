'use client'

import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

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


export function MaiaThemeProvider({ children }) {
  return (
    <ThemeProvider theme={maiaTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
