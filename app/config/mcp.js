export function getMcpConfig() {
  return {
    httpUrl: 'https://mcp.shopalyst.com/bkg/',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: 'Bearer 1234'
    }
  }
}
