'use client'

import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { maiaTheme } from '@/theme'

export function MaiaThemeProvider({ children }) {
  return (
    <ThemeProvider theme={maiaTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
