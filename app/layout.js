import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import { MaiaThemeProvider } from './maia/providers/MaiaThemeProvider'
import { CopilotProvider } from './maia/providers/CoPilotProvider'
import './global.css'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          <MaiaThemeProvider>
            <CopilotProvider>{children}</CopilotProvider>
          </MaiaThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
