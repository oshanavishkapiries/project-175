# Browser Automation Agent - Test Commands

Copy and paste these commands to test the agent.

---

## Basic Tests

```bash
# Google search (simple)
npm run agent https://www.google.com "Search for weather in Tokyo"
```

```bash
# Amazon best sellers (data extraction)
npm run agent https://www.amazon.sg/gp/bestsellers/books "Find top 5 best selling books with titles and prices"
```

---

## With LLM Provider Selection

```bash
# Using Gemini (default)
npm run agent https://www.google.com "Search for latest news" -- --llm gemini
```

```bash
# Using Cerebras (higher token limits)
npm run agent https://www.google.com "Search for weather forecast" -- --llm cerebras
```

---

## Headless Mode (no browser window)

```bash
npm run agent https://www.google.com "Search for Python tutorials" -- --headless
```

---

## Data Extraction Examples

```bash
# Extract product data (JSON output)
npm run agent https://www.amazon.sg/s?k=laptop "Search for laptops and extract top 5 product names and prices"
```

```bash
# Get summary (Markdown output)
npm run agent https://en.wikipedia.org/wiki/Tokyo "Get a summary of Tokyo including population and area"
```

---

## Other Utilities

```bash
# Simplify HTML file
npm run simplify data/html-pages/sample.html
```

```bash
# Count tokens in HTML
npm run tokens data/simplified-html/sample.html
```

```bash
# Count tokens and save report
npm run tokens:save data/simplified-html/sample.html
```
