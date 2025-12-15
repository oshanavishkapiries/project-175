/**
 * Browser Automation Agent
 * Autonomous agent that uses LLM to navigate and interact with web pages
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const { createAdapter, config } = require('./llm');
const { parseAction, isTerminal, ActionExecutor } = require('./actions');
const { simplifyHTML } = require('./simplify-html');

class Agent {
    constructor(options = {}) {
        this.options = {
            headless: options.headless ?? false,
            maxSteps: options.maxSteps ?? config.agent.maxSteps,
            waitBetweenActions: options.waitBetweenActions ?? config.agent.waitBetweenActions,
            verbose: options.verbose ?? config.agent.verbose,
            llmProvider: options.llmProvider ?? 'gemini',
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
    }

    generateSessionId() {
        const now = new Date();
        return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    }

    async initialize() {
        console.log('🚀 Initializing browser automation agent...\n');

        // Initialize LLM adapter
        this.llm = createAdapter(this.options.llmProvider);
        console.log(`🤖 LLM: ${this.llm.getModelInfo().model}`);

        // Launch browser using local Chrome TODO: this for local chrome
        const chromePath = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
        this.browser = await chromium.launch({
            executablePath: chromePath,
            headless: this.options.headless
        });

        const context = await this.browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        });

        this.page = await context.newPage();
        this.executor = new ActionExecutor(this.page);

        console.log('🌐 Browser launched\n');
    }

    async close() {
        if (this.browser) {
            await this.browser.close();
            console.log('\n🔒 Browser closed');
        }
    }

    /**
     * Get simplified HTML and element map from current page
     */
    async getPageState() {
        // Get current HTML
        const html = await this.page.content();

        // Save to temp file for simplification
        const tempDir = path.join(__dirname, '..', 'data', 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const tempFile = path.join(tempDir, `page_${this.sessionId}_${Date.now()}.html`);
        fs.writeFileSync(tempFile, html, 'utf8');

        // Simplify HTML
        const result = simplifyHTML(tempFile);

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
     * Run the autonomous agent loop
     * @param {string} url - Starting URL
     * @param {string} goal - User's goal
     * @returns {Object} - Execution result
     */
    async run(url, goal) {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('🎯 AUTONOMOUS BROWSER AGENT');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`📍 URL: ${url}`);
        console.log(`🎯 Goal: ${goal}`);
        console.log(`🆔 Session: ${this.sessionId}`);
        console.log('───────────────────────────────────────────────────────────\n');

        try {
            await this.initialize();

            // Navigate to starting URL
            console.log(`🌐 Navigating to ${url}...`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
            await this.page.waitForTimeout(2000); // Wait for page to stabilize

            // Autonomous loop
            while (this.currentStep < this.options.maxSteps) {
                this.currentStep++;
                console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
                console.log(`📍 Step ${this.currentStep}/${this.options.maxSteps}`);
                console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

                // Get current page state
                console.log('📸 Analyzing page...');
                const pageState = await this.getPageState();

                this.executor.setElementMap(pageState.elementMap);
                console.log(`📊 Found ${Object.keys(pageState.elementMap).length} interactive elements`);

                // Get action from LLM
                console.log('🤔 Thinking...');
                const context = {
                    goal,
                    simplifiedHtml: pageState.simplifiedHtml,
                    elementMap: pageState.elementMap,
                    previousActions: this.actionLog.slice(-5), // Last 5 actions for context
                    currentUrl: pageState.url
                };

                const rawAction = await this.llm.generateAction(context);
                const action = parseAction(rawAction, pageState.elementMap);

                console.log(`\n💡 Action: ${action.action_type.toUpperCase()}`);
                console.log(`📝 Reasoning: ${action.reasoning}`);

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
                    console.log(`\n✅ Terminal action reached: ${action.action_type}`);

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
                console.log(`\n⚠️ Max steps (${this.options.maxSteps}) reached`);
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

        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('📊 RESULTS');
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`✅ Status: ${results.status}`);
        console.log(`📝 Total Steps: ${results.totalSteps}`);
        console.log(`📄 Log saved: ${path.relative(projectRoot, logPath)}`);

        if (results.outputFiles.length > 0) {
            console.log('\n📦 OUTPUT FILES:');
            results.outputFiles.forEach(file => {
                console.log(`   ${file.format === 'json' ? '📋' : '📝'} ${path.relative(projectRoot, file.path)}`);
            });
        }

        if (this.extractedData?.summary) {
            console.log(`\n📌 Summary: ${this.extractedData.summary}`);
        }

        console.log('═══════════════════════════════════════════════════════════\n');

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

    if (args.length < 2 || args[0] === '--help' || args[0] === '-h') {
        console.log('Usage: node src/agent.js <url> "<goal>" [options]');
        console.log('');
        console.log('Options:');
        console.log('  --llm <provider>   LLM provider: gemini, cerebras (default: gemini)');
        console.log('  --headless         Run browser in headless mode');
        console.log('  --quiet            Reduce output verbosity');
        console.log('');
        console.log('Examples:');
        console.log('  node src/agent.js https://www.google.com "Search for weather in Tokyo"');
        console.log('  node src/agent.js https://www.google.com "Search for weather" --llm cerebras');
        process.exit(1);
    }

    // Parse --llm flag
    let llmProvider = 'gemini';
    const llmIndex = args.indexOf('--llm');
    if (llmIndex !== -1 && args[llmIndex + 1]) {
        llmProvider = args[llmIndex + 1];
    }

    // Get URL and goal (filter out flags)
    const nonFlagArgs = args.filter((arg, i) => {
        if (arg.startsWith('--')) return false;
        if (i > 0 && args[i - 1] === '--llm') return false;
        return true;
    });

    const url = nonFlagArgs[0];
    const goal = nonFlagArgs.slice(1).join(' ');

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
