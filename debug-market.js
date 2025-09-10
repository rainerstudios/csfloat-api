// Debug script to check market page elements
console.log("=== CS2 Float Extension Market Debug ===");

// Check if we're on a market page
const currentUrl = window.location.href;
console.log("Current URL:", currentUrl);
console.log("Is market page:", currentUrl.includes('/market/'));

// Check for market listing elements
const selectors = [
    '.market_listing_row',
    '.market_recent_listing_row', 
    '.market_listing_row_link',
    '#searchResultsRows .market_listing_row',
    '.market_listing_item_name_block'
];

selectors.forEach(selector => {
    const elements = document.querySelectorAll(selector);
    console.log(`Selector "${selector}":`, elements.length, "elements");
    if (elements.length > 0) {
        console.log("First element:", elements[0]);
        console.log("First element HTML preview:", elements[0].innerHTML.substring(0, 200) + "...");
    }
});

// Check for inspect links specifically
const steamLinks = document.querySelectorAll('a[href*="steam://rungame/730"]');
console.log("Steam inspect links found:", steamLinks.length);
steamLinks.forEach((link, index) => {
    console.log(`Steam link ${index + 1}:`, link.href);
});

// Check for any elements with steam:// in their content
const allElements = document.querySelectorAll('*');
let elementsWithSteamLinks = 0;
allElements.forEach(element => {
    if (element.innerHTML && element.innerHTML.includes('steam://rungame/730')) {
        elementsWithSteamLinks++;
        if (elementsWithSteamLinks <= 5) { // Only log first 5
            console.log(`Element ${elementsWithSteamLinks} with steam link:`, element.tagName, element.className);
            console.log("Content preview:", element.innerHTML.substring(0, 300) + "...");
        }
    }
});
console.log("Total elements containing steam links:", elementsWithSteamLinks);

console.log("=== Debug Complete ===");