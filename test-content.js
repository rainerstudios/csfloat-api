// Minimal test content script
console.log('=== TEST CONTENT SCRIPT LOADING ===');

// Add a visible element to confirm script is working
setTimeout(() => {
    const testDiv = document.createElement('div');
    testDiv.id = 'cs2-float-test';
    testDiv.innerHTML = 'CS2 FLOAT EXTENSION IS WORKING!';
    testDiv.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: red;
        color: white;
        padding: 10px;
        z-index: 99999;
        border: 2px solid white;
        font-weight: bold;
        font-size: 14px;
    `;
    document.body.appendChild(testDiv);
    console.log('Test div added to page');
}, 1000);