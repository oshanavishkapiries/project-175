
const { BaseAction } = require('../base-action');

class MouseMoveAction extends BaseAction {
    static type = 'mouse_move';
    static requiresElement = false;
    static isCoordinate = true;
    static description = 'Move the mouse cursor to specific X,Y coordinates.';
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
            }
        },
        required: ['x', 'y']
    };

    async execute(action) {
        if (typeof action.x !== 'number' || typeof action.y !== 'number') {
            return { success: false, error: 'x and y coordinates are required and must be numbers' };
        }

        try {
            await this.page.mouse.move(action.x, action.y);
            return {
                success: true,
                message: `Mouse moved to (${action.x}, ${action.y})`
            };
        } catch (error) {
            return { success: false, error: `Mouse move failed: ${error.message}` };
        }
    }
}

module.exports = MouseMoveAction;
