/**
 * Roberts/Gardenhire Custody Engine
 * Implements a hierarchical rules-based system for custody determination
 * Based on court order provisions 12-21
 */

// ============================================================================
// 1. CORE DATA DEPENDENCIES
// ============================================================================

/**
 * School Calendar: Boolean map of instruction days
 * Extracted from court order and school district calendar
 */
const SCHOOL_CALENDAR = {
  // School Year 2025-26 dates
  SCHOOL_START_2025: new Date(2025, 7, 11), // Aug 11, 2025
  SCHOOL_END_2026: new Date(2026, 4, 28),   // May 28, 2026
  SCHOOL_START_2026: new Date(2026, 7, 10), // Aug 10, 2026

  // Summer 2026 dates
  SUMMER_START_2026: new Date(2026, 4, 29), // May 29, 2026
  SUMMER_END_2026: new Date(2026, 6, 24),   // Jul 24, 2026

  // Non-instruction days (no school)
  NO_INSTRUCTION_DAYS: new Set([
    // Winter Break 2025
    '2025-12-22', '2025-12-23', '2025-12-24', '2025-12-25', '2025-12-26',
    '2025-12-29', '2025-12-30', '2025-12-31',
    // Winter Break continues 2026
    '2026-01-01', '2026-01-02', '2026-01-05', // Jan 5 = PD Day
    // MLK Day
    '2026-01-19',
    // Presidents Day
    '2026-02-16',
    // Spring Break
    '2026-04-03', '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10',
    // Memorial Day
    '2026-05-25', '2026-05-29',
    // Labor Day (Fall 2026)
    '2026-09-07',
    // Veterans Day
    '2026-11-11',
    // Thanksgiving Break
    '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27',
    // Winter Break 2026
    '2026-12-21', '2026-12-22', '2026-12-23', '2026-12-24', '2026-12-25',
    '2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31'
  ]),

  // Minimum days (early release)
  MINIMUM_DAYS: new Set([
    '2025-11-10', '2025-11-11', '2025-11-13', '2025-11-14',
    '2026-03-09', '2026-03-10', '2026-03-12', '2026-03-13',
    '2026-05-28'
  ])
};

/**
 * Weekend Anchor: Dec 12, 2025 is Weekend #1 (Mother's odd weekend)
 * Used to calculate alternating weekend schedule
 */
const WEEKEND_ANCHOR = new Date(2025, 11, 12, 12, 0, 0); // Dec 12, 2025 noon

/**
 * Parent identifiers
 */
const PARENT = {
  MOTHER: 'mother',
  FATHER: 'father',
  NONE: null
};

// ============================================================================
// 2. UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a date is an instruction day (school day with students)
 */
function isInstructionDay(date) {
  const dow = date.getDay();

  // Weekends are never instruction days
  if (dow === 0 || dow === 6) return false;

  // Check if before school starts or after school ends
  if (date < SCHOOL_CALENDAR.SCHOOL_START_2025) return false;
  if (date > SCHOOL_CALENDAR.SCHOOL_END_2026 && date < SCHOOL_CALENDAR.SCHOOL_START_2026) return false;

  // Check explicit no-instruction days
  const dateStr = formatDate(date);
  if (SCHOOL_CALENDAR.NO_INSTRUCTION_DAYS.has(dateStr)) return false;

  return true;
}

/**
 * Check if a date is a minimum day
 */
function isMinimumDay(date) {
  const dateStr = formatDate(date);
  return SCHOOL_CALENDAR.MINIMUM_DAYS.has(dateStr);
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get year parity (odd or even)
 */
function getYearParity(year) {
  return year % 2 === 0 ? 'even' : 'odd';
}

/**
 * Calculate which weekend number a date falls in (odd = 1,3,5... even = 2,4,6...)
 * Based on WEEKEND_ANCHOR (Dec 12, 2025 = Odd Weekend #1 for Mother)
 */
function getWeekendNumber(date) {
  let d = new Date(date);
  d.setHours(12, 0, 0, 0);

  let dow = d.getDay();

  // Normalize to Friday of the weekend
  if (dow === 6) d.setDate(d.getDate() - 1);      // Saturday -> Friday
  else if (dow === 0) d.setDate(d.getDate() - 2); // Sunday -> Friday
  else if (dow !== 5) {
    // Weekday: calculate previous Friday
    d.setDate(d.getDate() - ((dow + 2) % 7));
  }

  // Calculate weeks from anchor (weekends alternate every 7 days)
  const diffTime = d - WEEKEND_ANCHOR;
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  // Anchor is week 0 = Odd weekend (Mother)
  // Week 1 = Even weekend (Father)
  // Week 2 = Odd weekend (Mother), etc.
  const isOddWeekend = (diffWeeks % 2 === 0);

  return isOddWeekend ? 'odd' : 'even';
}

/**
 * Get pickup time based on minimum day status
 */
function getPickupTime(date) {
  if (isMinimumDay(date)) {
    return "1:10 PM (Alfie) / 1:25 PM (Basil)";
  }
  return "2:15 PM (Alfie) / 2:50 PM (Basil)";
}

/**
 * Create a custody result object
 */
function createResult(parent, events = [], note = '', level = null, rule = null, flags = {}) {
  return {
    parent,           // 'mother', 'father', or null
    events,           // Array of {type, title, time, location}
    note,             // Display note
    matchedLevel: level,  // Which level matched (0-4)
    matchedRule: rule,    // Which specific rule matched
    flags             // Additional flags (rightOfFirstRefusal, etc.)
  };
}

/**
 * Create an event object
 */
function createEvent(type, title, time, location) {
  return { type, title, time, location };
}

/**
 * Check if a month has a 5th weekend
 * Per Provision 14f, 5th weekends are treated as "odd" (Mother's time)
 */
function hasFifthWeekend(year, month) {
  // Count how many Fridays are in the month
  let fridayCount = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 5) { // Friday
      fridayCount++;
    }
  }

  return fridayCount === 5;
}

/**
 * Get the 5th Friday of a month (if it exists)
 */
function getFifthFriday(year, month) {
  let fridayCount = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 5) {
      fridayCount++;
      if (fridayCount === 5) {
        return day;
      }
    }
  }

  return null;
}

/**
 * Check if a date is part of a 5th weekend
 * 5th weekend = Friday, Saturday, Sunday of the 5th week
 */
function isFifthWeekend(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dow = date.getDay();

  // Only Friday, Saturday, Sunday can be part of a weekend
  if (dow !== 5 && dow !== 6 && dow !== 0) return false;

  const fifthFriday = getFifthFriday(year, month);
  if (!fifthFriday) return false;

  // Check if this date is the 5th Friday, or Sat/Sun immediately after
  if (dow === 5 && day === fifthFriday) return true;
  if (dow === 6 && day === fifthFriday + 1) return true;
  if (dow === 0 && day === fifthFriday + 2) return true;

  return false;
}

/**
 * Modifier C: Right of First Refusal (Provision 21)
 * Check if the non-custodial parent should be notified of extended absence
 * Returns flag if current parent will be absent > 24 hours
 */
function checkRightOfFirstRefusal(date, parent, prevDate = null, nextDate = null) {
  // This is a simplified implementation
  // In a full system, you would track actual parent availability/absence
  // For now, we just flag that the rule exists and should be checked

  // The actual implementation would need:
  // 1. Parent availability calendar
  // 2. Track consecutive days with same parent
  // 3. Check if parent has indicated absence > 24 hours
  // 4. Flag for other parent to claim those hours

  return {
    shouldCheck: true,
    message: 'If absent >24 hours, notify other parent for first refusal'
  };
}

// ============================================================================
// 3. HIERARCHICAL RULES ENGINE
// ============================================================================

/**
 * Main evaluation function: evaluates date through hierarchy
 * Returns the first match from Level 0 down to Level 4
 */
function evaluateCustody(date, options = {}) {
  // Normalize date to midnight
  const evalDate = new Date(date);
  evalDate.setHours(0, 0, 0, 0);

  // Evaluate hierarchy from Level 0 down
  let result = null;

  result = evaluateLevel0_SuperOverrides(evalDate);
  if (result) return applyModifiers(result, evalDate, options);

  result = evaluateLevel1_FixedDates(evalDate);
  if (result) return applyModifiers(result, evalDate, options);

  result = evaluateLevel2_RecurringHolidays(evalDate);
  if (result) return applyModifiers(result, evalDate, options);

  result = evaluateLevel3_SeasonalSchedule(evalDate);
  if (result) return applyModifiers(result, evalDate, options);

  result = evaluateLevel4_StandardRotation(evalDate);
  if (result) return applyModifiers(result, evalDate, options);

  // Fallback (should never reach here)
  return createResult(PARENT.FATHER, [], 'No rule matched', null, 'fallback');
}

/**
 * Apply global modifiers to the result
 */
function applyModifiers(result, date, options = {}) {
  // Apply Modifier C: Right of First Refusal
  if (options.checkRightOfFirstRefusal) {
    const rofrCheck = checkRightOfFirstRefusal(date, result.parent);
    if (rofrCheck.shouldCheck) {
      result.flags = result.flags || {};
      result.flags.rightOfFirstRefusal = rofrCheck;
    }
  }

  return result;
}

// ============================================================================
// LEVEL 0: SUPER-OVERRIDES (Provision 17 & 18)
// ============================================================================

function evaluateLevel0_SuperOverrides(date) {
  const month = date.getMonth();
  const day = date.getDate();
  const year = date.getFullYear();
  const dow = date.getDay();

  // Mother's Day (2nd Sunday of May)
  if (month === 4) {
    const mothersDay = getNthWeekdayOfMonth(year, 4, 0, 2); // 2nd Sunday of May
    if (day === mothersDay) {
      const events = [
        createEvent('receive', 'HE DROPS OFF', '9:00 AM', 'Your Home (Curbside)')
      ];
      return createResult(PARENT.MOTHER, events, "Mother's Day", 0, 'mothers_day');
    }

    // Day after Mother's Day - return to regular schedule
    if (day === mothersDay + 1) {
      const events = [];
      if (isInstructionDay(date)) {
        events.push(createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'));
      } else {
        events.push(createEvent('drop', 'YOU DROP OFF', '9:00 AM', "His House (Curbside)"));
      }
      return createResult(PARENT.MOTHER, events, "Return from Mother's Day", 0, 'mothers_day_return');
    }
  }

  // Father's Day (3rd Sunday of June)
  if (month === 5) {
    const fathersDay = getNthWeekdayOfMonth(year, 5, 0, 3); // 3rd Sunday of June
    if (day === fathersDay) {
      return createResult(PARENT.FATHER, [], "Father's Day", 0, 'fathers_day');
    }
  }

  // Mother's Birthday (October 2)
  if (month === 9 && day === 2) {
    const events = [];
    if (isInstructionDay(date)) {
      events.push(createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'));
      events.push(createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School'));
    } else {
      events.push(createEvent('receive', 'HE DROPS OFF', '9:00 AM', 'Your Home (Curbside)'));
    }
    return createResult(PARENT.MOTHER, events, 'Your Birthday', 0, 'mother_birthday');
  }

  // Day after Mother's birthday
  if (month === 9 && day === 3) {
    // Check if it's already Mother's weekend - if so, she keeps them
    const weekendType = getWeekendNumber(date);
    if (weekendType === 'odd') {
      return createResult(PARENT.MOTHER, [], 'My Weekend (Cont.)', 0, 'mother_birthday_weekend_continuation');
    } else {
      const events = [];
      if (isInstructionDay(date)) {
        events.push(createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'));
      } else {
        events.push(createEvent('drop', 'YOU DROP OFF', '9:00 AM', "His House (Curbside)"));
      }
      return createResult(PARENT.MOTHER, events, 'Return from Birthday', 0, 'mother_birthday_return');
    }
  }

  // Father's Birthday (December 31)
  if (month === 11 && day === 31) {
    // Note: If he already has them during winter break, this is just a note
    return null; // Will be handled by Level 1 winter break logic
  }

  return null; // No match at Level 0
}

/**
 * Helper: Get nth weekday of month (e.g., 2nd Sunday)
 */
function getNthWeekdayOfMonth(year, month, weekday, n) {
  let date = new Date(year, month, 1);
  let count = 0;

  while (date.getMonth() === month) {
    if (date.getDay() === weekday) {
      count++;
      if (count === n) return date.getDate();
    }
    date.setDate(date.getDate() + 1);
  }

  return -1;
}

// ============================================================================
// LEVEL 1: FIXED ONE-TIME DATES (Provision 16c - Winter Break 2025/26)
// ============================================================================

function evaluateLevel1_FixedDates(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const dow = date.getDay();

  // Winter Break 2025/26 specific schedule
  if (year === 2025 && month === 11) {
    // Dec 18: Mother picks up
    if (day === 18) {
      const events = [createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School')];
      return createResult(PARENT.MOTHER, events, 'Winter Break Starts', 1, 'winter_break_2025_start');
    }

    // Dec 19: Mother has them (school day)
    if (day === 19) {
      const events = [
        createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'),
        createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School')
      ];
      return createResult(PARENT.MOTHER, events, 'Winter Break Custody', 1, 'winter_break_2025_day2');
    }

    // Dec 20-21: Mother has them
    if (day >= 20 && day < 22) {
      return createResult(PARENT.MOTHER, [], 'Winter Break', 1, 'winter_break_2025_mother_1st');
    }

    // Dec 22: Mother drops off at 11:00 AM
    if (day === 22) {
      const events = [createEvent('drop', 'YOU DROP OFF', '11:00 AM', "His House (Curbside)")];
      return createResult(PARENT.MOTHER, events, 'Mid-Break Exchange', 1, 'winter_break_2025_exchange_1');
    }

    // Dec 23-24: Father has them
    if (day >= 23 && day < 25) {
      return createResult(PARENT.FATHER, [], 'Winter Break', 1, 'winter_break_2025_father');
    }

    // Dec 25: Father drops off at 11:00 AM (Christmas)
    if (day === 25) {
      const events = [createEvent('receive', 'HE DROPS OFF', '11:00 AM', "Your Home (Curbside)")];
      return createResult(PARENT.MOTHER, events, 'Christmas', 1, 'winter_break_2025_christmas');
    }

    // Dec 26-28: Mother has them
    if (day >= 26 && day < 29) {
      return createResult(PARENT.MOTHER, [], 'Winter Break', 1, 'winter_break_2025_mother_2nd');
    }

    // Dec 29: Mother drops off at 11:00 AM
    if (day === 29) {
      const events = [createEvent('drop', 'YOU DROP OFF', '11:00 AM', "His House (Curbside)")];
      return createResult(PARENT.MOTHER, events, 'Mid-Break Exchange', 1, 'winter_break_2025_exchange_2');
    }

    // Dec 30-31: Father has them
    if (day >= 30) {
      return createResult(PARENT.FATHER, [], 'Winter Break', 1, 'winter_break_2025_father_nye');
    }
  }

  // January 2026 continuation
  if (year === 2026 && month === 0 && day <= 6) {
    // Jan 1: Father has them (New Year's Day)
    if (day === 1) {
      return createResult(PARENT.FATHER, [], 'Winter Break', 1, 'winter_break_2026_new_year');
    }

    // Jan 2: Father drops off at 11:00 AM
    if (day === 2) {
      const events = [createEvent('receive', 'HE DROPS OFF', '11:00 AM', "Your Home (Curbside)")];
      return createResult(PARENT.MOTHER, events, 'Exchange', 1, 'winter_break_2026_exchange_3');
    }

    // Jan 3-4: Mother has them
    if (day >= 3 && day < 5) {
      return createResult(PARENT.MOTHER, [], 'Winter Break', 1, 'winter_break_2026_mother_final');
    }

    // Jan 5: Monday - check if instruction day
    if (day === 5) {
      // Jan 5, 2026 is NOT an instruction day (PD Day)
      // Modifier A applies: extend to Tuesday
      return createResult(PARENT.MOTHER, [], 'Winter Break (PD Day - Keep Until Tue)', 1, 'winter_break_2026_monday_extension');
    }

    // Jan 6: Tuesday - Mother drops off at school
    if (day === 6) {
      const events = [createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School')];
      return createResult(PARENT.MOTHER, events, 'Return from Winter Break', 1, 'winter_break_2026_return');
    }
  }

  return null; // No match at Level 1
}

// ============================================================================
// LEVEL 2: RECURRING HOLIDAY OVERRIDES (Provision 16a, b, d, e)
// ============================================================================

function evaluateLevel2_RecurringHolidays(date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const parity = getYearParity(year);

  // Halloween (October 31)
  if (month === 9 && day === 31) {
    if (parity === 'odd') {
      return createResult(PARENT.MOTHER, [], 'Halloween (Odd Year)', 2, 'halloween_mother');
    } else {
      return createResult(PARENT.FATHER, [], 'Halloween (Even Year)', 2, 'halloween_father');
    }
  }

  // Spring Break
  const springBreakResult = evaluateSpringBreak(date, year, month, day, parity);
  if (springBreakResult) return springBreakResult;

  // Thanksgiving Break
  const thanksgivingResult = evaluateThanksgivingBreak(date, year, month, day, parity);
  if (thanksgivingResult) return thanksgivingResult;

  // Winter Break (for years after 2026)
  if (year > 2026) {
    const winterBreakResult = evaluateWinterBreak(date, year, month, day, parity);
    if (winterBreakResult) return winterBreakResult;
  }

  return null; // No match at Level 2
}

/**
 * Spring Break evaluation
 * Assumption: Apr 3-10 is Spring Break for 2026 (from current code)
 */
function evaluateSpringBreak(date, year, month, day, parity) {
  // 2026 Spring Break: Apr 3-10 (Thu-Thu, but Apr 3 is Cesar Chavez Day)
  if (year === 2026 && month === 3) {
    // Apr 2: Last day of school before break - Mother picks up
    if (day === 2) {
      const events = [createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School')];
      return createResult(PARENT.MOTHER, events, 'Spring Break Starts', 2, 'spring_break_2026_start');
    }

    // Apr 3: Cesar Chavez Day (Mother has them)
    if (day === 3) {
      return createResult(PARENT.MOTHER, [], 'Cesar Chavez Day (No School)', 2, 'spring_break_2026_cesar_chavez');
    }

    // Spring Break days: Apr 4-7 (Mother's first half in even year)
    if (day >= 4 && day < 8) {
      return createResult(PARENT.MOTHER, [], 'Spring Break', 2, 'spring_break_2026_mother_half');
    }

    // Apr 8: Mid-break exchange at 12:00 PM
    if (day === 8) {
      const events = [createEvent('drop', 'YOU DROP OFF', '12:00 PM', "His House (Curbside)")];
      return createResult(PARENT.MOTHER, events, 'Mid-Break Exchange', 2, 'spring_break_2026_exchange');
    }

    // Apr 9-12: Father's second half
    if (day >= 9 && day <= 12) {
      return createResult(PARENT.FATHER, [], 'Spring Break', 2, 'spring_break_2026_father_half');
    }
  }

  return null;
}

/**
 * Thanksgiving Break evaluation
 * Assumption: Nov 23-27 is Thanksgiving Break for 2026
 */
function evaluateThanksgivingBreak(date, year, month, day, parity) {
  if (year === 2026 && month === 10) {
    // Nov 20: Last day of school - Mother picks up
    if (day === 20) {
      const events = [createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School')];
      return createResult(PARENT.MOTHER, events, 'TG Break Starts', 2, 'thanksgiving_2026_start');
    }

    // Nov 21-24: Mother's first half (even year)
    if (day >= 21 && day < 25) {
      return createResult(PARENT.MOTHER, [], 'Thanksgiving Break', 2, 'thanksgiving_2026_mother_half');
    }

    // Nov 25: Mid-break exchange at 12:00 PM
    if (day === 25) {
      const events = [createEvent('drop', 'YOU DROP OFF', '12:00 PM', "His House (Curbside)")];
      return createResult(PARENT.MOTHER, events, 'Mid-Break Exchange', 2, 'thanksgiving_2026_exchange');
    }

    // Nov 26-27: Father's second half
    if (day >= 26 && day <= 27) {
      return createResult(PARENT.FATHER, [], 'Thanksgiving Break', 2, 'thanksgiving_2026_father_half');
    }
  }

  return null;
}

/**
 * Winter Break evaluation (for years after 2026)
 * Follows same split pattern as other breaks
 */
function evaluateWinterBreak(date, year, month, day, parity) {
  // TODO: Implement for 2027+ when dates are known
  // Pattern: Last instruction day -> First half parent
  // Midpoint -> Second half parent
  // Day before school resumes -> Return
  return null;
}

// ============================================================================
// LEVEL 3: SEASONAL SCHEDULE (Provision 14a-f - Summer)
// ============================================================================

function evaluateLevel3_SeasonalSchedule(date) {
  const year = date.getFullYear();

  // Check if in summer period
  if (date >= SCHOOL_CALENDAR.SUMMER_START_2026 && date <= SCHOOL_CALENDAR.SUMMER_END_2026) {
    return evaluateSummerSchedule(date);
  }

  return null; // No match at Level 3
}

/**
 * Summer 8-week rotation
 * Weeks 1,3,5,7: Mother
 * Weeks 2,4,6,8: Father
 * Exchanges at Friday 4:00 PM
 */
function evaluateSummerSchedule(date) {
  const daysSinceStart = Math.floor((date - SCHOOL_CALENDAR.SUMMER_START_2026) / (1000 * 60 * 60 * 24));
  const weekNum = Math.floor(daysSinceStart / 7) + 1;
  const dow = date.getDay();

  // Beyond 8 weeks - check Friday transition
  if (weekNum > 8) {
    // After week 8, use "Friday Return Logic" (14f)
    // Friday following Father's 8th week determines next parent
    const endOfWeek8 = new Date(SCHOOL_CALENDAR.SUMMER_START_2026);
    endOfWeek8.setDate(endOfWeek8.getDate() + (8 * 7)); // End of week 8

    // Find the Friday after week 8
    let fridayAfterWeek8 = new Date(endOfWeek8);
    while (fridayAfterWeek8.getDay() !== 5) {
      fridayAfterWeek8.setDate(fridayAfterWeek8.getDate() + 1);
    }

    // Check which weekend type that Friday starts
    const weekendType = getWeekendNumber(fridayAfterWeek8);

    if (date >= fridayAfterWeek8) {
      // Transition to regular schedule - check which parent based on weekend
      if (weekendType === 'odd') {
        return createResult(PARENT.MOTHER, [], 'Post-Summer (Regular Schedule)', 3, 'summer_end_transition_mother');
      } else {
        return createResult(PARENT.FATHER, [], 'Post-Summer (Regular Schedule)', 3, 'summer_end_transition_father');
      }
    }
  }

  // Within 8 weeks
  if (weekNum <= 8) {
    const isMotherWeek = [1, 3, 5, 7].includes(weekNum);
    const nextWeekNum = weekNum + 1;
    const isMotherNextWeek = [1, 3, 5, 7].includes(nextWeekNum);

    // Friday exchanges
    if (dow === 5 && weekNum <= 8) {
      if (isMotherWeek && !isMotherNextWeek) {
        // Mother's week ending, Father's week starting
        const events = [createEvent('drop', 'YOU DROP OFF', '4:00 PM', "Camp or His House (Curbside)")];
        return createResult(PARENT.MOTHER, events, `End Summer Week ${weekNum}`, 3, `summer_week_${weekNum}_end_mother`);
      } else if (!isMotherWeek && isMotherNextWeek) {
        // Father's week ending, Mother's week starting
        const events = [createEvent('receive', 'HE DROPS OFF', '4:00 PM', "Camp or Your Home (Curbside)")];
        return createResult(PARENT.MOTHER, events, `Start Summer Week ${nextWeekNum}`, 3, `summer_week_${nextWeekNum}_start_mother`);
      }
    }

    // Regular summer week days
    if (isMotherWeek) {
      return createResult(PARENT.MOTHER, [], `Summer Week ${weekNum}`, 3, `summer_week_${weekNum}_mother`);
    } else {
      return createResult(PARENT.FATHER, [], `Summer Week ${weekNum}`, 3, `summer_week_${weekNum}_father`);
    }
  }

  return null;
}

// ============================================================================
// LEVEL 4: STANDARD WEEKLY ROTATION (Provision 12a-b)
// ============================================================================

function evaluateLevel4_StandardRotation(date) {
  const dow = date.getDay();
  const weekendType = getWeekendNumber(date);

  // Monday
  if (dow === 1) {
    // Check previous day (Sunday)
    const sunday = new Date(date);
    sunday.setDate(sunday.getDate() - 1);
    const sundayWeekendType = getWeekendNumber(sunday);

    // If Sunday was Mother's weekend
    if (sundayWeekendType === 'odd') {
      // Check Modifier A: Monday Holiday Extension
      if (!isInstructionDay(date)) {
        // Not an instruction day - Mother keeps until Tuesday
        return createResult(PARENT.MOTHER, [], 'Holiday Extension (Keep Until Tue)', 4, 'monday_mother_holiday_extension');
      }

      // Instruction day - Mother drops off at school
      const events = [createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School')];
      return createResult(PARENT.MOTHER, events, 'End of Weekend', 4, 'monday_mother_return');
    }

    // Sunday was Father's weekend - he has them Monday
    return createResult(PARENT.FATHER, [], 'Regular Monday', 4, 'monday_father');
  }

  // Tuesday
  if (dow === 2) {
    // Check if previous Monday was non-instruction day
    const monday = new Date(date);
    monday.setDate(monday.getDate() - 1);

    if (!isInstructionDay(monday)) {
      // Check if Sunday before Monday was Mother's weekend
      const sunday = new Date(monday);
      sunday.setDate(sunday.getDate() - 1);
      const sundayWeekendType = getWeekendNumber(sunday);

      if (sundayWeekendType === 'odd') {
        // Mother had them through Monday holiday, drops off Tuesday
        const events = [];
        if (isInstructionDay(date)) {
          events.push(createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'));
        } else {
          events.push(createEvent('drop', 'YOU DROP OFF', '9:00 AM', "His House (Curbside)"));
        }
        return createResult(PARENT.MOTHER, events, 'Return from Holiday', 4, 'tuesday_mother_holiday_return');
      }
    }

    // Regular Tuesday - Father has them
    return createResult(PARENT.FATHER, [], 'Regular Tuesday', 4, 'tuesday_father');
  }

  // Wednesday
  if (dow === 3) {
    // Father has them Wednesday
    return createResult(PARENT.FATHER, [], 'Regular Wednesday', 4, 'wednesday_father');
  }

  // Thursday
  if (dow === 4) {
    const events = [];
    if (isInstructionDay(date)) {
      events.push(createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School'));
    }
    return createResult(PARENT.MOTHER, events, 'Thursday Overnight', 4, 'thursday_mother');
  }

  // Friday
  if (dow === 5) {
    // Check if continuous care from Thursday (e.g., summer week 1 starts May 29, Fri)
    // This is handled by Level 3, but if we're here, it's regular rotation

    // Check for 5th weekend (Provision 14f - treated as odd/Mother's weekend)
    if (isFifthWeekend(date)) {
      const events = [];
      if (isInstructionDay(date)) {
        events.push(createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'));
        events.push(createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School'));
      }
      return createResult(PARENT.MOTHER, events, '5th Weekend (Mother)', 4, 'friday_fifth_weekend');
    }

    if (weekendType === 'odd') {
      // Mother's weekend starting
      const events = [];
      if (isInstructionDay(date)) {
        events.push(createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'));
        events.push(createEvent('pick', 'YOU PICK UP', getPickupTime(date), 'School'));
      }
      return createResult(PARENT.MOTHER, events, 'Weekend Start', 4, 'friday_mother_weekend');
    } else {
      // Father's weekend starting - Mother drops off
      const events = [];
      if (isInstructionDay(date)) {
        events.push(createEvent('drop', 'YOU DROP OFF', '8:20 AM', 'School'));
      } else {
        events.push(createEvent('drop', 'YOU DROP OFF', '9:00 AM', "His House (Curbside)"));
      }
      return createResult(PARENT.FATHER, events, 'End of Your Time', 4, 'friday_father_weekend');
    }
  }

  // Saturday
  if (dow === 6) {
    // Check for 5th weekend
    if (isFifthWeekend(date)) {
      return createResult(PARENT.MOTHER, [], '5th Weekend (Mother)', 4, 'saturday_fifth_weekend');
    }

    if (weekendType === 'odd') {
      return createResult(PARENT.MOTHER, [], 'My Weekend', 4, 'saturday_mother');
    } else {
      return createResult(PARENT.FATHER, [], 'His Weekend', 4, 'saturday_father');
    }
  }

  // Sunday
  if (dow === 0) {
    // Check for 5th weekend
    if (isFifthWeekend(date)) {
      return createResult(PARENT.MOTHER, [], '5th Weekend (Mother)', 4, 'sunday_fifth_weekend');
    }

    if (weekendType === 'odd') {
      return createResult(PARENT.MOTHER, [], 'My Weekend', 4, 'sunday_mother');
    } else {
      return createResult(PARENT.FATHER, [], 'His Weekend', 4, 'sunday_father');
    }
  }

  return createResult(PARENT.FATHER, [], 'Fallback', 4, 'fallback');
}

// ============================================================================
// 4. EXPORT
// ============================================================================

// Export for use in HTML
if (typeof window !== 'undefined') {
  window.CustodyEngine = {
    evaluateCustody,
    isInstructionDay,
    isMinimumDay,
    getWeekendNumber,
    isFifthWeekend,
    hasFifthWeekend,
    getFifthFriday,
    checkRightOfFirstRefusal,
    PARENT
  };
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    evaluateCustody,
    isInstructionDay,
    isMinimumDay,
    getWeekendNumber,
    isFifthWeekend,
    hasFifthWeekend,
    getFifthFriday,
    checkRightOfFirstRefusal,
    PARENT
  };
}
