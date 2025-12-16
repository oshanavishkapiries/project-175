/**
 * ActionRegistry - Dynamic action plugin loader and registry
 * Open/Closed: Add new actions without modifying this code
 */
const fs = require('fs');
const path = require('path');

class ActionRegistry {
    constructor() {
        this.actions = new Map();
        this.pluginsDir = path.join(__dirname, 'plugins');
    }

    /**
     * Register a single action class
     * @param {Class} ActionClass - Action class extending BaseAction
     */
    register(ActionClass) {
        if (!ActionClass.type || ActionClass.type === 'unknown') {
            throw new Error('Action class must have a static "type" property');
        }
        this.actions.set(ActionClass.type, ActionClass);
    }

    /**
     * Auto-load all plugins from the plugins directory
     */
    loadPlugins() {
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
            return;
        }

        const files = fs.readdirSync(this.pluginsDir)
            .filter(file => file.endsWith('.js'));

        for (const file of files) {
            try {
                const ActionClass = require(path.join(this.pluginsDir, file));
                // Handle both default exports and named exports
                const ActualClass = ActionClass.default || ActionClass;

                if (ActualClass.type && ActualClass.type !== 'unknown') {
                    this.register(ActualClass);
                }
            } catch (error) {
                console.error(`[registry] Failed to load plugin ${file}: ${error.message}`);
            }
        }
    }

    /**
     * Get action class by type
     * @param {string} actionType
     * @returns {Class|null}
     */
    get(actionType) {
        return this.actions.get(actionType) || null;
    }

    /**
     * Check if action type exists
     * @param {string} actionType
     * @returns {boolean}
     */
    has(actionType) {
        return this.actions.has(actionType);
    }

    /**
     * Get all registered action types
     * @returns {string[]}
     */
    getTypes() {
        return Array.from(this.actions.keys());
    }

    /**
     * Get all registered actions with metadata
     * @returns {Object[]}
     */
    getAll() {
        return Array.from(this.actions.entries()).map(([type, ActionClass]) => ({
            type,
            requiresElement: ActionClass.requiresElement || false,
            isCoordinate: ActionClass.isCoordinate || false,
            isTerminal: ActionClass.isTerminal || false,
            description: ActionClass.description || ''
        }));
    }

    /**
     * Get actions that require an element
     * @returns {string[]}
     */
    getElementActions() {
        return this.getAll()
            .filter(a => a.requiresElement)
            .map(a => a.type);
    }

    /**
     * Get terminal actions
     * @returns {string[]}
     */
    getTerminalActions() {
        return this.getAll()
            .filter(a => a.isTerminal)
            .map(a => a.type);
    }

    /**
     * Check if action type requires element
     * @param {string} actionType
     * @returns {boolean}
     */
    requiresElement(actionType) {
        const ActionClass = this.get(actionType);
        return ActionClass ? ActionClass.requiresElement : false;
    }

    /**
     * Check if action type is terminal
     * @param {string} actionType
     * @returns {boolean}
     */
    isTerminal(actionType) {
        const ActionClass = this.get(actionType);
        return ActionClass ? ActionClass.isTerminal : false;
    }

    /**
     * Generate action documentation for LLM prompt
     * @returns {string}
     */
    generatePromptDocs() {
        const actions = this.getAll();
        let docs = 'Available Actions:\n';

        for (const action of actions) {
            docs += `- ${action.type}: ${action.description}`;
            if (action.requiresElement) docs += ' (requires element_id)';
            if (action.isTerminal) docs += ' [TERMINAL]';
            docs += '\n';
        }

        return docs;
    }
}

// Singleton instance
const registry = new ActionRegistry();

module.exports = { ActionRegistry, registry };
