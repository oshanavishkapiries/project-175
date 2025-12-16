/**
 * Hover Action Plugin
 */
const { BaseAction } = require('../base-action');

class HoverAction extends BaseAction {
    static type = 'hover';
    static requiresElement = true;
    static description = 'Hover over an element';

    async execute({ element_id }) {
        try {
            const element = await this.getElement(element_id);
            await element.hover();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = HoverAction;
