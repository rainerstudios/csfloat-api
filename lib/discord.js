/**
 * Discord Webhook Integration
 * Send alerts and notifications to Discord channels
 */

const fetch = require('node-fetch');

/**
 * Send a Discord webhook message
 * @param {string} webhookUrl - Discord webhook URL
 * @param {object} options - Message options
 */
async function sendWebhook(webhookUrl, options) {
    const {
        title,
        description,
        color = 0x5865F2, // Discord blurple
        fields = [],
        footer,
        thumbnail,
        image,
        timestamp = true
    } = options;

    const embed = {
        title,
        description,
        color,
        fields,
        timestamp: timestamp ? new Date().toISOString() : undefined
    };

    if (footer) {
        embed.footer = typeof footer === 'string' ? { text: footer } : footer;
    }

    if (thumbnail) {
        embed.thumbnail = { url: thumbnail };
    }

    if (image) {
        embed.image = { url: image };
    }

    const payload = {
        embeds: [embed]
    };

    try {
        const response = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`Discord webhook failed: ${response.status} ${response.statusText}`);
        }

        return { success: true };
    } catch (error) {
        console.error('Discord webhook error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Send price alert notification
 */
async function sendPriceAlert(webhookUrl, itemName, currentPrice, targetPrice, condition) {
    const emoji = condition === 'above' ? '\uD83D\uDCC8' : '\uD83D\uDCC9';
    const verb = condition === 'above' ? 'above' : 'below';

    return await sendWebhook(webhookUrl, {
        title: `${emoji} Price Alert: ${itemName}`,
        description: `Your price alert has been triggered!`,
        color: condition === 'above' ? 0x57F287 : 0xED4245, // Green for above, red for below
        fields: [
            {
                name: 'Current Price',
                value: `$${currentPrice.toFixed(2)}`,
                inline: true
            },
            {
                name: 'Target Price',
                value: `$${targetPrice.toFixed(2)}`,
                inline: true
            },
            {
                name: 'Condition',
                value: `Price is ${verb} target`,
                inline: true
            }
        ],
        footer: 'CSFloat Investment Tracker'
    });
}

/**
 * Send portfolio milestone notification
 */
async function sendPortfolioMilestone(webhookUrl, milestone, portfolioValue, profit) {
    const milestones = {
        'first_profit': { emoji: '\uD83C\uDF89', title: 'First Profit!', color: 0x57F287 },
        '10k_value': { emoji: '\uD83D\uDCB0', title: 'Portfolio Worth $10,000!', color: 0xFEE75C },
        '50k_value': { emoji: '\uD83D\uDC8E', title: 'Portfolio Worth $50,000!', color: 0x5865F2 },
        '100k_value': { emoji: '\uD83C\uDFC6', title: 'Portfolio Worth $100,000!', color: 0xEB459E },
        'positive_roi': { emoji: '\uD83D\uDCCA', title: 'Positive ROI Achieved!', color: 0x57F287 }
    };

    const config = milestones[milestone] || { emoji: '\u2728', title: 'Milestone Reached!', color: 0x5865F2 };

    return await sendWebhook(webhookUrl, {
        title: `${config.emoji} ${config.title}`,
        description: `Congratulations! You've reached a new milestone.`,
        color: config.color,
        fields: [
            {
                name: 'Portfolio Value',
                value: `$${portfolioValue.toFixed(2)}`,
                inline: true
            },
            {
                name: 'Total Profit',
                value: `$${profit.toFixed(2)}`,
                inline: true
            }
        ],
        footer: 'CSFloat Investment Tracker'
    });
}

/**
 * Send snapshot created notification
 */
async function sendSnapshotCreated(webhookUrl, snapshotData) {
    const roiColor = snapshotData.total_roi >= 0 ? 0x57F287 : 0xED4245;
    const roiEmoji = snapshotData.total_roi >= 0 ? '\uD83D\uDCC8' : '\uD83D\uDCC9';

    return await sendWebhook(webhookUrl, {
        title: `\uD83D\uDCF8 Daily Snapshot Created`,
        description: `Your portfolio snapshot has been saved.`,
        color: roiColor,
        fields: [
            {
                name: 'Total Value',
                value: `$${parseFloat(snapshotData.total_value).toFixed(2)}`,
                inline: true
            },
            {
                name: 'Total Invested',
                value: `$${parseFloat(snapshotData.total_invested).toFixed(2)}`,
                inline: true
            },
            {
                name: `${roiEmoji} ROI`,
                value: `${parseFloat(snapshotData.total_roi).toFixed(2)}%`,
                inline: true
            },
            {
                name: 'Realized Profit',
                value: `$${parseFloat(snapshotData.realized_profit).toFixed(2)}`,
                inline: true
            },
            {
                name: 'Unrealized Profit',
                value: `$${parseFloat(snapshotData.unrealized_profit).toFixed(2)}`,
                inline: true
            },
            {
                name: 'Items',
                value: `${snapshotData.item_count}`,
                inline: true
            }
        ],
        footer: 'CSFloat Investment Tracker'
    });
}

/**
 * Send price change notification
 */
async function sendPriceChange(webhookUrl, itemName, oldPrice, newPrice, changePercent) {
    const isIncrease = newPrice > oldPrice;
    const emoji = isIncrease ? '\uD83D\uDCC8' : '\uD83D\uDCC9';
    const color = isIncrease ? 0x57F287 : 0xED4245;

    return await sendWebhook(webhookUrl, {
        title: `${emoji} Price Change: ${itemName}`,
        description: `Significant price movement detected`,
        color,
        fields: [
            {
                name: 'Previous Price',
                value: `$${oldPrice.toFixed(2)}`,
                inline: true
            },
            {
                name: 'Current Price',
                value: `$${newPrice.toFixed(2)}`,
                inline: true
            },
            {
                name: 'Change',
                value: `${changePercent > 0 ? '+' : ''}${changePercent.toFixed(2)}%`,
                inline: true
            }
        ],
        footer: 'CSFloat Investment Tracker'
    });
}

/**
 * Send investment added notification
 */
async function sendInvestmentAdded(webhookUrl, investment) {
    return await sendWebhook(webhookUrl, {
        title: '\u2795 New Investment Added',
        description: `${investment.item_name}`,
        color: 0x5865F2,
        fields: [
            {
                name: 'Purchase Price',
                value: `$${parseFloat(investment.purchase_price).toFixed(2)}`,
                inline: true
            },
            {
                name: 'Quantity',
                value: `${investment.quantity}`,
                inline: true
            },
            {
                name: 'Marketplace',
                value: investment.marketplace || 'N/A',
                inline: true
            }
        ],
        thumbnail: investment.image_url,
        footer: 'CSFloat Investment Tracker'
    });
}

/**
 * Send sale completed notification
 */
async function sendSaleCompleted(webhookUrl, sale) {
    const profitColor = parseFloat(sale.profit_loss) >= 0 ? 0x57F287 : 0xED4245;
    const profitEmoji = parseFloat(sale.profit_loss) >= 0 ? '\uD83D\uDCB0' : '\uD83D\uDCC9';

    return await sendWebhook(webhookUrl, {
        title: `${profitEmoji} Sale Completed`,
        description: `${sale.item_name}`,
        color: profitColor,
        fields: [
            {
                name: 'Sale Price',
                value: `$${parseFloat(sale.total_sale_value).toFixed(2)}`,
                inline: true
            },
            {
                name: 'Quantity Sold',
                value: `${sale.quantity_sold}`,
                inline: true
            },
            {
                name: 'Profit/Loss',
                value: `$${parseFloat(sale.profit_loss).toFixed(2)}`,
                inline: true
            },
            {
                name: 'ROI',
                value: `${parseFloat(sale.roi_percent).toFixed(2)}%`,
                inline: true
            }
        ],
        footer: 'CSFloat Investment Tracker'
    });
}

/**
 * Test webhook
 */
async function testWebhook(webhookUrl) {
    return await sendWebhook(webhookUrl, {
        title: '\u2705 Webhook Test',
        description: 'Your Discord webhook is configured correctly!',
        color: 0x57F287,
        fields: [
            {
                name: 'Status',
                value: 'Connected',
                inline: true
            },
            {
                name: 'Service',
                value: 'CSFloat Investment Tracker',
                inline: true
            }
        ],
        footer: 'CSFloat Investment Tracker'
    });
}

module.exports = {
    sendWebhook,
    sendPriceAlert,
    sendPortfolioMilestone,
    sendSnapshotCreated,
    sendPriceChange,
    sendInvestmentAdded,
    sendSaleCompleted,
    testWebhook
};
