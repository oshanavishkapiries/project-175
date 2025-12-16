/**
 * Terminate Action Plugin (Terminal)
 */
const { BaseAction } = require('../base-action');

class TerminateAction extends BaseAction {
    static type = 'terminate';
    static requiresElement = false;
    static isTerminal = true;
    static description = 'Terminate the agent - task cannot be completed';

    async execute({ reason }) {
        return {
            success: true,
            data: { terminated: true, reason: reason || 'Task terminated' }
        };
    }
}

module.exports = TerminateAction;
