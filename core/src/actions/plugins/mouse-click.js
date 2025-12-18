
const { BaseAction } = require('../base-action');

class MouseClickAction extends BaseAction {
    static type = 'mouse_click';
    static requiresElement = false;
    static isCoordinate = true;
    static description = 'Click the mouse at specific X,Y coordinates.';
    static inputSchema = {
        type: 'object',
        properties: {
            x: {
                type: 'number',
                description: 'X coordinate'
            },
            y: {
                type: 'number',
                description: 'Y coordinate'
            },
            button: {
                type: 'string',
                description: 'Mouse button (left, right, middle)',
                default: 'left'
            },
            clickCount: {
                type: 'number',
                description: 'Number of clicks (1 for single, 2 for double)',
                default: 1
            }
        },
        required: ['x', 'y']
    };

    async execute(action) {
        if (typeof action.x !== 'number' || typeof action.y !== 'number') {
            return { success: false, error: 'x and y coordinates are required and must be numbers' };
        }

        try {
            const button = action.button || 'left';
            const clickCount = action.clickCount || 1;

            await this.page.mouse.click(action.x, action.y, {
                button: button,
                clickCount: clickCount
            });

            return {
                success: true,
                message: `Clicked ${button} button at (${action.x}, ${action.y})` + (clickCount > 1 ? ` ${clickCount} times` : '')
            };
        } catch (error) {
            return { success: false, error: `Mouse click failed: ${error.message}` };
        }
    }
}

module.exports = MouseClickAction;
