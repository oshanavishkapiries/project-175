/**
 * Action Types
 * All supported browser automation actions
 */

const ActionType = {
    // Web Interactions (element-based)
    CLICK: 'click',
    INPUT_TEXT: 'input_text',
    SELECT_OPTION: 'select_option',
    HOVER: 'hover',
    UPLOAD_FILE: 'upload_file',

    // Coordinate-based mouse actions (fallback)
    CLICK_COORDS: 'click_coords',
    MOVE_MOUSE: 'move_mouse',
    DRAG: 'drag',

    // Keyboard simulation
    KEYPRESS: 'keypress',
    TYPE_TEXT: 'type_text',  // Types text character by character (simulates real typing)

    // Navigation
    SCROLL: 'scroll',
    GOTO_URL: 'goto_url',
    RELOAD: 'reload',
    GO_BACK: 'go_back',
    GO_FORWARD: 'go_forward',

    // Control
    WAIT: 'wait',

    // Termination
    COMPLETE: 'complete',
    TERMINATE: 'terminate',

    // Data
    EXTRACT: 'extract'
};

// Actions that require an element ID
const ELEMENT_ACTIONS = [
    ActionType.CLICK,
    ActionType.INPUT_TEXT,
    ActionType.SELECT_OPTION,
    ActionType.HOVER,
    ActionType.UPLOAD_FILE
];

// Coordinate-based actions (no element ID required)
const COORDINATE_ACTIONS = [
    ActionType.CLICK_COORDS,
    ActionType.MOVE_MOUSE,
    ActionType.DRAG
];

// Keyboard actions
const KEYBOARD_ACTIONS = [
    ActionType.KEYPRESS,
    ActionType.TYPE_TEXT
];

// Actions that end the agent loop
const TERMINAL_ACTIONS = [
    ActionType.COMPLETE,
    ActionType.TERMINATE
];

/**
 * Check if action type requires an element ID
 */
function requiresElement(actionType) {
    return ELEMENT_ACTIONS.includes(actionType);
}

/**
 * Check if action is coordinate-based
 */
function isCoordinateAction(actionType) {
    return COORDINATE_ACTIONS.includes(actionType);
}

/**
 * Check if action type ends execution
 */
function isTerminal(actionType) {
    return TERMINAL_ACTIONS.includes(actionType);
}

module.exports = {
    ActionType,
    ELEMENT_ACTIONS,
    COORDINATE_ACTIONS,
    KEYBOARD_ACTIONS,
    TERMINAL_ACTIONS,
    requiresElement,
    isCoordinateAction,
    isTerminal
};
