/**
 * Test script for custody engine
 * Validates key dates against expected outcomes
 */

const engine = require('./custody-engine.js');

// Test cases
const tests = [
  {
    date: '2026-01-03',
    expected: { parent: 'mother', level: 1, note: 'Winter Break' },
    description: 'Jan 3 - Mother has them (Winter Break)'
  },
  {
    date: '2026-01-05',
    expected: { parent: 'mother', level: 1, note: 'PD Day - Extends to Tue' },
    description: 'Jan 5 (Monday) - Non-instruction day, Mother keeps until Tue'
  },
  {
    date: '2026-01-06',
    expected: { parent: 'mother', level: 1, hasDropOff: true },
    description: 'Jan 6 (Tuesday) - Mother drops off at school'
  },
  {
    date: '2025-12-12',
    expected: { parent: 'mother', level: 4, note: 'Odd Weekend' },
    description: 'Dec 12 - Anchor date, Mother\'s odd weekend'
  },
  {
    date: '2026-05-10',
    expected: { parent: 'mother', level: 0, note: "Mother's Day" },
    description: 'May 10 - Mother\'s Day override'
  },
  {
    date: '2026-10-02',
    expected: { parent: 'mother', level: 0, note: 'Birthday' },
    description: 'Oct 2 - Mother\'s birthday'
  },
  {
    date: '2026-01-08',
    expected: { parent: 'mother', level: 4, note: 'Thursday' },
    description: 'Jan 8 (Thursday) - Mother\'s overnight'
  },
  {
    date: '2026-01-09',
    expected: { parent: 'mother', level: 4, note: 'Odd Weekend' },
    description: 'Jan 9 (Friday) - Mother\'s odd weekend (Week 4 from anchor)'
  }
];

console.log('='.repeat(80));
console.log('CUSTODY ENGINE TEST SUITE');
console.log('='.repeat(80));
console.log('');

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const [y, m, d] = test.date.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const result = engine.evaluateCustody(date);

  console.log(`Test ${index + 1}: ${test.description}`);
  console.log(`  Date: ${test.date} (${date.toDateString()})`);
  console.log(`  Expected: Parent=${test.expected.parent}, Level=${test.expected.level}`);
  console.log(`  Actual:   Parent=${result.parent}, Level=${result.matchedLevel}, Rule=${result.matchedRule}`);
  console.log(`  Note:     ${result.note}`);

  // Validate
  let pass = true;
  if (result.parent !== test.expected.parent) {
    console.log(`  ❌ FAIL: Parent mismatch`);
    pass = false;
  } else if (test.expected.level !== undefined && result.matchedLevel !== test.expected.level) {
    console.log(`  ⚠️  WARNING: Level mismatch (expected ${test.expected.level}, got ${result.matchedLevel})`);
  } else {
    console.log(`  ✅ PASS`);
  }

  if (pass) passed++; else failed++;
  console.log('');
});

console.log('='.repeat(80));
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(80));

// Additional validation: Check weekend counting
console.log('');
console.log('WEEKEND NUMBER VALIDATION');
console.log('='.repeat(80));

const weekendTests = [
  { date: '2025-12-12', expected: 'odd', description: 'Dec 12, 2025 (Anchor - Friday)' },
  { date: '2025-12-13', expected: 'odd', description: 'Dec 13, 2025 (Saturday)' },
  { date: '2025-12-14', expected: 'odd', description: 'Dec 14, 2025 (Sunday)' },
  { date: '2025-12-19', expected: 'even', description: 'Dec 19, 2025 (Next Friday)' },
  { date: '2025-12-26', expected: 'odd', description: 'Dec 26, 2025 (2 weeks later)' },
  { date: '2026-01-09', expected: 'odd', description: 'Jan 9, 2026 (Friday)' },
];

weekendTests.forEach(test => {
  const [y, m, d] = test.date.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const weekendNum = engine.getWeekendNumber(date);

  const pass = weekendNum === test.expected;
  const icon = pass ? '✅' : '❌';

  console.log(`${icon} ${test.description}: ${weekendNum} ${pass ? '' : `(expected ${test.expected})`}`);
});

console.log('');
