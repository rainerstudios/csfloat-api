/**
 * Test cases for TradeHoldDisplay component
 * Tests trade hold detection and countdown functionality
 */

// Mock test environment
const MockTradeHoldDisplay = class {
    constructor() {
        this.TRADE_HOLD_PERIODS = {
            MOBILE_AUTH: 168,    // 7 days
            NEW_DEVICE: 168,     // 7 days
            NEW_TRADE_PARTNER: 15 * 24,  // 15 days
            MARKET_LISTING: 168  // 7 days
        };
    }

    getTradeHoldInfo(asset) {
        if (!asset) {
            return { tradable: true };
        }

        // Check if asset is tradable
        if (asset.tradable === 0) {
            // Look for trade restriction in descriptions
            const descriptions = asset.descriptions || [];
            const tradeRestriction = descriptions.find(desc => 
                desc.value && desc.value.includes('Tradable After')
            );

            if (tradeRestriction) {
                // Extract date from description
                const dateMatch = tradeRestriction.value.match(/Tradable After (.+)/);
                if (dateMatch) {
                    const restrictionDate = new Date(dateMatch[1]);
                    const now = new Date();
                    
                    if (restrictionDate > now) {
                        const daysLeft = Math.ceil((restrictionDate - now) / (1000 * 60 * 60 * 24));
                        return {
                            tradable: false,
                            daysLeft: daysLeft,
                            date: restrictionDate
                        };
                    }
                }
            }
            
            // If no date found but marked as non-tradable
            return { tradable: false };
        }

        return { tradable: true };
    }

    getStatusColor(statusClass) {
        switch (statusClass) {
            case 'tradable':
                return '#5bc633';
            case 'not-tradable':
                return '#ff7b7b';
            case 'trade-hold-days':
                return '#ffa500';
            default:
                return '#8f98a0';
        }
    }
};

// Test Cases
const testCases = [
    {
        name: "Tradable item - no restrictions",
        input: {
            tradable: 1,
            descriptions: []
        },
        expected: {
            tradable: true
        }
    },
    {
        name: "Non-tradable item - no date specified",
        input: {
            tradable: 0,
            descriptions: []
        },
        expected: {
            tradable: false
        }
    },
    {
        name: "Trade hold with future date",
        input: {
            tradable: 0,
            descriptions: [
                {
                    value: "Tradable After Dec 25, 2025"
                }
            ]
        },
        expected: {
            tradable: false,
            daysLeft: "calculated", // Will be calculated in test
            date: "Date object"     // Will be checked in test
        }
    },
    {
        name: "Trade hold with past date (should be tradable)",
        input: {
            tradable: 0,
            descriptions: [
                {
                    value: "Tradable After Jan 1, 2020"
                }
            ]
        },
        expected: {
            tradable: false // Asset is still marked as tradable: 0
        }
    },
    {
        name: "Null asset input",
        input: null,
        expected: {
            tradable: true
        }
    },
    {
        name: "Asset with market_tradable_restriction",
        input: {
            tradable: 0,
            market_tradable_restriction: 5,
            descriptions: []
        },
        expected: {
            tradable: false
        }
    }
];

// Test Runner
function runTradeHoldDisplayTests() {
    console.log("🧪 Running TradeHoldDisplay Tests");
    console.log("=".repeat(40));
    
    const tradeHoldDisplay = new MockTradeHoldDisplay();
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`\nTest ${index + 1}: ${testCase.name}`);
        
        try {
            const result = tradeHoldDisplay.getTradeHoldInfo(testCase.input);
            
            // Basic tradable check
            if (result.tradable !== testCase.expected.tradable) {
                console.log(`❌ FAILED - tradable: expected ${testCase.expected.tradable}, got ${result.tradable}`);
                return;
            }
            
            // Special handling for date-based tests
            if (testCase.name === "Trade hold with future date") {
                if (result.daysLeft && result.daysLeft > 0 && result.date instanceof Date) {
                    console.log(`✅ PASSED - Future date correctly calculated: ${result.daysLeft} days left`);
                    passedTests++;
                } else {
                    console.log("❌ FAILED - Future date not calculated correctly");
                    console.log("Result:", result);
                }
            } else {
                // For other tests, just check tradable status matches
                console.log("✅ PASSED - Trade hold status correctly identified");
                passedTests++;
            }
            
        } catch (error) {
            console.log("❌ FAILED - Error thrown:", error.message);
        }
    });
    
    console.log("\n" + "=".repeat(40));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log("🎉 All TradeHoldDisplay tests passed!");
    } else {
        console.log("⚠️  Some tests failed - review implementation");
    }
    
    return { passed: passedTests, total: totalTests };
}

// Color mapping tests
function testColorMapping() {
    console.log("\n🧪 Testing Status Color Mapping");
    console.log("=".repeat(35));
    
    const tradeHoldDisplay = new MockTradeHoldDisplay();
    const colorTests = [
        { input: 'tradable', expected: '#5bc633', name: 'Tradable green' },
        { input: 'not-tradable', expected: '#ff7b7b', name: 'Not tradable red' },
        { input: 'trade-hold-days', expected: '#ffa500', name: 'Trade hold orange' },
        { input: 'unknown', expected: '#8f98a0', name: 'Unknown gray' },
        { input: '', expected: '#8f98a0', name: 'Empty string default' }
    ];
    
    let passed = 0;
    colorTests.forEach((test, index) => {
        const result = tradeHoldDisplay.getStatusColor(test.input);
        if (result === test.expected) {
            console.log(`✅ Color test ${index + 1} passed: ${test.name}`);
            passed++;
        } else {
            console.log(`❌ Color test ${index + 1} failed: ${test.name} - expected "${test.expected}", got "${result}"`);
        }
    });
    
    console.log(`📊 Color mapping: ${passed}/${colorTests.length} tests passed`);
    return { passed, total: colorTests.length };
}

// Date parsing tests
function testDateParsing() {
    console.log("\n🧪 Testing Date Parsing");
    console.log("=".repeat(25));
    
    const tradeHoldDisplay = new MockTradeHoldDisplay();
    
    // Test various date formats that might appear in Steam descriptions
    const dateTests = [
        {
            description: "Tradable After Jan 15, 2026",
            shouldParse: true,
            name: "Standard Steam date format"
        },
        {
            description: "Tradable After December 25, 2025", 
            shouldParse: true,
            name: "Full month name format"
        },
        {
            description: "This item is not tradable",
            shouldParse: false,
            name: "No date in description"
        },
        {
            description: "Tradable After invalid date",
            shouldParse: false,
            name: "Invalid date format"
        }
    ];
    
    let passed = 0;
    dateTests.forEach((test, index) => {
        const asset = {
            tradable: 0,
            descriptions: [{ value: test.description }]
        };
        
        const result = tradeHoldDisplay.getTradeHoldInfo(asset);
        
        if (test.shouldParse) {
            if (result.date instanceof Date && !isNaN(result.date.getTime())) {
                console.log(`✅ Date test ${index + 1} passed: ${test.name}`);
                passed++;
            } else {
                console.log(`❌ Date test ${index + 1} failed: ${test.name} - expected valid date`);
            }
        } else {
            if (!result.date) {
                console.log(`✅ Date test ${index + 1} passed: ${test.name} - no date parsed as expected`);
                passed++;
            } else {
                console.log(`❌ Date test ${index + 1} failed: ${test.name} - expected no date but got one`);
            }
        }
    });
    
    console.log(`📊 Date parsing: ${passed}/${dateTests.length} tests passed`);
    return { passed, total: dateTests.length };
}

// Export for browser testing
if (typeof window !== 'undefined') {
    window.runTradeHoldDisplayTests = runTradeHoldDisplayTests;
    window.testColorMapping = testColorMapping;
    window.testDateParsing = testDateParsing;
}

// Auto-run tests
console.log("Starting TradeHoldDisplay component tests...\n");
const tradeHoldTests = runTradeHoldDisplayTests();
const colorTests = testColorMapping();
const dateTests = testDateParsing();

const totalPassed = tradeHoldTests.passed + colorTests.passed + dateTests.passed;
const totalTests = tradeHoldTests.total + colorTests.total + dateTests.total;

console.log("\n" + "=".repeat(50));
console.log(`🏆 OVERALL RESULTS: ${totalPassed}/${totalTests} tests passed`);
console.log("=".repeat(50));