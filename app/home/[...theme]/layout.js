// import CustomThemeProvider from '@/app/components/CustomThemeProvider'
import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter'
import CssBaseline from '@mui/material/CssBaseline'

export default async function RootLayout({ children, params }) {
  // Route specific layout.js files are needed if you need to access page params
  const themeInfo = (await params).theme

  return (
    <html lang="en">
      <body>
        <AppRouterCacheProvider>
          {/* <CustomThemeProvider primaryColor={`#${themeInfo[1]}`} secondaryColor={`#${themeInfo[2]}`}> */}
          <CssBaseline />
          {children}
          {/* </CustomThemeProvider> */}
        </AppRouterCacheProvider>
      </body>
    </html>
  )
}
