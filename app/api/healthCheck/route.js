import { NextResponse } from 'next/server'
import { getLogger } from '../../../logger'
import { getRandomBinary } from '../../utils'
// import { withAsyncContextHandler } from '@/logger/withAsyncContextHandler'

async function handler() {
  const logger = getLogger('healthCheck', {
    file: __filename
  })
  logger.info('Health check route invoked')
  try {
    getRandomBinary(1, 1000)
    return NextResponse.json({
      success: true,
      message: 'Service is up and running'
    })
  } catch (err) {
    logger.error({ err }, 'Health check failed')
    return NextResponse.json(
      {
        success: false,
        message: 'Health check failed'
      },
      { status: 500 }
    )
  }
}

export const GET = handler
