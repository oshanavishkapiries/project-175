/**
 * Action Executor - Plugin-based Architecture
 * Delegates action execution to registered plugins
 */
const { registry } = require('./action-registry');

class ActionExecutor {
    constructor(page, elementMap = {}) {
        this.page = page;
        this.elementMap = elementMap;

        // Load plugins on first use
        if (registry.getTypes().length === 0) {
            registry.loadPlugins();
        }
    }

    /**
     * Set element map for action execution
     */
    setElementMap(elementMap) {
        this.elementMap = elementMap;
    }

    /**
     * Execute an action using the plugin system
     * @param {Object} action - Parsed action object
     * @returns {Promise<{success: boolean, error?: string, data?: any}>}
     */
    async execute(action) {
        const { action_type } = action;

        // Get the action plugin
        const ActionClass = registry.get(action_type);

        if (!ActionClass) {
            console.log(`  [error] Unknown action type: ${action_type}`);
            return {
                success: false,
                error: `Unknown action type: ${action_type}. Available: ${registry.getTypes().join(', ')}`
            };
        }

        try {
            // Create action instance and execute
            const handler = new ActionClass(this.page, this.elementMap);
            const result = await handler.execute(action);

            if (!result.success && result.error) {
                console.log(`  [error] ${result.error}`);
            }

            return result;
        } catch (error) {
            console.log(`  [error] ${error.message}`);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get all available action types
     */
    getActionTypes() {
        return registry.getTypes();
    }

    /**
     * Check if action requires element
     */
    requiresElement(actionType) {
        return registry.requiresElement(actionType);
    }

    /**
     * Check if action is terminal
     */
    isTerminal(actionType) {
        return registry.isTerminal(actionType);
    }
}

module.exports = { ActionExecutor };
