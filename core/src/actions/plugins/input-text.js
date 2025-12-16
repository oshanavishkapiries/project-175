/**
 * Input Text Action Plugin
 */
const { BaseAction } = require('../base-action');

class InputTextAction extends BaseAction {
    static type = 'input_text';
    static requiresElement = true;
    static description = 'Type text into an input field';

    async execute({ element_id, text }) {
        try {
            const element = await this.getElement(element_id);

            // Clear existing content first
            await element.fill('');

            // Type the new text
            await element.fill(text || '');

            // Check if this is a search input - might need Enter key
            const elementInfo = this.elementMap[element_id];
            if (this.isSearchInput(elementInfo)) {
                this.log('keypress Enter');
                await this.page.keyboard.press('Enter');
                await this.page.waitForTimeout(500);
            }

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    isSearchInput(elementInfo) {
        if (!elementInfo) return false;

        const searchIndicators = [
            elementInfo.type === 'search',
            elementInfo.name?.toLowerCase()?.includes('search'),
            elementInfo.name?.toLowerCase()?.includes('query'),
            elementInfo.name === 'q',
            elementInfo['aria-label']?.toLowerCase()?.includes('search'),
            elementInfo.placeholder?.toLowerCase()?.includes('search'),
            elementInfo.role === 'searchbox'
        ];

        return searchIndicators.some(Boolean);
    }
}

module.exports = InputTextAction;
