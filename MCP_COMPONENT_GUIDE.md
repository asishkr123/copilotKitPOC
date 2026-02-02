# MCP Component Rendering Guide

## Overview

This document explains how MCP (Model Context Protocol) servers should structure their responses to render UI components in the CopilotKit-based chat application.

## Component ID System

Each UI component has a unique `componentId`. Your MCP server returns:
1. **componentId**: Suggests which component to render
2. **data**: Raw data from your MCP tool
3. **meta** (optional): Additional metadata like title

**The agent handles data normalization** - you just provide the raw data and suggest the component type.

## Available Components

| Component ID | Description | Use Case |
|-------------|-------------|----------|
| `chart-bar` | Bar Chart | Rankings, comparisons, categorical data |
| `chart-line` | Line Chart | Trends over time, time series data |
| `chart-treemap` | Treemap | Hierarchical data, market share distribution |
| `kpi-single` | Single KPI Card | Single metric or key performance indicator |
| `text-plain` | Plain Text | Messages, descriptions, error states |

## Response Format

### Standard MCP Response (Simplified)

```json
{
  "componentId": "chart-bar",
  "data": [
    { "label": "Brand A", "value": 45.2 },
    { "label": "Brand B", "value": 32.1 },
    { "label": "Brand C", "value": 22.7 }
  ],
  "meta": {
    "title": "Top Brands in Shampoos"
  }
}
```

**That's it!** The agent will normalize your data into the correct component structure.

## What Data Should You Send?

The agent normalizes your raw data, so you can send data in flexible formats:

### For Charts (bar, line, treemap)

**Option 1**: Array of objects with `label` and `value`:
```json
{
  "componentId": "chart-bar",
  "data": [
    { "label": "Brand A", "value": 45.2 },
    { "label": "Brand B", "value": 32.1 }
  ],
  "meta": { "title": "Top Brands" }
}
```

**Option 2**: Array of objects with `x` and `y`:
```json
{
  "componentId": "chart-line",
  "data": [
    { "x": "Jan", "y": 100 },
    { "x": "Feb", "y": 120 }
  ],
  "meta": { "title": "Monthly Trend" }
}
```

**Option 3**: Legacy format with `chartType`:
```json
{
  "chartType": "treemap",
  "title": "Market Distribution",
  "data": [
    { "label": "Brand A", "value": 450 },
    { "label": "Brand B", "value": 320 }
  ]
}
```

The agent will convert all of these to the standard `{x, y}` format.

---

### For KPI

**Send label and value**:
```json
{
  "componentId": "kpi-single",
  "data": {
    "label": "Total Market Share",
    "value": "67.8%"
  }
}
```

**Or just the fields directly**:
```json
{
  "componentId": "kpi-single",
  "label": "Total Market Share",
  "value": "67.8%"
}
```

---

### For Text

**Option 1**: Just the text:
```json
{
  "componentId": "text-plain",
  "data": {
    "text": "No data available."
  }
}
```

**Option 2**: Text at root:
```json
{
  "componentId": "text-plain",
  "text": "No data available."
}
```

---

## Fallback Behavior

**No componentId?** → Agent infers from data structure
**No data?** → Falls back to `text-plain`
**Invalid data?** → Falls back to `text-plain` with error message

---

## Decision Guide

### When to use which component?

| User Query | Data Type | Recommended Component | Reasoning |
|------------|-----------|----------------------|-----------|
| "Top 5 brands" | 5 items | `chart-bar` | Small list, bar chart shows ranking clearly |
| "Best brands" | 20+ items | `chart-bar` | Bar chart with scrolling for many items |
| "Market share distribution" | 10+ items | `chart-treemap` | Treemap shows proportions better |
| "Brand trends" | Time series | `chart-line` | Line chart for trends over time |
| "What's the total?" | Single number | `kpi-single` | Clean display for single metric |
| "No data found" | None | `text-plain` | Message to user |

### Number of Data Points

- **1 data point**: Use `kpi-single` (e.g., "Top brand: Brand A")
- **2-5 data points**: Use `chart-bar` (vertical bars)
- **6-15 data points**: Use `chart-bar` (horizontal bars) or `chart-treemap`
- **15+ data points**: Use `chart-treemap` for proportions, `chart-bar` for rankings
- **Time series**: Always use `chart-line`

---

## Complete Examples

### Example 1: Top Brands Query

**Query**: "Show me the top brands in shampoos"

**MCP Response**:
```json
{
  "componentId": "chart-bar",
  "componentData": {
    "title": "Top Brands in Shampoos",
    "data": [
      { "x": "Head & Shoulders", "y": 24.5 },
      { "x": "Pantene", "y": 18.3 },
      { "x": "Dove", "y": 15.7 },
      { "x": "L'Oréal", "y": 12.4 },
      { "x": "Garnier", "y": 9.8 }
    ]
  },
  "meta": {
    "title": "Top Brands in Shampoos",
    "description": "Market share by brand for August 2025",
    "timestamp": "2026-02-02T12:00:00Z"
  }
}
```

**Rendered**: Vertical bar chart with 5 brands

---

### Example 2: Market Distribution

**Query**: "Show market share distribution across all brands"

**MCP Response**:
```json
{
  "componentId": "chart-treemap",
  "componentData": {
    "title": "Hair Care Market Share Distribution",
    "data": [
      { "x": "Head & Shoulders", "y": 245 },
      { "x": "Pantene", "y": 183 },
      { "x": "Dove", "y": 157 },
      { "x": "L'Oréal", "y": 124 },
      { "x": "Garnier", "y": 98 },
      { "x": "Sunsilk", "y": 76 },
      { "x": "TRESemmé", "y": 65 },
      { "x": "Herbal Essences", "y": 54 },
      { "x": "Others", "y": 198 }
    ]
  }
}
```

**Rendered**: Treemap showing proportional sizes

---

### Example 3: Total Market Cap

**Query**: "What's the total market cap of top 3 brands?"

**MCP Response**:
```json
{
  "componentId": "kpi-single",
  "componentData": {
    "label": "Total Market Share (Top 3 Brands)",
    "value": "58.5%"
  }
}
```

**Rendered**: Large KPI card

---

### Example 4: Trend Over Time

**Query**: "Show Pantene's performance over the last 6 months"

**MCP Response**:
```json
{
  "componentId": "chart-line",
  "componentData": {
    "title": "Pantene Market Share Trend",
    "data": [
      { "x": "Aug 2025", "y": 17.2 },
      { "x": "Sep 2025", "y": 17.8 },
      { "x": "Oct 2025", "y": 17.5 },
      { "x": "Nov 2025", "y": 18.1 },
      { "x": "Dec 2025", "y": 18.6 },
      { "x": "Jan 2026", "y": 18.3 }
    ]
  }
}
```

**Rendered**: Line chart showing trend

---

### Example 5: No Data

**Query**: "Show me brands in electronics"

**MCP Response**:
```json
{
  "componentId": "text-plain",
  "componentData": {
    "text": "We don't have data for the 'electronics' category. We have data for hair care, skin care, detergents, and body wash. Would you like to see data for one of these categories?"
  }
}
```

**Rendered**: Text message in a card

---

## Error Handling

### When MCP Returns an Error

```json
{
  "componentId": "text-plain",
  "componentData": {
    "text": "Error: Unable to fetch data. Please try again later."
  }
}
```

### When Data is Empty

```json
{
  "componentId": "text-plain",
  "componentData": {
    "text": "No results found for your query."
  }
}
```

---

## Best Practices

### 1. Choose the Right Component

- **DO**: Use `chart-treemap` for 10+ items showing proportions
- **DON'T**: Use `chart-bar` for 50+ items (too crowded)

### 2. Provide Clear Titles

```json
// ✅ Good
"title": "Top 5 Shampoo Brands by Market Share (Aug 2025)"

// ❌ Bad
"title": "Data"
```

### 3. Format Data Appropriately

```json
// ✅ Good - Clear labels, reasonable precision
{ "x": "Head & Shoulders", "y": 24.5 }

// ❌ Bad - Unclear label, too much precision
{ "x": "HS", "y": 24.527839472 }
```

### 4. Use Consistent Naming

```json
// ✅ Good - Consistent brand names
["Pantene", "Pantene Pro-V", "Pantene Total Care"]

// ❌ Bad - Inconsistent
["Pantene", "pantene", "PANTENE", "Panten"]
```

### 5. Handle Edge Cases

```javascript
// When you have only 1 result
if (results.length === 1) {
  return {
    componentId: "kpi-single",
    componentData: {
      label: "Top Brand",
      value: results[0].name
    }
  }
}

// When you have no results
if (results.length === 0) {
  return {
    componentId: "text-plain",
    componentData: {
      text: "No data available. Try a different query."
    }
  }
}

// When you have many results (6+)
if (results.length >= 6) {
  return {
    componentId: "chart-treemap",
    componentData: {
      title: "Market Share Distribution",
      data: results.map(r => ({ x: r.name, y: r.value }))
    }
  }
}
```

---

## Multi-Component Scenarios

When the agent calls multiple MCP tools, components are automatically laid out. You don't need to handle this in your MCP server.

**Example**: User asks "Compare shampoos vs detergents"

1. Agent calls `getTopBrands({ category: 'shampoos' })`
2. Agent calls `getTopBrands({ category: 'detergents' })`
3. Agent receives two `chart-bar` responses
4. Agent calls `renderMultiComponent` with layout: "sideBySide"
5. UI shows both charts side-by-side

**Your MCP server** just returns the same format for each tool call.

---

## Testing Your MCP Responses

### 1. Valid Response Checklist

- [ ] `componentId` is one of: `chart-bar`, `chart-line`, `chart-treemap`, `kpi-single`, `text-plain`
- [ ] `componentData` contains all required fields for that component
- [ ] Chart data arrays are not empty
- [ ] Numeric values are actual numbers, not strings
- [ ] Labels are clear and descriptive

### 2. Sample Test Cases

```javascript
// Test 1: Bar chart with 5 items
{
  "componentId": "chart-bar",
  "componentData": {
    "title": "Test Bar Chart",
    "data": [
      { "x": "Item 1", "y": 100 },
      { "x": "Item 2", "y": 80 },
      { "x": "Item 3", "y": 60 },
      { "x": "Item 4", "y": 40 },
      { "x": "Item 5", "y": 20 }
    ]
  }
}

// Test 2: KPI
{
  "componentId": "kpi-single",
  "componentData": {
    "label": "Test Metric",
    "value": "42"
  }
}

// Test 3: Text
{
  "componentId": "text-plain",
  "componentData": {
    "text": "This is a test message."
  }
}
```

---

## Migration from Legacy Format

### Old Format (Deprecated)

```json
{
  "chartType": "bar",
  "title": "Top Brands",
  "data": [
    { "label": "Brand A", "value": 45 }
  ]
}
```

### New Format (Current)

```json
{
  "componentId": "chart-bar",
  "componentData": {
    "title": "Top Brands",
    "data": [
      { "x": "Brand A", "y": 45 }
    ]
  }
}
```

**Key Changes**:
1. Add `componentId` field (e.g., `chart-bar`)
2. Wrap data in `componentData` object
3. Use `x` and `y` instead of `label` and `value`
4. Remove top-level `chartType`, `title` fields (move to `componentData`)

### Backward Compatibility

The system supports legacy formats through automatic conversion:
- `chartType: "bar"` → `componentId: "chart-bar"`
- `{ label, value }` → `componentId: "kpi-single"`
- No structure → `componentId: "text-plain"`

However, **please update your MCP server** to use the new format for best results.

---

## FAQ

**Q: Can I create custom components?**  
A: Yes, but you need to register them in the component registry. Contact the frontend team.

**Q: What if I want to show both a chart and a KPI?**  
A: Return one component per MCP tool. If needed, create multiple MCP tools that the agent can call.

**Q: Can I override the agent's decision?**  
A: No. The `componentId` you return is final. The agent respects your decision.

**Q: What's the maximum number of data points?**  
A: No hard limit, but UX degrades above 50 items for bar charts. Use treemap or pagination.

**Q: Can I use HTML in text?**  
A: No, `text-plain` renders plain text only. Use `\n` for line breaks.

**Q: Do I need to handle mobile vs desktop?**  
A: No, the UI components are responsive and handle different screen sizes.

---

## Support

For questions or issues:
1. Check this guide first
2. Review the [implementation plan](./implementation_plan.md)
3. Test with sample responses above
4. Contact the frontend team if stuck

---

**Version**: 1.0.0  
**Last Updated**: 2026-02-02  
**Component Registry**: `/app/components/component-registry.js`
