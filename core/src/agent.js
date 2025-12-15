/**
 * Browser Automation Agent
 * Autonomous agent that uses LLM to navigate and interact with web pages
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Use stealth plugin to avoid bot detection
chromium.use(StealthPlugin());

const { createAdapter, config } = require('./llm');
const { parseAction, isTerminal, ActionExecutor } = require('./actions');
const { simplifyHTML } = require('./scripts/simplify-html');
const { AgentTUI } = require('./scripts/tui');
const { ElementHighlighter } = require('./scripts/highlighter');

class Agent {
    constructor(options = {}) {
        this.options = {
            headless: options.headless ?? false,
            maxSteps: options.maxSteps ?? config.agent.maxSteps,
            waitBetweenActions: options.waitBetweenActions ?? config.agent.waitBetweenActions,
            verbose: options.verbose ?? config.agent.verbose,
            llmProvider: options.llmProvider ?? config.defaultProvider,
            useTUI: options.useTUI ?? true,
            ...options
        };

        this.llm = null;
        this.browser = null;
        this.page = null;
        this.executor = null;

        // Session data
        this.sessionId = this.generateSessionId();
        this.actionLog = [];
        this.extractedData = null;
        this.currentStep = 0;

        // Cookies directory
        this.cookiesDir = path.join(__dirname, '..', 'data', 'cookies');

        // TUI
        this.tui = this.options.useTUI ? new AgentTUI() : null;

        // Visual highlighter (only when not headless)
        this.highlighter = null;
    }

    generateSessionId() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    }

    async initialize() {
        if (this.tui) {
            this.tui.log('Starting agent...', 'info');
        } else {
            console.log('[init] Starting agent...');
        }

        // Initialize LLM adapter
        this.llm = createAdapter(this.options.llmProvider);
        if (this.tui) {
            this.tui.log(`LLM: ${this.llm.getModelInfo().model}`, 'llm');
        } else {
            console.log(`[init] LLM: ${this.llm.getModelInfo().model}`);
        }

        // Use persistent browser profile (like a real human's browser)
        const userDataDir = config.browser.userDataDir || path.join(__dirname, '..', 'data', 'browser-profile');

        // Ensure profile directory exists
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }

        if (this.tui) {
            this.tui.log(`Profile: ${path.basename(userDataDir)}`, 'info');
        } else {
            console.log(`[init] Profile: ${path.basename(userDataDir)}`);
        }

        // Launch persistent context (saves cookies, history, localStorage)
        const context = await chromium.launchPersistentContext(userDataDir, {
            executablePath: config.browser.chromePath,
            headless: this.options.headless ?? config.browser.headless,
            viewport: { width: 1920, height: 1080 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            locale: 'en-US',
            timezoneId: 'Asia/Colombo',
            ignoreHTTPSErrors: true,
            args: [
                '--disable-blink-features=AutomationControlled',
                '--no-first-run',
                '--no-default-browser-check'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        // Store context as browser for compatibility
        this.browser = context;
        this.page = context.pages()[0] || await context.newPage();
        this.executor = new ActionExecutor(this.page);

        if (this.tui) {
            this.tui.log('Browser ready', 'success');
        } else {
            console.log('[init] Browser ready (persistent profile)');
        }
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            if (this.tui) {
                this.tui.log('Browser closed', 'info');
            } else {
                console.log('[done] Browser closed');
            }
        }
    }

    /**
     * Pre-load cookies by checking if goal or URL contains any cookie filename
     * Scans cookies folder, if goal/url contains filename (without .json), load it
     * @param {string} goal - The user's goal text
     * @param {string} url - The URL being navigated to
     */
    async preloadCookiesFromGoal(goal, url = '') {
        // Ensure cookies directory exists
        if (!fs.existsSync(this.cookiesDir)) {
            fs.mkdirSync(this.cookiesDir, { recursive: true });
            if (this.tui) {
                this.tui.log('Created cookies folder', 'cookie');
            } else {
                console.log('[cookies] Created cookies folder');
            }
            return;
        }

        // Get all cookie files from folder
        const cookieFiles = fs.readdirSync(this.cookiesDir)
            .filter(file => file.endsWith('.json'));

        if (cookieFiles.length === 0) {
            if (this.tui) {
                this.tui.log('No cookie files found', 'warning');
            } else {
                console.log('[cookies] No cookie files in folder');
            }
            return;
        }

        console.log(`[cookies] Checking ${cookieFiles.length} cookie files`);

        // Combine goal and URL for matching
        const searchText = `${goal} ${url}`.toLowerCase();
        let loaded = false;

        for (const file of cookieFiles) {
            // Get filename without .json extension (e.g., "linkedin.com" from "linkedin.com.json")
            const domain = file.replace('.json', '').toLowerCase();
            const shortName = domain.split('.')[0]; // e.g., "linkedin" from "linkedin.com"

            // Check if goal OR url contains this domain or short name
            if (searchText.includes(domain) || searchText.includes(shortName)) {
                const cookiePath = path.join(this.cookiesDir, file);
                try {
                    const cookieData = fs.readFileSync(cookiePath, 'utf8');
                    const rawCookies = JSON.parse(cookieData);

                    if (Array.isArray(rawCookies) && rawCookies.length > 0) {
                        // Transform cookies to Playwright format (handle browser extension formats)
                        const cookies = rawCookies.map(c => ({
                            name: c.name,
                            value: c.value,
                            domain: c.domain,
                            path: c.path || '/',
                            expires: c.expires || c.expirationDate || -1,
                            httpOnly: c.httpOnly || false,
                            secure: c.secure || false,
                            sameSite: c.sameSite === 'no_restriction' ? 'None' :
                                c.sameSite === 'lax' ? 'Lax' :
                                    c.sameSite === 'strict' ? 'Strict' : 'None'
                        }));

                        await this.browser.addCookies(cookies);
                        if (this.tui) {
                            this.tui.log(`Loaded ${cookies.length} cookies from ${file}`, 'cookie');
                        } else {
                            console.log(`[cookies] ✓ Loaded ${cookies.length} cookies from ${file}`);
                        }
                        loaded = true;
                    }
                } catch (error) {
                    console.log(`[cookies] Error loading ${file}: ${error.message}`);
                }
            }
        }

        if (!loaded) {
            if (this.tui) {
                this.tui.log('No matching cookies for goal/url', 'warning');
            } else {
                console.log('[cookies] No matching cookie files for goal/url');
            }
        }
    }

    /**
     * Get simplified HTML and element map from current page
     */
    async getPageState() {
        // Wait for page to be stable (not navigating)
        await this.waitForPageStable();

        // Get current HTML
        const html = await this.page.content();

        // Save to temp file for simplification
        const tempDir = path.join(__dirname, '..', 'data', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `page_${this.sessionId}_${Date.now()}.html`);
        fs.writeFileSync(tempFile, html, 'utf8');

        // Simplify HTML (silent when using TUI)
        const result = simplifyHTML(tempFile, { silent: !!this.tui });

        // Clean up temp file with retry (handle file locking)
        setTimeout(() => {
            try {
                if (fs.existsSync(tempFile)) {
                    fs.unlinkSync(tempFile);
                }
            } catch (e) {
                // Ignore cleanup errors
            }
        }, 1000);

        return {
            simplifiedHtml: result.simplifiedHTML,
            elementMap: result.elementMap,
            url: this.page.url()
        };
    }

    /**
     * Wait for page to be stable (not navigating)
     */
    async waitForPageStable() {
        try {
            // Wait for load state
            await this.page.waitForLoadState('domcontentloaded', { timeout: 10000 });

            // Additional wait for any pending navigation
            await this.page.waitForTimeout(500);

            // Wait for network to be idle (no more than 2 connections for 500ms)
            await this.page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
                // Network idle timeout is ok, page might have long-polling
            });
        } catch (error) {
            // If timeout, page should still be usable
            console.log('  [wait] page stabilizing...');
            await this.page.waitForTimeout(2000);
        }
    }

    /**
     * Run the autonomous agent loop
     * @param {string} url - Starting URL
     * @param {string} goal - User's goal
     * @returns {Object} - Execution result
     */
    async run(url, goal) {
        // Use TUI if enabled
        if (this.tui) {
            this.tui.start(url, goal);
            this.tui.maxSteps = this.options.maxSteps;
        } else {
            console.log('\n[agent] Browser Automation Agent');
            console.log(`[agent] URL: ${url}`);
            console.log(`[agent] Goal: ${goal}`);
            console.log(`[agent] Session: ${this.sessionId}\n`);
        }

        try {
            if (this.tui) this.tui.setStatus('initializing');
            await this.initialize();

            // Pre-load cookies for domains mentioned in the goal or URL
            await this.preloadCookiesFromGoal(goal, url);

            // Navigate to starting URL
            if (this.tui) {
                this.tui.log(`Navigating to ${url.substring(0, 50)}...`, 'nav');
            } else {
                console.log(`[nav] ${url}`);
            }
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.page.waitForTimeout(2000); // Wait for page to stabilize

            // Initialize highlighter if not headless
            if (!this.options.headless) {
                this.highlighter = new ElementHighlighter(this.page);
                await this.highlighter.injectStyles();
            }

            // Autonomous loop
            while (this.currentStep < this.options.maxSteps) {
                this.currentStep++;
                if (this.tui) {
                    this.tui.updateStep(this.currentStep);
                    this.tui.setStatus('running');
                } else {
                    console.log(`\n[step ${this.currentStep}/${this.options.maxSteps}]`);
                }

                // Get current page state
                // Get current page state (silent)
                const pageState = await this.getPageState();

                this.executor.setElementMap(pageState.elementMap);
                if (this.tui) {
                    this.tui.printElements(Object.keys(pageState.elementMap).length);
                } else {
                    console.log(`  elements: ${Object.keys(pageState.elementMap).length}`);
                }

                // Get action from LLM
                if (this.tui) this.tui.setStatus('thinking');
                const context = {
                    goal,
                    simplifiedHtml: pageState.simplifiedHtml,
                    elementMap: pageState.elementMap,
                    previousActions: this.actionLog.slice(-5), // Last 5 actions for context
                    currentUrl: pageState.url
                };

                const rawAction = await this.llm.generateAction(context);
                const action = parseAction(rawAction, pageState.elementMap);

                if (this.tui) {
                    this.tui.setStatus('acting');
                    this.tui.printAction(action.action_type, action.reasoning);
                } else {
                    console.log(`  action: ${action.action_type}`);
                    console.log(`  reason: ${action.reasoning.substring(0, 100)}${action.reasoning.length > 100 ? '...' : ''}`);
                }

                // Visual highlight on the element before action
                if (this.highlighter && action.element_id) {
                    await this.highlighter.highlightAction(action.element_id, action.action_type);
                    await this.highlighter.showToast(`${action.action_type.toUpperCase()}: ${action.element_id}`, 'action');
                }

                // Execute action
                const result = await this.executor.execute(action);

                // Log action
                const logEntry = {
                    step: this.currentStep,
                    ...action,
                    result: {
                        success: result.success,
                        error: result.error
                    }
                };
                this.actionLog.push(logEntry);

                // Check for terminal actions
                if (isTerminal(action.action_type)) {
                    if (this.tui) {
                        this.tui.setStatus('completed');
                        this.tui.log(`Task ${action.action_type}`, 'success');
                    } else {
                        console.log(`  [done] ${action.action_type}`);
                    }

                    // Capture extracted data and output preferences
                    if (action.extracted_data) {
                        this.extractedData = action.extracted_data;
                    }
                    if (action.output_format) {
                        this.outputFormat = action.output_format;
                    }
                    if (action.output_title) {
                        this.outputTitle = action.output_title;
                    }
                    break;
                }

                // Wait between actions
                if (this.options.waitBetweenActions > 0) {
                    await this.page.waitForTimeout(this.options.waitBetweenActions);
                }
            }

            if (this.currentStep >= this.options.maxSteps) {
                console.log(`[warn] Max steps (${this.options.maxSteps}) reached`);
            }

        } catch (error) {
            console.error(`\n❌ Agent error: ${error.message}`);
            this.actionLog.push({
                step: this.currentStep,
                action_type: 'error',
                error: error.message
            });
        } finally {
            await this.close();
        }

        // Save results
        const results = await this.saveResults();
        return results;
    }

    /**
     * Save action log and results
     * Also saves extracted data as JSON or Markdown based on LLM choice
     */
    async saveResults() {
        const projectRoot = path.join(__dirname, '..');
        const logsDir = path.join(projectRoot, 'data', 'action-logs');
        const outputDir = path.join(projectRoot, 'data', 'output');

        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const results = {
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            totalSteps: this.currentStep,
            status: this.getStatus(),
            extractedData: this.extractedData,
            outputFiles: [],
            actionLog: this.actionLog
        };

        // Save action log
        const logPath = path.join(logsDir, `${this.sessionId}.json`);
        fs.writeFileSync(logPath, JSON.stringify(results, null, 2), 'utf8');

        // Save extracted data if present
        if (this.extractedData) {
            const outputFiles = await this.saveExtractedData(outputDir);
            results.outputFiles = outputFiles;
        }


        // Display results
        if (this.tui) {
            this.tui.printResults(results);
        } else {
            console.log('\n[results]');
            console.log(`  status: ${results.status}`);
            console.log(`  steps: ${results.totalSteps}`);
            console.log(`  log: ${path.relative(projectRoot, logPath)}`);

            if (results.outputFiles.length > 0) {
                console.log('  output:');
                results.outputFiles.forEach(file => {
                    console.log(`    - ${path.relative(projectRoot, file.path)}`);
                });
            }

            if (this.extractedData?.summary) {
                console.log(`  summary: ${this.extractedData.summary}`);
            }
            console.log('');
        }

        return results;
    }

    /**
     * Save extracted data in appropriate format (JSON or Markdown)
     */
    async saveExtractedData(outputDir) {
        const savedFiles = [];

        // Get format and title from last action with extracted data
        const lastAction = this.actionLog.find(a =>
            a.extracted_data || a.output_format
        );

        const format = this.outputFormat || lastAction?.output_format || 'json';
        const title = this.outputTitle || lastAction?.output_title || `output_${this.sessionId}`;
        const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();

        if (format === 'markdown' || format === 'md') {
            // Save as Markdown
            const mdPath = path.join(outputDir, `${safeTitle}_${this.sessionId}.md`);
            let mdContent = '';

            if (typeof this.extractedData?.data === 'string') {
                mdContent = this.extractedData.data;
            } else {
                // Convert to markdown
                mdContent = `# ${title}\n\n`;
                mdContent += `> Generated: ${new Date().toISOString()}\n\n`;

                if (this.extractedData?.summary) {
                    mdContent += `## Summary\n${this.extractedData.summary}\n\n`;
                }

                if (this.extractedData?.source_url) {
                    mdContent += `**Source:** ${this.extractedData.source_url}\n\n`;
                }

                if (Array.isArray(this.extractedData?.data)) {
                    mdContent += `## Data\n\n`;
                    this.extractedData.data.forEach((item, i) => {
                        mdContent += `### ${i + 1}. ${item.title || item.name || `Item ${i + 1}`}\n`;
                        Object.entries(item).forEach(([key, value]) => {
                            if (key !== 'title' && key !== 'name') {
                                mdContent += `- **${key}:** ${value}\n`;
                            }
                        });
                        mdContent += '\n';
                    });
                } else if (typeof this.extractedData?.data === 'object') {
                    mdContent += `## Data\n\n`;
                    mdContent += '```json\n' + JSON.stringify(this.extractedData.data, null, 2) + '\n```\n';
                }
            }

            fs.writeFileSync(mdPath, mdContent, 'utf8');
            savedFiles.push({ format: 'markdown', path: mdPath });
            console.log(`📝 Saved Markdown: ${safeTitle}_${this.sessionId}.md`);

        } else {
            // Save as JSON (default)
            const jsonPath = path.join(outputDir, `${safeTitle}_${this.sessionId}.json`);
            const jsonContent = {
                title: title,
                generated: new Date().toISOString(),
                sessionId: this.sessionId,
                ...this.extractedData
            };

            fs.writeFileSync(jsonPath, JSON.stringify(jsonContent, null, 2), 'utf8');
            savedFiles.push({ format: 'json', path: jsonPath });
            console.log(`📋 Saved JSON: ${safeTitle}_${this.sessionId}.json`);
        }

        return savedFiles;
    }

    getStatus() {
        if (this.actionLog.length === 0) return 'no_actions';

        const lastAction = this.actionLog[this.actionLog.length - 1];
        if (lastAction.action_type === 'complete') return 'completed';
        if (lastAction.action_type === 'terminate') return 'terminated';
        if (lastAction.action_type === 'error') return 'error';
        if (this.currentStep >= this.options.maxSteps) return 'max_steps_reached';

        return 'unknown';
    }
}

// CLI Entry Point
async function main() {
    const args = process.argv.slice(2);

    if (args.length < 1 || args[0] === '--help' || args[0] === '-h') {
        console.log('Usage: node src/agent.js "<goal>" [options]');
        console.log('       node src/agent.js <url> "<goal>" [options]');
        console.log('');
        console.log('Options:');
        console.log('  --llm <provider>   LLM provider: gemini, cerebras (default: gemini)');
        console.log('  --headless         Run browser in headless mode');
        console.log('  --quiet            Reduce output verbosity');
        console.log('');
        console.log('Examples:');
        console.log('  # URL in prompt (new!)');
        console.log('  npm run agent "Go to amazon.sg and find best selling books"');
        console.log('  npm run agent "Search google.com for weather in Tokyo"');
        console.log('');
        console.log('  # URL separate (legacy)');
        console.log('  npm run agent https://www.google.com "Search for weather"');
        console.log('  npm run agent https://amazon.sg "Find best selling books" -- --llm cerebras');
        process.exit(1);
    }

    // Parse --llm flag
    let llmProvider = config.defaultProvider;
    const llmIndex = args.indexOf('--llm');
    if (llmIndex !== -1 && args[llmIndex + 1]) {
        llmProvider = args[llmIndex + 1];
    }

    // Get non-flag arguments
    const nonFlagArgs = args.filter((arg, i) => {
        if (arg.startsWith('--')) return false;
        if (i > 0 && args[i - 1] === '--llm') return false;
        return true;
    });

    let url = 'about:blank';
    let goal = '';

    // Check if first arg is an explicit URL (http:// or https://)
    const firstArg = nonFlagArgs[0];
    if (firstArg && (firstArg.startsWith('http://') || firstArg.startsWith('https://'))) {
        // Explicit URL provided
        url = firstArg;
        goal = nonFlagArgs.slice(1).join(' ');
    } else {
        // No explicit URL - let LLM handle navigation
        goal = nonFlagArgs.join(' ');
    }

    const agent = new Agent({
        headless: args.includes('--headless'),
        verbose: !args.includes('--quiet'),
        llmProvider: llmProvider
    });

    console.log(`🤖 Using LLM provider: ${llmProvider}`);

    try {
        await agent.run(url, goal);
    } catch (error) {
        console.error('Fatal error:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { Agent };
