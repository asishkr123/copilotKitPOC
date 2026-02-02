'use client'

import { useFrontendTool } from '@copilotkit/react-core'

export const useFrontendTools = () => {
  useFrontendTool({
    name: 'filterDashboard',
    handler: ({ dimension, value }) => {
      console.log('Filter dashboard:', dimension, value)
    }
  })

  useFrontendTool({
    name: 'navigateSection',
    handler: ({ section }) => {
      console.log('Navigate to section:', section)
    }
  })
}
