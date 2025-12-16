/**
 * Complete Action Plugin (Terminal)
 */
const { BaseAction } = require('../base-action');

class CompleteAction extends BaseAction {
    static type = 'complete';
    static requiresElement = false;
    static isTerminal = true;
    static description = 'Mark task as complete with extracted data';

    async execute({ extracted_data }) {
        return {
            success: true,
            data: extracted_data || null
        };
    }
}

module.exports = CompleteAction;
