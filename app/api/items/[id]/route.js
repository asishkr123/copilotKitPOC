import { NextResponse } from 'next/server'

const items = [
  {
    id: '1',
    name: 'Google Pixel 6 Pro',
    data: {
      color: 'Cloudy White',
      capacity: '128 GB'
    }
  },
  {
    id: '2',
    name: 'Apple iPhone 12 Mini, 256GB, Blue',
    data: null
  },
  {
    id: '3',
    name: 'Apple iPhone 12 Pro Max',
    data: {
      color: 'Cloudy White',
      'capacity GB': 512
    }
  }
]

export async function GET(request, { params }) {
  const { id } = await params
  const item = items.find((item) => {
    return item.id === id
  })
  return NextResponse.json({ success: true, data: [item] })
}
