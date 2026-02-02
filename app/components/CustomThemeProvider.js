'use client'

import { createTheme, ThemeProvider } from '@mui/material'

export default function ({ children, primaryColor, secondaryColor }) {
  console.log('CustomThemeProvider')
  const theme = createTheme({
    palette: {
      mode: 'light',
      primary: {
        main: primaryColor
      },
      secondary: {
        main: secondaryColor
      }
    }
  })
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>
}
