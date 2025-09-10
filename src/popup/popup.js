/**
 * Popup script for CS2 Float Checker extension
 * Handles permission requests for Steam offer tracking
 * @version 1.0.0
 * @author CS2 Float Checker Team
 */

window.addEventListener('DOMContentLoaded', async () => {
    const requestButton = document.getElementById('requestPermissions');
    if (!requestButton) {
        return;
    }

    try {
        const hasPermissions = await chrome.permissions.contains({
            origins: ['*://*.steampowered.com/*'],
        });

        if (hasPermissions) {
            // If permissions are already granted, disable the button
            const buttonText = requestButton.children[1];
            if (buttonText) {
                buttonText.textContent = 'Offer Tracking Enabled';
            }
            requestButton.setAttribute('disabled', 'true');
        } else {
            requestButton.addEventListener('click', async () => {
                try {
                    const success = await chrome.permissions.request({
                        origins: ['*://*.steampowered.com/*'],
                    });
                    if (success) {
                        // Extension requires reload to apply permissions
                        chrome.runtime.reload();
                    }
                } catch (error) {
                    console.error('Error requesting permissions:', error);
                }
            });
        }
    } catch (error) {
        console.error('Error checking permissions:', error);
    }
});