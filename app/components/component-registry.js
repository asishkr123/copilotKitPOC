import { ChartSpecRenderer } from './charts'
import { KpiRenderer } from './KpiRenderer'
import { TextRenderer } from './TextRenderer'
import { MultiComponentRenderer } from './MultiComponentRenderer'

/**
 * Central registry mapping componentId to React components
 * 
 * Component IDs:
 * - chart-bar: Bar chart visualization
 * - chart-line: Line chart visualization
 * - chart-treemap: Treemap visualization
 * - kpi-single: Single KPI card
 * - text-plain: Plain text display
 * - multi-component: Multi-component layout
 */
export const COMPONENT_REGISTRY = {
  'chart-bar': ChartSpecRenderer,
  'chart-line': ChartSpecRenderer,
  'chart-treemap': ChartSpecRenderer,
  'kpi-single': KpiRenderer,
  'text-plain': TextRenderer,
  'multi-component': MultiComponentRenderer
}

/**
 * Get component by ID
 * @param {string} componentId - Component identifier
 * @returns {React.Component} - Component or TextRenderer as fallback
 */
export function getComponentById(componentId) {
  if (!componentId || typeof componentId !== 'string') {
    console.warn('Invalid componentId:', componentId)
    return TextRenderer
  }

  const component = COMPONENT_REGISTRY[componentId]
  
  if (!component) {
    console.warn(`Component not found for ID: ${componentId}. Using TextRenderer as fallback.`)
    return TextRenderer
  }

  return component
}

/**
 * Check if a component ID is registered
 * @param {string} componentId - Component identifier
 * @returns {boolean}
 */
export function isComponentRegistered(componentId) {
  return componentId && typeof componentId === 'string' && componentId in COMPONENT_REGISTRY
}
