'use client'

import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { useTheme } from '@mui/material/styles'
import Paper from '@mui/material/Paper'
import Typography from '@mui/material/Typography'
import { useCopilotChat } from '@copilotkit/react-core'

const HEIGHT = 280
const MARGIN = { top: 20, right: 20, bottom: 80, left: 50 }
const DATA_LABEL_FILL = '#1a1a1a'

// Dynamic palette: yellow-centric so each data point gets a distinct color (yellows/ambers).
const DATA_POINT_PALETTE = [
  '#facc15',
  '#eab308',
  '#fde047',
  '#fef08a',
  '#fef9c3',
  '#fbbf24',
  '#f59e0b',
  '#fcd34d',
  '#fde68a',
  '#fef3c7',
  '#ca8a04',
  '#a16207',
  '#854d0e',
  '#713f12',
  '#d97706',
  '#b45309'
]

function getDataPointColor(index) {
  return DATA_POINT_PALETTE[index % DATA_POINT_PALETTE.length]
}

function getContrastTextColor(hexFill) {
  const r = parseInt(hexFill.slice(1, 3), 16)
  const g = parseInt(hexFill.slice(3, 5), 16)
  const b = parseInt(hexFill.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#1f2937' : '#fefce8'
}

export function ChartSpecRenderer({ spec }) {
  const theme = useTheme()
  const svgRef = useRef(null)
  const { sendMessage } = useCopilotChat()
  const data = Array.isArray(spec.data) ? spec.data : []

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return

    d3.select(svgRef.current).selectAll('*').remove()

    const width = Math.max(svgRef.current.parentElement.clientWidth || 400, 400)
    const isHorizontalBar = spec.type !== 'treemap' && data.length > 8
    const isTreemap = spec.type === 'treemap'
    const leftMargin = isHorizontalBar ? 160 : MARGIN.left
    const chartHeight = isHorizontalBar
      ? Math.min(Math.max(280, data.length * 26), 620)
      : isTreemap
        ? Math.min(Math.max(320, Math.ceil(Math.sqrt(data.length) * 80)), 640)
        : HEIGHT
    const innerWidth = width - leftMargin - MARGIN.right
    const innerHeight = chartHeight - MARGIN.top - MARGIN.bottom

    const svg = d3.select(svgRef.current).attr('width', width).attr('height', chartHeight).style('overflow', 'visible')
    const g = svg.append('g').attr('transform', `translate(${leftMargin},${MARGIN.top})`)

    if (spec.type === 'treemap') {
      // Treemap: interpret x as label and y as value for a flat hierarchy.
      const root = d3
        .hierarchy({
          name: spec.title,
          children: data.map((d) => ({ name: d.x, value: d.y }))
        })
        .sum((d) => d.value)

      d3.treemap().size([innerWidth, innerHeight]).paddingInner(2).round(true)(root)

      const nodes = g
        .selectAll('g.node')
        .data(root.leaves())
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', (d) => `translate(${d.x0},${d.y0})`)

      nodes
        .append('rect')
        .attr('width', (d) => Math.min(d.x1 - d.x0, innerWidth - d.x0))
        .attr('height', (d) => Math.min(d.y1 - d.y0, innerHeight - d.y0))
        .attr('fill', (_, i) => getDataPointColor(i))
        .attr('title', (d) => `${d.data?.name ?? ''}: ${d.value ?? 0}`)
        .style('cursor', 'pointer')
        .on('mouseover', function () {
          d3.select(this).attr('opacity', 0.8)
        })
        .on('mouseout', function () {
          d3.select(this).attr('opacity', 1)
        })
        .on('click', (_, d) => {
          const name = d.data?.name ?? ''
          const value = d.value ?? 0
          const message = `I clicked on segment "${name}" in the treemap titled "${spec.title}". The value shown is ${value}. Help me understand what this means and what I should explore next from a marketing perspective.`
          console.log(message, 'message')
          // sendMessage(message)
        })

      // Add labels when tiles are large enough to be legible (black text).
      nodes
        .append('text')
        .attr('x', 4)
        .attr('y', 16)
        .attr('fill', DATA_LABEL_FILL)
        .attr('font-size', 11)
        .each(function (d) {
          const node = d3.select(this)
          const w = d.x1 - d.x0
          const h = d.y1 - d.y0
          if (w < 40 || h < 24) {
            node.remove()
            return
          }
          const name = d.data?.name ?? ''
          node.text(name.length > 20 ? `${name.slice(0, 17)}…` : name)
        })
    } else {
      // Bar chart: use horizontal bars when many categories so labels stay readable.
      const manyCategories = data.length > 8
      const maxLabelLen = 18
      const truncate = (s) => (s.length > maxLabelLen ? `${s.slice(0, maxLabelLen)}…` : s)

      if (manyCategories) {
        // Horizontal bar chart: labels on y-axis (no overlap), values on x-axis.
        const yScale = d3
          .scaleBand()
          .domain(data.map((d) => d.x))
          .range([0, innerHeight])
          .padding(0.25)

        const xScale = d3
          .scaleLinear()
          .domain([0, d3.max(data, (d) => d.y)])
          .nice()
          .range([0, innerWidth])

        const yAxis = g.append('g').call(d3.axisLeft(yScale).tickFormat(truncate).tickSizeOuter(0))
        yAxis
          .selectAll('text')
          .attr('font-size', data.length > 14 ? 10 : 11)
          .attr('fill', DATA_LABEL_FILL)
        const xAxisBottom = g
          .append('g')
          .attr('transform', `translate(0,${innerHeight})`)
          .call(d3.axisBottom(xScale).ticks(5))
        xAxisBottom.selectAll('text').attr('fill', DATA_LABEL_FILL)

        g.selectAll('.bar')
          .data(data)
          .enter()
          .append('rect')
          .attr('y', (d) => yScale(d.x))
          .attr('x', 0)
          .attr('height', yScale.bandwidth())
          .attr('width', (d) => xScale(d.y))
          .attr('fill', (_, i) => getDataPointColor(i))
          .style('cursor', 'pointer')
          .on('mouseover', function () {
            d3.select(this).attr('opacity', 0.7)
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 1)
          })
          .on('click', (_, d) => {
            const message = `I clicked on "${d.x}" in the chart titled "${spec.title}". The value shown is ${d.y}. Help me understand what this means and what I should explore next from a marketing perspective.`
            sendMessage(message)
          })
      } else {
        // Vertical bar chart: rotate x-axis labels to avoid overlap.
        const xScale = d3
          .scaleBand()
          .domain(data.map((d) => d.x))
          .range([0, innerWidth])
          .padding(0.3)

        const yScale = d3
          .scaleLinear()
          .domain([0, d3.max(data, (d) => d.y)])
          .nice()
          .range([innerHeight, 0])

        const xAxis = g.append('g').attr('transform', `translate(0,${innerHeight})`)
        xAxis.call(d3.axisBottom(xScale).tickFormat(truncate))
        xAxis
          .selectAll('text')
          .attr('transform', 'rotate(-45)')
          .style('text-anchor', 'end')
          .attr('fill', DATA_LABEL_FILL)

        const yAxisLeft = g.append('g').call(d3.axisLeft(yScale).ticks(5))
        yAxisLeft.selectAll('text').attr('fill', DATA_LABEL_FILL)

        g.selectAll('.bar')
          .data(data)
          .enter()
          .append('rect')
          .attr('x', (d) => xScale(d.x))
          .attr('y', (d) => yScale(d.y))
          .attr('width', xScale.bandwidth())
          .attr('height', (d) => innerHeight - yScale(d.y))
          .attr('fill', (_, i) => getDataPointColor(i))
          .style('cursor', 'pointer')
          .on('mouseover', function () {
            d3.select(this).attr('opacity', 0.7)
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 1)
          })
          .on('click', (_, d) => {
            const message = `I clicked on "${d.x}" in the chart titled "${spec.title}". The value shown is ${d.y}. Help me understand what this means and what I should explore next from a marketing perspective.`
            sendMessage(message)
          })
      }
    }
  }, [data, spec, theme, sendMessage])

  return (
    <Paper variant="outlined" sx={{ p: 2, overflow: 'visible' }}>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {spec.title}
      </Typography>
      <div style={{ overflow: 'visible', minHeight: 200 }}>
        <svg ref={svgRef} style={{ display: 'block' }} />
      </div>
    </Paper>
  )
}
