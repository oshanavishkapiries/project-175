/**
 * LLM Module Index
 * Export all LLM adapters and utilities
 */
const { config, validateConfig } = require('./config');
const { BaseLLMAdapter } = require('./base-adapter');
const { GeminiAdapter } = require('./gemini-adapter');
const { CerebrasAdapter } = require('./cerebras-adapter');

/**
 * Create an LLM adapter based on provider name
 * @param {string} provider - Provider name ('gemini', 'cerebras', etc.)
 * @returns {BaseLLMAdapter} - LLM adapter instance
 */
function createAdapter(provider = 'gemini') {
    validateConfig(provider);

    switch (provider.toLowerCase()) {
        case 'gemini':
            return new GeminiAdapter(config.gemini);
        case 'cerebras':
            return new CerebrasAdapter(config.cerebras);
        default:
            throw new Error(`Unknown LLM provider: ${provider}`);
    }
}

module.exports = {
    config,
    validateConfig,
    BaseLLMAdapter,
    GeminiAdapter,
    CerebrasAdapter,
    createAdapter
};
