/**
 * Action Types - Dynamic from Registry
 * Backward compatible with existing code
 */
const { registry } = require('./action-registry');

// Load plugins on module import
registry.loadPlugins();

// Generate ActionType object dynamically
const ActionType = {};
for (const type of registry.getTypes()) {
    const key = type.toUpperCase().replace(/-/g, '_');
    ActionType[key] = type;
}

// Add any legacy types not in plugins for backward compatibility
const LEGACY_TYPES = [
    'click', 'input_text', 'select_option', 'hover', 'upload_file',
    'click_coords', 'move_mouse', 'drag',
    'keypress', 'type_text',
    'scroll', 'goto_url', 'reload', 'go_back', 'go_forward',
    'wait', 'complete', 'terminate', 'extract'
];

for (const type of LEGACY_TYPES) {
    const key = type.toUpperCase();
    if (!ActionType[key]) {
        ActionType[key] = type;
    }
}

// Helper functions using registry
function requiresElement(actionType) {
    return registry.requiresElement(actionType);
}

function isCoordinateAction(actionType) {
    const ActionClass = registry.get(actionType);
    return ActionClass ? ActionClass.isCoordinate : false;
}

function isTerminal(actionType) {
    return registry.isTerminal(actionType);
}

// Export arrays for backward compatibility
const ELEMENT_ACTIONS = registry.getElementActions();
const TERMINAL_ACTIONS = registry.getTerminalActions();
const COORDINATE_ACTIONS = ['click_coords', 'move_mouse', 'drag'];
const KEYBOARD_ACTIONS = ['keypress', 'type_text'];

module.exports = {
    ActionType,
    ELEMENT_ACTIONS,
    COORDINATE_ACTIONS,
    KEYBOARD_ACTIONS,
    TERMINAL_ACTIONS,
    requiresElement,
    isCoordinateAction,
    isTerminal,
    registry
};
