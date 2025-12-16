/**
 * BaseAction - Abstract base class for all action plugins
 * All action plugins must extend this class
 */

class BaseAction {
    // Static metadata - override in subclasses
    static type = 'unknown';
    static requiresElement = false;
    static isCoordinate = false;
    static isTerminal = false;
    static description = 'Base action';

    constructor(page, elementMap = {}) {
        this.page = page;
        this.elementMap = elementMap;
    }

    /**
     * Execute the action - must be implemented by subclasses
     * @param {Object} params - Action parameters
     * @returns {Promise<{success: boolean, error?: string, data?: any}>}
     */
    async execute(params) {
        throw new Error(`execute() not implemented for ${this.constructor.type}`);
    }

    /**
     * Get element by UUID from element map
     * @param {string} elementId
     * @returns {Promise<ElementHandle>}
     */
    async getElement(elementId) {
        if (!elementId) {
            throw new Error('Element ID is required');
        }

        const elementInfo = this.elementMap[elementId];
        if (!elementInfo) {
            throw new Error(`Element ${elementId} not found in map`);
        }

        let element = null;

        // Primary method: XPath (since data-uuid only exists in simplified HTML, not on actual page)
        if (elementInfo.xpath) {
            try {
                // Use evaluate for XPath
                element = await this.page.locator(`xpath=${elementInfo.xpath}`).first().elementHandle();
            } catch (e) {
                // XPath might be invalid or element not found
            }
        }

        // Fallback: Try by common attributes
        if (!element && elementInfo.name) {
            element = await this.page.$(`[name="${elementInfo.name}"]`);
        }
        if (!element && elementInfo['aria-label']) {
            element = await this.page.$(`[aria-label="${elementInfo['aria-label']}"]`);
        }
        if (!element && elementInfo.type && elementInfo.tag === 'input') {
            element = await this.page.$(`input[type="${elementInfo.type}"]`);
        }

        if (!element) {
            throw new Error(`Could not locate element: ${elementId}`);
        }

        return element;
    }

    /**
     * Get element center coordinates
     * @param {string} elementId
     * @returns {Promise<{x: number, y: number}>}
     */
    async getElementCenter(elementId) {
        const element = await this.getElement(elementId);
        const box = await element.boundingBox();

        if (!box) {
            throw new Error(`Element ${elementId} has no bounding box`);
        }

        return {
            x: box.x + box.width / 2,
            y: box.y + box.height / 2
        };
    }

    /**
     * Log action (can be overridden)
     * @param {string} message
     */
    log(message) {
        console.log(`  [${this.constructor.type}] ${message}`);
    }
}

module.exports = { BaseAction };
