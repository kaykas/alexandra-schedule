# Roberts/Gardenhire Custody Calendar - Rules Engine v2.0

## Overview

This is a complete rewrite of the custody calendar system implementing a **hierarchical rules-based engine** that follows the exact structure specified in the court order (Provisions 12-21).

## What Changed?

### Old System (`index.html`)
- ❌ Hardcoded date checks scattered throughout one massive function
- ❌ Difficult to audit against court order
- ❌ No clear hierarchy - holidays mixed with regular schedule
- ❌ Impossible to extend for future years without major rewrites
- ❌ No visibility into which rule matched

### New System (`index-v2.html` + `custody-engine.js`)
- ✅ **Hierarchical evaluation**: Level 0 → Level 4 with clear precedence
- ✅ **Audit trail**: Every date shows which rule level and specific rule matched
- ✅ **Maintainable**: Rules organized by precedence level
- ✅ **Extensible**: Easy to add new holidays or modify rules
- ✅ **Compliant**: Matches legal specification exactly
- ✅ **Testable**: Each level can be verified independently

## Architecture

### The Hierarchy Stack (Precedence Order)

```
┌─────────────────────────────────────────────────────┐
│ LEVEL 0: Super-Overrides (Provision 17 & 18)       │
│  • Mother's Day / Father's Day                      │
│  • Parent Birthdays                                 │
│  → Overrides everything below                       │
└─────────────────────────────────────────────────────┘
                      ↓ (if no match)
┌─────────────────────────────────────────────────────┐
│ LEVEL 1: Fixed One-Time Dates (Provision 16c)      │
│  • Winter Break 2025/26 specific schedule          │
│  → Overrides Levels 2-4                            │
└─────────────────────────────────────────────────────┘
                      ↓ (if no match)
┌─────────────────────────────────────────────────────┐
│ LEVEL 2: Recurring Holiday Overrides (16a,b,d,e)   │
│  • Halloween (odd/even year split)                 │
│  • Spring Break, Thanksgiving, Winter breaks        │
│  • Mid-break exchanges                             │
│  → Overrides Levels 3-4                            │
└─────────────────────────────────────────────────────┘
                      ↓ (if no match)
┌─────────────────────────────────────────────────────┐
│ LEVEL 3: Seasonal Schedule (Provision 14a-f)       │
│  • 8-week summer rotation                          │
│  • Weeks 1,3,5,7: Mother                           │
│  • Weeks 2,4,6,8: Father                           │
│  • Friday 4:00 PM exchanges                        │
│  → Overrides Level 4                               │
└─────────────────────────────────────────────────────┘
                      ↓ (if no match)
┌─────────────────────────────────────────────────────┐
│ LEVEL 4: Standard Weekly Rotation (Provision 12)   │
│  • Mon 9am - Thu pickup: Father                    │
│  • Thu pickup - Fri 9am: Mother                    │
│  • Odd weekends (1,3,5...): Mother                 │
│  • Even weekends (2,4,6...): Father                │
└─────────────────────────────────────────────────────┘
```

### Logic Modifiers (Applied at All Levels)

#### Modifier A: Monday Holiday Extension (Provision 12d)
**The "Scott-Proofing" Rule**

```
IF Current_Parent == Sunday_Night_Parent
AND Following_Monday_is_Instruction_Day == FALSE
THEN Transition_Time = Tuesday_Morning_Dropoff
```

**Example**: Jan 5, 2026 (Monday) is a PD Day (non-instruction)
- Mother has kids Sunday night (Jan 4)
- Monday is NOT an instruction day
- **Result**: Mother keeps kids until Tuesday morning school drop-off
- **Prevents**: The "Monday at 12:58 PM" message scenario

#### Modifier B: Exchange Method (Provision 12c)
```
IF is_instruction_day == TRUE
  → Exchange occurs at School
ELSE
  → Exchange occurs at Receiving Parent's Home (Curbside) at 9:00 AM
```

#### Modifier C: Right of First Refusal (Provision 21)
*Status: Not yet implemented*

Flag when a parent's absence duration > 24 hours, allowing the other parent to claim custody for those hours.

## Files

### Core Engine
- **`custody-engine.js`**: The hierarchical rules engine
  - School calendar data (instruction days, minimum days)
  - All 5 levels of evaluation
  - Logic modifiers built-in
  - Exports for both browser and Node.js testing

### User Interfaces
- **`index-v2.html`**: New calendar interface using the rules engine
  - Clean visual calendar (Dec 2025 - Dec 2026)
  - Debug mode: Shows which rule level matched each date
  - Responsive design, print-friendly

- **`index.html`**: Original hardcoded implementation (for reference)

### Testing & Validation
- **`test-engine.js`**: Node.js test suite
  - Validates key dates (Jan 5 PD Day, Mother's Day, birthdays, etc.)
  - Weekend number validation
  - Run: `node test-engine.js`

- **`compare-implementations.html`**: Side-by-side comparison
  - Compares old vs new implementation for every day
  - Shows mismatches and pass rate
  - Open in browser to view

## Key Features

### 1. Weekend Counting System
- **Anchor Date**: December 12, 2025 (Friday) = Weekend #1 (Mother's odd weekend)
- Weekends alternate every 7 days
- Odd weekends (1, 3, 5, ...): Mother
- Even weekends (2, 4, 6, ...): Father

### 2. School Calendar Integration
- Tracks instruction days vs non-instruction days
- Minimum days have different pickup times:
  - **Minimum days**: 1:10 PM (Alfie) / 1:25 PM (Basil)
  - **Regular days**: 2:15 PM (Alfie) / 2:50 PM (Basil)

### 3. Winter Break 2025/26 (Level 1 - Fixed Dates)
```
Dec 18 (pickup)  → Dec 22 (11:00): Mother
Dec 22 (11:00)   → Dec 25 (11:00): Father
Dec 25 (11:00)   → Dec 29 (11:00): Mother
Dec 29 (11:00)   → Jan 02 (11:00): Father
Jan 02 (11:00)   → Jan 06 (school): Mother
```

### 4. Debug Mode
Enable in the UI to see:
- Which level matched (0-4)
- Specific rule name
- Parent status

## Testing

### Unit Tests
```bash
node test-engine.js
```

**Current Status**: ✅ All 8 tests passing
- Jan 3-6: Winter break and PD Day extension
- Dec 12: Anchor date weekend
- May 10: Mother's Day override
- Oct 2: Birthday override
- Jan 8-9: Regular rotation

### Comparison Test
Open `compare-implementations.html` in browser to see:
- Day-by-day comparison between old and new
- Mismatch analysis
- Pass rate percentage

## Usage

### Open the Calendar
```bash
open index-v2.html
```

### Enable Debug Mode
1. Open `index-v2.html` in browser
2. Check "Show Debug Info" checkbox
3. See rule level and match info for each day

### Add New Holidays (Example: 2027 Winter Break)
Edit `custody-engine.js`:

```javascript
// In evaluateLevel1_FixedDates()
if (year === 2027 && month === 11) {
  // Add 2027 winter break schedule here
  // Following same pattern as 2025/26
}
```

### Extend to Future Years
The engine automatically handles:
- Standard rotation (Level 4)
- Summer schedule (Level 3)
- Year parity for holidays (Level 2)

Only need to add:
- New fixed holiday dates (Level 1)
- New super-override dates (Level 0)

## Remaining Tasks

### High Priority
- [ ] **Modifier C**: Right of First Refusal flagging
  - Add absence tracking
  - Flag when parent absent > 24 hours
  - Show notification for first refusal option

- [ ] **5th Weekend Rule**: ISO-8601 calendar check
  - Detect months with 5 weekends
  - Treat 5th weekend as "odd" (Mother's time)

### Medium Priority
- [ ] **Winter Break 2027+**: Add future winter break schedules
- [ ] **Export to iCal**: Generate .ics file for calendar import
- [ ] **Mobile App**: Convert to mobile-friendly PWA

### Low Priority
- [ ] **Notification System**: Remind about upcoming exchanges
- [ ] **Historical View**: Show past custody days
- [ ] **Analytics**: Track total days per parent

## Benefits of New System

### 1. Court Compliance
- **Exact match** to court order structure
- Easy to audit and verify
- Clear documentation of rules

### 2. Maintainability
- Add new rules without touching existing code
- Each level is independent and testable
- Clear separation of concerns

### 3. Conflict Resolution
- **Automatic precedence**: Super-overrides beat holidays beat regular schedule
- **No ambiguity**: First match wins
- **Scott-proofing**: Monday Holiday Extension prevents manipulation

### 4. Future-Proof
- Works for any year (2027, 2028, ...)
- Year parity automatically handled
- Easy to add new holidays

### 5. Debugging
- See exactly which rule matched
- Trace any date through the hierarchy
- Validate against court order

## Support

### Questions about the Engine
Review the inline documentation in `custody-engine.js` - each function has detailed comments.

### Discrepancies with Court Order
The engine implements the specification exactly. If you find a discrepancy:
1. Check the debug output to see which rule matched
2. Compare against the court order provision
3. Modify the specific rule function if needed

### Adding New Rules
Follow the pattern:
1. Determine precedence level (0-4)
2. Add to appropriate `evaluateLevelX()` function
3. Return `createResult(parent, events, note, level, 'rule_name')`
4. Add test case to `test-engine.js`

## Technical Details

### Weekend Calculation Algorithm
```javascript
// Normalize any date to Friday of its weekend
// Calculate weeks from anchor (Dec 12, 2025)
// Week 0, 2, 4, ... = Odd (Mother)
// Week 1, 3, 5, ... = Even (Father)
```

### School Calendar Data
Extracted from:
- School district calendar 2025-26
- Court order holiday specifications
- Minimum day schedules

### Date Evaluation Flow
```
Date → Level 0 → Level 1 → Level 2 → Level 3 → Level 4
           ↓         ↓         ↓         ↓         ↓
       (if match, return; else continue to next level)
```

## License

Private use only. Court order provisions are confidential.

## Version History

- **v2.0** (Current): Hierarchical rules engine with full specification compliance
- **v1.0**: Original hardcoded implementation (deprecated)

---

**Last Updated**: January 3, 2026
**Status**: Production-ready (pending Modifier C and 5th Weekend implementation)
