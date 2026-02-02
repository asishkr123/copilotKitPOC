import { NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'
export async function middleware(req, _res) {
  const requestId = uuidv4()
  const { pathname } = req.nextUrl
  const protocol = req.headers.get('x-forwarded-proto') || 'http'
  const baseUrl = `${protocol}://${req.headers.get('host')}`
  let response = NextResponse.next()
  response.headers.append('x-app-base-url', baseUrl)
  response.headers.append('x-app-current-path', pathname)
  response.headers.append('x-request-id', requestId)
  return response
}
export const config = {
  matcher: ['/', '/home/:theme', '/api/:path*']
}
