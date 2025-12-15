/**
 * Visual Element Highlighter
 * Shows bounding boxes around elements during browser automation
 */

class ElementHighlighter {
    constructor(page) {
        this.page = page;
        this.overlayId = 'agent-highlight-overlay';
    }

    /**
     * Inject the highlight styles into the page
     */
    async injectStyles() {
        await this.page.addStyleTag({
            content: `
                .agent-highlight-box {
                    position: absolute;
                    border: 3px solid #00ff00;
                    background: rgba(0, 255, 0, 0.1);
                    pointer-events: none;
                    z-index: 999999;
                    transition: all 0.2s ease;
                    box-sizing: border-box;
                }
                .agent-highlight-label {
                    position: absolute;
                    top: -24px;
                    left: -3px;
                    background: #00ff00;
                    color: #000;
                    font-family: 'Consolas', 'Monaco', monospace;
                    font-size: 12px;
                    font-weight: bold;
                    padding: 2px 8px;
                    border-radius: 4px 4px 0 0;
                    white-space: nowrap;
                    z-index: 999999;
                }
                .agent-highlight-action {
                    border-color: #ff6600 !important;
                    background: rgba(255, 102, 0, 0.2) !important;
                }
                .agent-highlight-action .agent-highlight-label {
                    background: #ff6600 !important;
                    color: #fff !important;
                }
                @keyframes agent-pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.02); opacity: 0.8; }
                    100% { transform: scale(1); opacity: 1; }
                }
                .agent-highlight-pulse {
                    animation: agent-pulse 0.5s ease-in-out;
                }
            `
        });
    }

    /**
     * Highlight all interactive elements on the page
     * @param {Object} elementMap - Map of uuid -> element info
     */
    async highlightAll(elementMap) {
        await this.page.evaluate((elements) => {
            // Remove existing highlights
            document.querySelectorAll('.agent-highlight-box').forEach(el => el.remove());

            Object.entries(elements).forEach(([uuid, info]) => {
                const element = document.querySelector(`[data-uuid="${uuid}"]`);
                if (!element) return;

                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) return;

                const box = document.createElement('div');
                box.className = 'agent-highlight-box';
                box.id = `highlight-${uuid}`;
                box.style.left = `${rect.left + window.scrollX}px`;
                box.style.top = `${rect.top + window.scrollY}px`;
                box.style.width = `${rect.width}px`;
                box.style.height = `${rect.height}px`;

                const label = document.createElement('div');
                label.className = 'agent-highlight-label';
                const shortText = info.text ? info.text.substring(0, 20) : '';
                label.textContent = `${uuid} [${info.tag}]${shortText ? ': ' + shortText : ''}`;
                box.appendChild(label);

                document.body.appendChild(box);
            });
        }, elementMap);
    }

    /**
     * Highlight a specific element that's about to be actioned
     * @param {string} uuid - Element UUID
     * @param {string} action - Action being performed
     */
    async highlightAction(uuid, action) {
        await this.page.evaluate(({ uuid, action }) => {
            // Remove previous action highlights
            document.querySelectorAll('.agent-highlight-action').forEach(el => {
                el.classList.remove('agent-highlight-action', 'agent-highlight-pulse');
            });

            const element = document.querySelector(`[data-uuid="${uuid}"]`);
            if (!element) return;

            const rect = element.getBoundingClientRect();

            // Check if highlight box exists, create if not
            let box = document.getElementById(`highlight-${uuid}`);
            if (!box) {
                box = document.createElement('div');
                box.className = 'agent-highlight-box';
                box.id = `highlight-${uuid}`;

                const label = document.createElement('div');
                label.className = 'agent-highlight-label';
                box.appendChild(label);

                document.body.appendChild(box);
            }

            // Update position
            box.style.left = `${rect.left + window.scrollX}px`;
            box.style.top = `${rect.top + window.scrollY}px`;
            box.style.width = `${rect.width}px`;
            box.style.height = `${rect.height}px`;

            // Update label
            const label = box.querySelector('.agent-highlight-label');
            label.textContent = `▶ ${action.toUpperCase()}`;

            // Add action styling
            box.classList.add('agent-highlight-action', 'agent-highlight-pulse');

            // Scroll into view
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, { uuid, action });

        // Wait a moment for visual effect
        await this.page.waitForTimeout(300);
    }

    /**
     * Show a toast notification on the page
     * @param {string} message - Message to show
     * @param {string} type - 'info', 'success', 'error'
     */
    async showToast(message, type = 'info') {
        await this.page.evaluate(({ message, type }) => {
            // Remove existing toast
            const existing = document.getElementById('agent-toast');
            if (existing) existing.remove();

            const colors = {
                info: { bg: '#2196F3', text: '#fff' },
                success: { bg: '#4CAF50', text: '#fff' },
                error: { bg: '#f44336', text: '#fff' },
                action: { bg: '#ff6600', text: '#fff' }
            };
            const color = colors[type] || colors.info;

            const toast = document.createElement('div');
            toast.id = 'agent-toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${color.bg};
                color: ${color.text};
                padding: 12px 24px;
                border-radius: 8px;
                font-family: 'Consolas', 'Monaco', monospace;
                font-size: 14px;
                font-weight: bold;
                z-index: 9999999;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                animation: slideUp 0.3s ease;
            `;
            toast.textContent = message;

            // Add animation keyframes if not exists
            if (!document.getElementById('agent-toast-styles')) {
                const style = document.createElement('style');
                style.id = 'agent-toast-styles';
                style.textContent = `
                    @keyframes slideUp {
                        from { opacity: 0; transform: translateX(-50%) translateY(20px); }
                        to { opacity: 1; transform: translateX(-50%) translateY(0); }
                    }
                `;
                document.head.appendChild(style);
            }

            document.body.appendChild(toast);

            // Auto remove after 2s
            setTimeout(() => toast.remove(), 2000);
        }, { message, type });
    }

    /**
     * Clear all highlights
     */
    async clearAll() {
        await this.page.evaluate(() => {
            document.querySelectorAll('.agent-highlight-box').forEach(el => el.remove());
            const toast = document.getElementById('agent-toast');
            if (toast) toast.remove();
        });
    }
}

module.exports = { ElementHighlighter };
