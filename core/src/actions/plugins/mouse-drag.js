
const { BaseAction } = require('../base-action');

class MouseDragAction extends BaseAction {
    static type = 'mouse_drag';
    static requiresElement = false;
    static isCoordinate = true;
    static description = 'Drag the mouse from a start point to an end point.';
    static inputSchema = {
        type: 'object',
        properties: {
            startX: {
                type: 'number',
                description: 'Starting X coordinate'
            },
            startY: {
                type: 'number',
                description: 'Starting Y coordinate'
            },
            endX: {
                type: 'number',
                description: 'Ending X coordinate'
            },
            endY: {
                type: 'number',
                description: 'Ending Y coordinate'
            }
        },
        required: ['startX', 'startY', 'endX', 'endY']
    };

    async execute(action) {
        const { startX, startY, endX, endY } = action;

        if ([startX, startY, endX, endY].some(v => typeof v !== 'number')) {
            return { success: false, error: 'All coordinates must be numbers' };
        }

        try {
            // Move to start
            await this.page.mouse.move(startX, startY);
            // Press down
            await this.page.mouse.down();
            // Move to end (drag)
            // Using steps to make it more human-like and ensure events trigger
            await this.page.mouse.move(endX, endY, { steps: 10 });
            // Release
            await this.page.mouse.up();

            return {
                success: true,
                message: `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`
            };
        } catch (error) {
            return { success: false, error: `Mouse drag failed: ${error.message}` };
        }
    }
}

module.exports = MouseDragAction;
