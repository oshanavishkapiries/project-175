/**
 * LLM Configuration
 * All settings loaded from .env file
 */
require('dotenv').config();

const config = {
    // Default provider
    defaultProvider: process.env.DEFAULT_LLM || 'gemini',

    // Gemini
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
        temperature: parseFloat(process.env.GEMINI_TEMPERATURE) || 0.2,
        maxTokens: parseInt(process.env.GEMINI_MAX_TOKENS) || 2048
    },

    // Cerebras  
    cerebras: {
        apiKey: process.env.CEREBRAS_API_KEY,
        model: process.env.CEREBRAS_MODEL || 'llama3.1-8b',
        temperature: parseFloat(process.env.CEREBRAS_TEMPERATURE) || 0.2,
        maxTokens: parseInt(process.env.CEREBRAS_MAX_TOKENS) || 8192,
        verbose: false
    },

    // Ollama (local)
    ollama: {
        baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.2',
        temperature: parseFloat(process.env.OLLAMA_TEMPERATURE) || 0.2,
        maxTokens: parseInt(process.env.OLLAMA_MAX_TOKENS) || 4096,
        verbose: false
    },

    // OpenRouter
    openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
        temperature: parseFloat(process.env.OPENROUTER_TEMPERATURE) || 0.2,
        maxTokens: parseInt(process.env.OPENROUTER_MAX_TOKENS) || 4096,
        siteUrl: process.env.OPENROUTER_SITE_URL || 'http://localhost:3000',
        siteName: process.env.OPENROUTER_SITE_NAME || 'Browser Agent',
        verbose: false
    },

    // Agent settings
    agent: {
        maxSteps: parseInt(process.env.AGENT_MAX_STEPS) || 50,
        waitBetweenActions: parseInt(process.env.AGENT_WAIT_BETWEEN_ACTIONS) || 1000,
        verbose: process.env.AGENT_VERBOSE !== 'false'
    },

    // Browser settings
    browser: {
        chromePath: process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
        headless: process.env.HEADLESS === 'true',
        userDataDir: process.env.BROWSER_PROFILE_DIR || null  // null = use default in data/browser-profile
    },

    // Rate limiter settings
    rateLimit: {
        enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
        requestsPerMinute: parseInt(process.env.RATE_LIMIT_RPM) || 60,
        requestsPerDay: parseInt(process.env.RATE_LIMIT_RPD) || 1500,
        minDelayMs: parseInt(process.env.RATE_LIMIT_MIN_DELAY) || 100,
        maxRetries: parseInt(process.env.RATE_LIMIT_MAX_RETRIES) || 3,
        retryDelayMs: parseInt(process.env.RATE_LIMIT_RETRY_DELAY) || 1000,
        retryMultiplier: parseFloat(process.env.RATE_LIMIT_RETRY_MULTIPLIER) || 2
    }
};

function validateConfig(provider = 'gemini') {
    switch (provider.toLowerCase()) {
        case 'gemini':
            if (!config.gemini.apiKey) {
                console.error('[error] GEMINI_API_KEY not set in .env');
                process.exit(1);
            }
            break;
        case 'cerebras':
            if (!config.cerebras.apiKey) {
                console.error('[error] CEREBRAS_API_KEY not set in .env');
                process.exit(1);
            }
            break;
        case 'ollama':
            // No API key needed
            break;
        case 'openrouter':
            if (!config.openrouter.apiKey) {
                console.error('[error] OPENROUTER_API_KEY not set in .env');
                process.exit(1);
            }
            break;
        default:
            console.error(`[error] Unknown provider: ${provider}`);
            process.exit(1);
    }
}

module.exports = { config, validateConfig };
