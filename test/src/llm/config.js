/**
 * LLM Configuration
 * Load API keys from environment variables
 */
require('dotenv').config();

const config = {
    // Gemini configuration
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        model: 'gemini-2.5-flash',
        generationConfig: {
            temperature: 0.2,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2048,
        }
    },

    // Cerebras configuration
    cerebras: {
        apiKey: process.env.CEREBRAS_API_KEY,
        model: 'llama3.1-8b',  // 'llama3.1-8b', 'llama3.1-70b'
        maxTokens: 8192,
        temperature: 0.2,
        topP: 0.9,
        verbose: true  // Show streaming output
    },

    // Agent settings
    agent: {
        maxSteps: 50,             // Maximum actions before termination
        waitBetweenActions: 1000, // ms to wait between actions
        screenshotOnAction: true,
        verbose: true
    }
};

// Validate required config for a provider
function validateConfig(provider = 'gemini') {
    switch (provider.toLowerCase()) {
        case 'gemini':
            if (!config.gemini.apiKey) {
                console.error('❌ GEMINI_API_KEY not found in environment variables');
                console.error('   Create a .env file with: GEMINI_API_KEY=your_key_here');
                process.exit(1);
            }
            break;
        case 'cerebras':
            if (!config.cerebras.apiKey) {
                console.error('❌ CEREBRAS_API_KEY not found in environment variables');
                console.error('   Create a .env file with: CEREBRAS_API_KEY=your_key_here');
                process.exit(1);
            }
            break;
        default:
            console.error(`❌ Unknown LLM provider: ${provider}`);
            process.exit(1);
    }
}

module.exports = { config, validateConfig };
