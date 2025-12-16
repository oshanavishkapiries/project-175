/**
 * Extract Action Plugin
 */
const { BaseAction } = require('../base-action');

class ExtractAction extends BaseAction {
    static type = 'extract';
    static requiresElement = false;
    static description = 'Extract data from the current page';

    async execute({ data }) {
        return {
            success: true,
            data: data || null
        };
    }
}

module.exports = ExtractAction;
