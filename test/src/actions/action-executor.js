/**
 * Action Executor
 * Execute parsed actions using Playwright
 * Supports element-based, coordinate-based, and keyboard actions
 */
const { ActionType } = require('./action-types');

class ActionExecutor {
    constructor(page, elementMap = {}) {
        this.page = page;
        this.elementMap = elementMap;
    }

    /**
     * Update element map (after page navigation/refresh)
     */
    setElementMap(elementMap) {
        this.elementMap = elementMap;
    }

    /**
     * Get element locator from UUID
     */
    async getElement(elementId) {
        const elementInfo = this.elementMap[elementId];
        if (!elementInfo) {
            throw new Error(`Element not found: ${elementId}`);
        }

        // Try to find by data-uuid first
        let element = this.page.locator(`[data-uuid="${elementId}"]`);
        if (await element.count() > 0) {
            return element.first();
        }

        // Fallback to XPath
        if (elementInfo.xpath) {
            element = this.page.locator(`xpath=${elementInfo.xpath}`);
            if (await element.count() > 0) {
                return element.first();
            }
        }

        throw new Error(`Could not locate element: ${elementId}`);
    }

    /**
     * Get center coordinates of an element
     */
    async getElementCenter(elementId) {
        const element = await this.getElement(elementId);
        const box = await element.boundingBox();
        if (!box) {
            throw new Error(`Element ${elementId} has no bounding box`);
        }
        return {
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2)
        };
    }

    /**
     * Execute a single action
     * @param {Object} action - Parsed action object
     * @returns {Object} - Execution result
     */
    async execute(action) {
        const result = {
            action_type: action.action_type,
            element_id: action.element_id,
            success: false,
            timestamp: new Date().toISOString(),
            error: null
        };

        try {
            switch (action.action_type) {
                // Element-based actions
                case ActionType.CLICK:
                    await this.executeClick(action);
                    break;

                case ActionType.INPUT_TEXT:
                    await this.executeInputText(action);
                    break;

                case ActionType.SELECT_OPTION:
                    await this.executeSelectOption(action);
                    break;

                case ActionType.HOVER:
                    await this.executeHover(action);
                    break;

                case ActionType.UPLOAD_FILE:
                    await this.executeUploadFile(action);
                    break;

                // Coordinate-based actions
                case ActionType.CLICK_COORDS:
                    await this.executeClickCoords(action);
                    break;

                case ActionType.MOVE_MOUSE:
                    await this.executeMoveMouse(action);
                    break;

                case ActionType.DRAG:
                    await this.executeDrag(action);
                    break;

                // Keyboard actions
                case ActionType.KEYPRESS:
                    await this.executeKeypress(action);
                    break;

                case ActionType.TYPE_TEXT:
                    await this.executeTypeText(action);
                    break;

                // Navigation actions
                case ActionType.SCROLL:
                    await this.executeScroll(action);
                    break;

                case ActionType.GOTO_URL:
                    await this.executeGotoUrl(action);
                    break;

                case ActionType.RELOAD:
                    await this.page.reload({ waitUntil: 'domcontentloaded' });
                    console.log('🔄 Page reloaded');
                    break;

                case ActionType.GO_BACK:
                    await this.page.goBack({ waitUntil: 'domcontentloaded' });
                    console.log('⬅️ Navigated back');
                    break;

                case ActionType.GO_FORWARD:
                    await this.page.goForward({ waitUntil: 'domcontentloaded' });
                    console.log('➡️ Navigated forward');
                    break;

                // Control actions
                case ActionType.WAIT:
                    await this.executeWait(action);
                    break;

                // Terminal actions
                case ActionType.EXTRACT:
                    result.extracted_data = action.extracted_data;
                    console.log('📤 Extraction completed');
                    break;

                case ActionType.COMPLETE:
                    result.extracted_data = action.extracted_data;
                    console.log('✅ Task completed');
                    break;

                case ActionType.TERMINATE:
                    result.errors = action.errors;
                    console.log('⛔ Task terminated');
                    break;

                default:
                    throw new Error(`Unknown action type: ${action.action_type}`);
            }

            result.success = true;
        } catch (error) {
            result.success = false;
            result.error = error.message;
            console.error(`❌ Action failed: ${error.message}`);
        }

        return result;
    }

    // ========================================
    // Element-based action executors
    // ========================================

    async executeClick(action) {
        const element = await this.getElement(action.element_id);
        await element.click({ button: action.button || 'left' });
        console.log(`🖱️ Clicked: ${action.element_id}`);
    }

    async executeInputText(action) {
        const element = await this.getElement(action.element_id);
        await element.fill(''); // Clear first
        await element.fill(action.text);
        console.log(`⌨️ Input: "${action.text}" into ${action.element_id}`);
    }

    async executeSelectOption(action) {
        const element = await this.getElement(action.element_id);
        const option = action.option;

        if (option.value) {
            await element.selectOption({ value: option.value });
        } else if (option.label) {
            await element.selectOption({ label: option.label });
        } else if (option.index !== undefined) {
            await element.selectOption({ index: option.index });
        }
        console.log(`📋 Selected: ${JSON.stringify(option)} in ${action.element_id}`);
    }

    async executeHover(action) {
        const element = await this.getElement(action.element_id);
        await element.hover();
        if (action.hold_seconds > 0) {
            await this.page.waitForTimeout(action.hold_seconds * 1000);
        }
        console.log(`👆 Hovered: ${action.element_id}`);
    }

    async executeUploadFile(action) {
        const element = await this.getElement(action.element_id);
        await element.setInputFiles(action.file_path);
        console.log(`📁 Uploaded: ${action.file_path}`);
    }

    // ========================================
    // Coordinate-based action executors
    // ========================================

    async executeClickCoords(action) {
        const x = action.x;
        const y = action.y;
        const button = action.button || 'left';
        const clickCount = action.click_count || 1;

        await this.page.mouse.click(x, y, { button, clickCount });
        console.log(`🖱️ Clicked at coordinates: (${x}, ${y})`);
    }

    async executeMoveMouse(action) {
        const x = action.x;
        const y = action.y;
        const steps = action.steps || 10;

        await this.page.mouse.move(x, y, { steps });
        console.log(`🖱️ Moved mouse to: (${x}, ${y})`);
    }

    async executeDrag(action) {
        const startX = action.start_x;
        const startY = action.start_y;
        const endX = action.end_x;
        const endY = action.end_y;

        await this.page.mouse.move(startX, startY);
        await this.page.mouse.down();
        await this.page.mouse.move(endX, endY, { steps: 20 });
        await this.page.mouse.up();
        console.log(`🖱️ Dragged from (${startX},${startY}) to (${endX},${endY})`);
    }

    // ========================================
    // Keyboard action executors
    // ========================================

    async executeKeypress(action) {
        const keys = action.keys || ['Enter'];

        // Handle key combinations (e.g., ["Control", "a"])
        if (action.combo) {
            // Press all keys together
            for (const key of keys) {
                await this.page.keyboard.down(key);
            }
            for (const key of keys.reverse()) {
                await this.page.keyboard.up(key);
            }
            console.log(`⌨️ Key combo: ${keys.join('+')}`);
        } else {
            // Press keys sequentially
            for (const key of keys) {
                await this.page.keyboard.press(key);
            }
            console.log(`⌨️ Pressed: ${keys.join(', ')}`);
        }
    }

    async executeTypeText(action) {
        const text = action.text || '';
        const delay = action.delay || 50; // ms between keystrokes

        await this.page.keyboard.type(text, { delay });
        console.log(`⌨️ Typed: "${text}"`);
    }

    // ========================================
    // Navigation action executors
    // ========================================

    async executeScroll(action) {
        const direction = action.direction || 'down';
        const amount = action.amount || 300;

        // If coordinates provided, scroll at that position
        if (action.x !== undefined && action.y !== undefined) {
            await this.page.mouse.move(action.x, action.y);
        }

        let deltaX = 0, deltaY = 0;
        switch (direction) {
            case 'up': deltaY = -amount; break;
            case 'down': deltaY = amount; break;
            case 'left': deltaX = -amount; break;
            case 'right': deltaX = amount; break;
        }

        await this.page.mouse.wheel(deltaX, deltaY);
        console.log(`📜 Scrolled: ${direction} by ${amount}px`);
    }

    async executeGotoUrl(action) {
        await this.page.goto(action.url, { waitUntil: 'domcontentloaded' });
        console.log(`🌐 Navigated to: ${action.url}`);
    }

    // ========================================
    // Control action executors
    // ========================================

    async executeWait(action) {
        const seconds = action.seconds || 2;
        await this.page.waitForTimeout(seconds * 1000);
        console.log(`⏳ Waited: ${seconds}s`);
    }
}

module.exports = { ActionExecutor };
