/**
 * OpenRouter LLM Adapter
 * Implementation of BaseLLMAdapter for OpenRouter API
 * OpenRouter provides access to multiple LLM providers through a unified API
 */
const { BaseLLMAdapter } = require('./base-adapter');

class OpenRouterAdapter extends BaseLLMAdapter {
    constructor(config) {
        super(config);
        this.name = 'openrouter';
        this.apiKey = config.apiKey;
        this.model = config.model || 'openai/gpt-4o-mini';
        this.baseUrl = 'https://openrouter.ai/api/v1';
        this.siteUrl = config.siteUrl || 'http://localhost:3000';
        this.siteName = config.siteName || 'Browser Agent';
    }

    /**
     * Generate next action using OpenRouter
     * @param {Object} context - Current context
     * @returns {Promise<Object>} - Action object
     */
    async generateAction(context) {
        const prompt = this.buildPrompt(context);

        const apiCall = async () => {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey}`,
                    'HTTP-Referer': this.siteUrl,
                    'X-Title': this.siteName
                },
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a browser automation agent. Always respond with valid JSON only.'
                        },
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: this.config.maxTokens || 4096,
                    temperature: this.config.temperature || 0.2,
                    top_p: this.config.topP || 0.9
                })
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(`OpenRouter API error: ${response.status} - ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const responseText = data.choices?.[0]?.message?.content || '';

            if (this.config.verbose) {
                console.log('\n📤 OpenRouter Response:', responseText.substring(0, 500) + '...');
            }

            return this.parseResponse(responseText);
        };

        try {
            // Use rate limiter if available
            if (this.rateLimiter) {
                return await this.rateLimiter.execute(apiCall, 'OpenRouter API');
            } else {
                return await apiCall();
            }
        } catch (error) {
            console.error('❌ OpenRouter API error:', error.message);

            // Return a safe fallback action
            return {
                action_type: 'terminate',
                reasoning: `LLM API error: ${error.message}`,
                errors: [error.message]
            };
        }
    }

    /**
     * Get model info for logging
     */
    getModelInfo() {
        return {
            provider: 'OpenRouter',
            model: this.model,
            adapter: this.name
        };
    }
}

module.exports = { OpenRouterAdapter };
