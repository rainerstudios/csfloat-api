/**
 * Test cases for PatternDatabase component
 * Tests pattern recognition for blue gems, doppler phases, fade percentages
 */

// Mock test environment
const MockPatternDatabase = class {
    constructor() {
        this.initializePatternData();
    }

    initializePatternData() {
        // Simplified pattern data for testing
        this.blueGemPatterns = {
            'AK-47': {
                661: { tier: 1, name: '#1 Blue Gem', bluePercentage: 95, description: 'Legendary pattern' },
                670: { tier: 1, name: '#2 Blue Gem', bluePercentage: 94, description: 'Extremely rare' },
                809: { tier: 2, name: 'Top Blue Gem', bluePercentage: 90, description: 'High tier blue' }
            }
        };

        this.dopplerPhases = {
            415: { phase: 'Ruby', rarity: 'Extremely Rare', color: '#8B0000', multiplier: 3.5 },
            416: { phase: 'Sapphire', rarity: 'Extremely Rare', color: '#0000FF', multiplier: 3.2 },
            418: { phase: 'Phase 1', rarity: 'Rare', color: '#4A0080', multiplier: 1.2 }
        };

        this.fadePatterns = {
            high: { min: 1, max: 50, percentage: '95-100%', description: 'Full Fade', multiplier: 2.0 },
            medium: { min: 51, max: 150, percentage: '85-95%', description: 'High Fade', multiplier: 1.5 }
        };
    }

    analyzePattern(itemInfo) {
        if (!itemInfo || !itemInfo.weapon_type || !itemInfo.paintseed) {
            return null;
        }

        const weaponName = this.extractWeaponName(itemInfo.weapon_type);
        const paintSeed = parseInt(itemInfo.paintseed);
        const paintIndex = parseInt(itemInfo.paintindex);

        // Check for Case Hardened patterns (paintindex 44)
        if (paintIndex === 44) {
            return this.analyzeCaseHardened(weaponName, paintSeed);
        }

        // Check for Doppler patterns (paintindex 415-421)  
        if (paintIndex >= 415 && paintIndex <= 421) {
            return this.analyzeDoppler(paintIndex, paintSeed);
        }

        // Check for Fade patterns (paintindex 38)
        if (paintIndex === 38) {
            return this.analyzeFade(paintSeed);
        }

        return null;
    }

    analyzeCaseHardened(weaponName, paintSeed) {
        const weaponPatterns = this.blueGemPatterns[weaponName];
        if (!weaponPatterns || !weaponPatterns[paintSeed]) {
            return {
                type: 'Case Hardened',
                isSpecial: false,
                message: 'Standard Case Hardened pattern'
            };
        }

        const pattern = weaponPatterns[paintSeed];
        return {
            type: 'Case Hardened Blue Gem',
            isSpecial: true,
            tier: pattern.tier,
            name: pattern.name,
            bluePercentage: pattern.bluePercentage,
            description: pattern.description,
            message: `🔷 ${pattern.name} - ${pattern.bluePercentage}% Blue`
        };
    }

    analyzeDoppler(paintIndex, paintSeed) {
        const doppler = this.dopplerPhases[paintIndex];
        if (!doppler) {
            return null;
        }

        return {
            type: 'Doppler',
            isSpecial: paintIndex <= 417,
            phase: doppler.phase,
            rarity: doppler.rarity,
            color: doppler.color,
            multiplier: doppler.multiplier,
            message: `💎 ${doppler.phase} - ${doppler.rarity}`
        };
    }

    analyzeFade(paintSeed) {
        let fadeInfo = null;
        for (const [category, data] of Object.entries(this.fadePatterns)) {
            if (paintSeed >= data.min && paintSeed <= data.max) {
                fadeInfo = data;
                break;
            }
        }

        if (!fadeInfo) {
            return {
                type: 'Fade',
                isSpecial: false,
                message: 'Unknown fade percentage'
            };
        }

        return {
            type: 'Fade',
            isSpecial: fadeInfo.multiplier > 1.5,
            percentage: fadeInfo.percentage,
            description: fadeInfo.description,
            multiplier: fadeInfo.multiplier,
            message: `🌈 ${fadeInfo.description} (${fadeInfo.percentage})`
        };
    }

    extractWeaponName(weaponType) {
        return weaponType.split(' |')[0].trim();
    }
};

// Test Cases
const testCases = [
    {
        name: "AK-47 Case Hardened Blue Gem #1",
        input: {
            weapon_type: "AK-47 | Case Hardened (Field-Tested)",
            paintseed: "661",
            paintindex: "44"
        },
        expected: {
            type: 'Case Hardened Blue Gem',
            isSpecial: true,
            tier: 1,
            name: '#1 Blue Gem',
            bluePercentage: 95
        }
    },
    {
        name: "AK-47 Case Hardened regular pattern",
        input: {
            weapon_type: "AK-47 | Case Hardened (Field-Tested)",
            paintseed: "123", // Not a blue gem pattern
            paintindex: "44"
        },
        expected: {
            type: 'Case Hardened',
            isSpecial: false
        }
    },
    {
        name: "Karambit Doppler Ruby",
        input: {
            weapon_type: "★ Karambit | Doppler (Factory New)",
            paintseed: "123",
            paintindex: "415"
        },
        expected: {
            type: 'Doppler',
            isSpecial: true,
            phase: 'Ruby',
            rarity: 'Extremely Rare'
        }
    },
    {
        name: "Karambit Doppler Phase 1",
        input: {
            weapon_type: "★ Karambit | Doppler (Factory New)",
            paintseed: "456",
            paintindex: "418"
        },
        expected: {
            type: 'Doppler',
            isSpecial: false,
            phase: 'Phase 1',
            rarity: 'Rare'
        }
    },
    {
        name: "Karambit Fade Full Fade",
        input: {
            weapon_type: "★ Karambit | Fade (Factory New)",
            paintseed: "25", // High fade
            paintindex: "38"
        },
        expected: {
            type: 'Fade',
            isSpecial: true,
            description: 'Full Fade',
            percentage: '95-100%'
        }
    },
    {
        name: "Invalid item data",
        input: {
            weapon_type: null,
            paintseed: "123",
            paintindex: "44"
        },
        expected: null
    },
    {
        name: "Non-special skin",
        input: {
            weapon_type: "AK-47 | Redline (Field-Tested)",
            paintseed: "123",
            paintindex: "282" // Redline paintindex
        },
        expected: null
    }
];

// Test Runner
function runPatternDatabaseTests() {
    console.log("🧪 Running PatternDatabase Tests");
    console.log("=".repeat(40));
    
    const patternDB = new MockPatternDatabase();
    let passedTests = 0;
    let totalTests = testCases.length;
    
    testCases.forEach((testCase, index) => {
        console.log(`\nTest ${index + 1}: ${testCase.name}`);
        
        try {
            const result = patternDB.analyzePattern(testCase.input);
            
            if (testCase.expected === null) {
                if (result === null) {
                    console.log("✅ PASSED - Correctly returned null for invalid/non-special item");
                    passedTests++;
                } else {
                    console.log("❌ FAILED - Expected null but got:", result);
                }
            } else {
                // Check expected properties
                let testPassed = true;
                
                if (result.type !== testCase.expected.type) {
                    console.log(`❌ FAILED - type: expected "${testCase.expected.type}", got "${result.type}"`);
                    testPassed = false;
                }
                
                if (result.isSpecial !== testCase.expected.isSpecial) {
                    console.log(`❌ FAILED - isSpecial: expected ${testCase.expected.isSpecial}, got ${result.isSpecial}`);
                    testPassed = false;
                }
                
                // Check optional properties
                if (testCase.expected.tier && result.tier !== testCase.expected.tier) {
                    console.log(`❌ FAILED - tier: expected ${testCase.expected.tier}, got ${result.tier}`);
                    testPassed = false;
                }
                
                if (testCase.expected.name && result.name !== testCase.expected.name) {
                    console.log(`❌ FAILED - name: expected "${testCase.expected.name}", got "${result.name}"`);
                    testPassed = false;
                }
                
                if (testCase.expected.bluePercentage && result.bluePercentage !== testCase.expected.bluePercentage) {
                    console.log(`❌ FAILED - bluePercentage: expected ${testCase.expected.bluePercentage}, got ${result.bluePercentage}`);
                    testPassed = false;
                }
                
                if (testCase.expected.phase && result.phase !== testCase.expected.phase) {
                    console.log(`❌ FAILED - phase: expected "${testCase.expected.phase}", got "${result.phase}"`);
                    testPassed = false;
                }
                
                if (testPassed) {
                    console.log("✅ PASSED - Pattern correctly identified");
                    console.log(`   Type: ${result.type}, Special: ${result.isSpecial}`);
                    if (result.message) console.log(`   Message: ${result.message}`);
                    passedTests++;
                }
            }
        } catch (error) {
            console.log("❌ FAILED - Error thrown:", error.message);
        }
    });
    
    console.log("\n" + "=".repeat(40));
    console.log(`📊 Test Results: ${passedTests}/${totalTests} tests passed`);
    
    if (passedTests === totalTests) {
        console.log("🎉 All PatternDatabase tests passed!");
    } else {
        console.log("⚠️  Some tests failed - review implementation");
    }
    
    return { passed: passedTests, total: totalTests };
}

// Weapon name extraction tests
function testWeaponNameExtraction() {
    console.log("\n🧪 Testing Weapon Name Extraction");
    console.log("=".repeat(35));
    
    const patternDB = new MockPatternDatabase();
    const extractionTests = [
        { input: "AK-47 | Case Hardened (Field-Tested)", expected: "AK-47" },
        { input: "★ Karambit | Doppler (Factory New)", expected: "★ Karambit" },
        { input: "AWP | Dragon Lore (Factory New)", expected: "AWP" },
        { input: "Five-SeveN | Case Hardened (Minimal Wear)", expected: "Five-SeveN" },
        { input: "Glock-18 | Fade (Factory New)", expected: "Glock-18" }
    ];
    
    let passed = 0;
    extractionTests.forEach((test, index) => {
        const result = patternDB.extractWeaponName(test.input);
        if (result === test.expected) {
            console.log(`✅ Extraction test ${index + 1} passed: "${test.input}" → "${result}"`);
            passed++;
        } else {
            console.log(`❌ Extraction test ${index + 1} failed: expected "${test.expected}", got "${result}"`);
        }
    });
    
    console.log(`📊 Weapon name extraction: ${passed}/${extractionTests.length} tests passed`);
    return { passed, total: extractionTests.length };
}

// Export for browser testing
if (typeof window !== 'undefined') {
    window.runPatternDatabaseTests = runPatternDatabaseTests;
    window.testWeaponNameExtraction = testWeaponNameExtraction;
}

// Auto-run tests
console.log("Starting PatternDatabase component tests...\n");
const patternTests = runPatternDatabaseTests();
const extractionTests = testWeaponNameExtraction();

const totalPassed = patternTests.passed + extractionTests.passed;
const totalTests = patternTests.total + extractionTests.total;

console.log("\n" + "=".repeat(50));
console.log(`🏆 OVERALL RESULTS: ${totalPassed}/${totalTests} tests passed`);
console.log("=".repeat(50));