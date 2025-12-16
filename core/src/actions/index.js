/**
 * Actions Module Index
 * Plugin-based action system
 */
const { BaseAction } = require('./base-action');
const { ActionRegistry, registry } = require('./action-registry');
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
    // Core classes
    BaseAction,
    ActionRegistry,
    registry,
    ActionExecutor,

    // Types and helpers
    ActionType,
    ELEMENT_ACTIONS,
    COORDINATE_ACTIONS,
    KEYBOARD_ACTIONS,
    TERMINAL_ACTIONS,
    requiresElement,
    isCoordinateAction,
    isTerminal,

    // Parsing
    parseAction,
    parseActions
};
