/**
 * HTTP API Server for Browser Automation
 * 
 * Express-based REST API for running browser automation tasks.
 * 
 * Usage:
 *   npm run start:http
 *   # or
 *   node servers/http-server.js
 * 
 * Endpoints:
 *   POST /api/run         - Run agent with goal
 *   POST /api/extract     - Extract data from URL
 *   POST /api/workflow    - Execute .wky workflow
 *   GET  /api/status      - Get server status
 *   GET  /api/health      - Health check
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

// Load env from core directory
require('dotenv').config({ path: path.join(__dirname, '..', 'core', '.env') });

// Import from core
const { BrowserAutomationAPI, runAgent, executeWorkflow, SkillOrchestrator, skills, BrowserManager, createAdapter } = require('../core');
const { PageStateExtractor } = require('../core/src/browser/page-state-extractor');
const { ActionExecutor } = require('../core/src/actions');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { createMcpServer } = require('./mcp-setup');

const app = express();
const PORT = process.env.HTTP_PORT || 3000;

// Initialize MCP Server for SSE
let mcpServer = null;
let mcpTransport = null;

try {
    mcpServer = createMcpServer();
    // note: we don't 'connect' the transport yet, we do it per request or handle it differently for SSE
    console.log('[MCP] Initialized shared MCP server instance');
} catch (e) {
    console.error('[MCP] Failed to initialize:', e);
}

// ... existing code ...

// ============================================================================
// Remote MCP (SSE) Endpoints
// ============================================================================

/**
 * GET /mcp/sse
 * Establish Server-Sent Events connection for MCP
 */
app.get('/mcp/sse', async (req, res) => {
    console.log('[MCP] New SSE connection');

    mcpTransport = new SSEServerTransport('/mcp/messages', res);
    await mcpServer.connect(mcpTransport);
});

/**
 * POST /mcp/messages
 * Receive JSON-RPC messages from MCP client
 */
app.post('/mcp/messages', async (req, res) => {
    // console.log('[MCP] Message received');
    if (!mcpTransport) {
        return res.status(400).json({ error: 'No active SSE connection' });
    }

    await mcpTransport.handlePostMessage(req, res);
});

// Active sessions storage
const sessions = new Map();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});

// ============================================================================
// Health & Status
// ============================================================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/status', (req, res) => {
    res.json({
        status: 'running',
        activeSessions: sessions.size,
        uptime: process.uptime()
    });
});

// ============================================================================
// Agent Endpoints
// ============================================================================

/**
 * POST /api/run
 * Run agent with a goal
 * 
 * Body: { goal: string, url?: string, options?: { headless?, llmProvider?, maxSteps? } }
 */
app.post('/api/run', async (req, res) => {
    const { goal, url, options = {} } = req.body;

    if (!goal) {
        return res.status(400).json({ error: 'goal is required' });
    }

    try {
        console.log(`[run] Starting: ${goal.substring(0, 50)}...`);

        const result = await runAgent(goal, {
            headless: options.headless ?? true,
            llmProvider: options.llmProvider || 'gemini',
            maxSteps: options.maxSteps || 50
        });

        console.log(`[run] Completed: ${result.success ? 'success' : 'failed'}`);
        res.json(result);
    } catch (error) {
        console.error(`[run] Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/extract
 * Extract data from a URL
 * 
 * Body: { url: string, extractionGoal: string, options?: object }
 */
app.post('/api/extract', async (req, res) => {
    const { url, extractionGoal, options = {} } = req.body;

    if (!url || !extractionGoal) {
        return res.status(400).json({ error: 'url and extractionGoal are required' });
    }

    try {
        const goal = `Go to ${url} and ${extractionGoal}`;
        const result = await runAgent(goal, {
            headless: options.headless ?? true,
            llmProvider: options.llmProvider || 'gemini'
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/workflow
 * Execute a .wky workflow file
 * 
 * Body: { path: string, options?: object }
 */
app.post('/api/workflow', async (req, res) => {
    const { path: wkyPath, options = {} } = req.body;

    if (!wkyPath) {
        return res.status(400).json({ error: 'path is required' });
    }

    try {
        const fullPath = path.isAbsolute(wkyPath)
            ? wkyPath
            : path.join(__dirname, '..', wkyPath);

        const result = await executeWorkflow(fullPath, options);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Skills Endpoints
// ============================================================================

/**
 * GET /api/skills
 * List all available skills
 */
app.get('/api/skills', (req, res) => {
    const orchestrator = new SkillOrchestrator(null);
    orchestrator.loadPlugins();
    const skillsMetadata = orchestrator.getSkillsMetadata();
    res.json({
        count: skillsMetadata.length,
        skills: skillsMetadata
    });
});

/**
 * POST /api/skill
 * Execute a skill with natural language command
 * 
 * Body: { command: string, options?: { headless?: boolean, llmProvider?: string } }
 */
app.post('/api/skill', async (req, res) => {
    const { command, options = {} } = req.body;

    if (!command) {
        return res.status(400).json({ error: 'command is required' });
    }

    console.log(`[skill] Processing: "${command.substring(0, 50)}..."`);

    let browserManager = null;

    try {
        // Create dependencies
        browserManager = new BrowserManager({
            headless: options.headless ?? true,
            chromePath: process.env.CHROME_PATH
        });

        const llmAdapter = createAdapter(options.llmProvider || 'gemini');

        // Create orchestrator
        const orchestrator = new SkillOrchestrator(llmAdapter);
        orchestrator.loadPlugins();

        // Launch browser
        const { page } = await browserManager.launch();
        const executor = new ActionExecutor(page);

        // Dependencies for skills
        const deps = {
            browserManager,
            executor,
            llm: llmAdapter,
            pageStateExtractor: new PageStateExtractor(page)
        };

        // Route and execute
        const result = await orchestrator.routeAndExecute(command, deps);

        console.log(`[skill] Completed: ${result.success ? 'success' : 'failed'}`);
        res.json(result);

    } catch (error) {
        console.error(`[skill] Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    } finally {
        if (browserManager) {
            await browserManager.close();
        }
    }
});

/**
 * POST /api/skill/:type
 * Execute a specific skill directly
 * 
 * Body: { args: object, options?: object }
 */
app.post('/api/skill/:type', async (req, res) => {
    const { type } = req.params;
    const { args = {}, options = {} } = req.body;

    console.log(`[skill] Direct execute: ${type}`);

    let browserManager = null;

    try {
        // Create dependencies
        browserManager = new BrowserManager({
            headless: options.headless ?? true,
            chromePath: process.env.CHROME_PATH
        });

        const llmAdapter = createAdapter(options.llmProvider || 'gemini');

        // Create orchestrator
        const orchestrator = new SkillOrchestrator(llmAdapter);
        orchestrator.loadPlugins();

        // Check skill exists
        if (!orchestrator.skills.has(type)) {
            return res.status(404).json({
                error: `Skill not found: ${type}`,
                available: orchestrator.getSkillsMetadata().map(s => s.type)
            });
        }

        // Launch browser
        const { page } = await browserManager.launch();
        const executor = new ActionExecutor(page);

        // Dependencies for skills
        const deps = {
            browserManager,
            executor,
            llm: llmAdapter,
            pageStateExtractor: new PageStateExtractor(page)
        };

        // Execute skill directly
        const result = await orchestrator.execute(type, args, deps);

        console.log(`[skill] ${type} completed: ${result.success ? 'success' : 'failed'}`);
        res.json(result);

    } catch (error) {
        console.error(`[skill] ${type} error: ${error.message}`);
        res.status(500).json({ error: error.message });
    } finally {
        if (browserManager) {
            await browserManager.close();
        }
    }
});

// ============================================================================
// Session Endpoints (Persistent browser sessions)
// ============================================================================

/**
 * POST /api/session
 * Create a new browser session
 * 
 * Body: { options?: object }
 */
app.post('/api/session', async (req, res) => {
    const { options = {}, type = 'agent' } = req.body;
    const sessionId = `session_${Date.now()}`;

    try {
        const api = new BrowserAutomationAPI({
            headless: options.headless ?? true,
            llmProvider: options.llmProvider || 'gemini'
        });

        const session = {
            api,
            type,
            createdAt: new Date(),
            controller: null
        };

        if (type === 'direct') {
            session.controller = api.createDirectController();
        }

        sessions.set(sessionId, session);

        res.json({
            sessionId,
            type,
            status: 'created',
            message: `Session created (${type}).`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/session/:id/run
 * Run a goal in an existing session
 */
app.post('/api/session/:id/run', async (req, res) => {
    const { id } = req.params;
    const { goal, url } = req.body;

    const session = sessions.get(id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        const result = await session.api.run(goal, url);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/session/:id
 * Close a session
 */
app.delete('/api/session/:id', async (req, res) => {
    const { id } = req.params;
    const session = sessions.get(id);

    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    try {
        await session.api.close();
        sessions.delete(id);
        res.json({ status: 'closed' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/session/:id/tool
 * Execute a direct tool (open, analyze, click, etc.)
 */
app.post('/api/session/:id/tool', async (req, res) => {
    const { id } = req.params;
    const { tool, args = {} } = req.body;

    const session = sessions.get(id);
    if (!session) {
        return res.status(404).json({ error: 'Session not found' });
    }

    if (session.type !== 'direct' || !session.controller) {
        return res.status(400).json({ error: 'Session is not in direct mode' });
    }

    try {
        let result;
        const controller = session.controller;

        switch (tool) {
            case 'open':
                result = await controller.open(args.url);
                break;
            case 'analyze':
                result = await controller.analyze();
                break;
            case 'click':
                result = await controller.click(args.elementId);
                break;
            case 'type':
                result = await controller.type(args.elementId, args.text, args.pressEnter);
                break;
            case 'scroll':
                result = await controller.scroll(args.direction, args.amount);
                break;
            case 'screenshot':
                result = await controller.screenshot();
                break;
            case 'get_state':
                result = await controller.getState();
                break;
            case 'close':
                result = await controller.close();
                break;
            default:
                return res.status(400).json({ error: `Unknown tool: ${tool}` });
        }

        res.json({ success: true, result });
    } catch (error) {
        console.error(`[tool:${tool}] Error:`, error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/sessions
 * List all active sessions
 */
app.get('/api/sessions', (req, res) => {
    const list = Array.from(sessions.entries()).map(([id, session]) => ({
        id,
        createdAt: session.createdAt,
        status: session.api.getStatus()
    }));
    res.json(list);
});

// ============================================================================
// Error Handler
// ============================================================================

app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║   Browser Automation HTTP API                          ║
╠════════════════════════════════════════════════════════╣
║   Server running on: http://localhost:${PORT}              ║
║                                                        ║
║   Endpoints:                                           ║
║     POST /api/run       - Run agent with goal          ║
║     POST /api/extract   - Extract data from URL        ║
║     POST /api/workflow  - Execute .wky workflow        ║
║     GET  /api/status    - Server status                ║
║     GET  /api/health    - Health check                 ║
║                                                        ║
║   Skills:                                              ║
║     GET  /api/skills         - List available skills   ║
║     POST /api/skill          - Execute skill (NL)      ║
║     POST /api/skill/:type    - Execute skill directly  ║
║                                                        ║
║   Sessions:                                            ║
║     POST   /api/session      - Create session          ║
║     POST   /api/session/:id/run - Run in session       ║
║     DELETE /api/session/:id  - Close session           ║
╚════════════════════════════════════════════════════════╝
`);
});

module.exports = app;
