/**
 * Actions Module Index
 * Export all action utilities
 */
const {
    ActionType,
    ELEMENT_ACTIONS,
    COORDINATE_ACTIONS,
    KEYBOARD_ACTIONS,
    TERMINAL_ACTIONS,
    requiresElement,
    isCoordinateAction,
    isTerminal
} = require('./action-types');
const { parseAction, parseActions } = require('./action-parser');
const { ActionExecutor } = require('./action-executor');

module.exports = {
    ActionType,
    ELEMENT_ACTIONS,
    COORDINATE_ACTIONS,
    KEYBOARD_ACTIONS,
    TERMINAL_ACTIONS,
    requiresElement,
    isCoordinateAction,
    isTerminal,
    parseAction,
    parseActions,
    ActionExecutor
};
