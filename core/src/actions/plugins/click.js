/**
 * Click Action Plugin
 */
const { BaseAction } = require('../base-action');

class ClickAction extends BaseAction {
    static type = 'click';
    static requiresElement = true;
    static description = 'Click on an element';

    async execute({ element_id }) {
        try {
            const element = await this.getElement(element_id);
            await element.click();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}

module.exports = ClickAction;
