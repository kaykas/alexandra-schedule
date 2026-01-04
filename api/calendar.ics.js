// Vercel Serverless Function for Calendar Subscription
// This generates an iCal feed that can be subscribed to in Google Calendar, Apple Calendar, etc.

// Import the custody engine logic (simplified for server-side)
const PARENT = {
    MOTHER: 'mother',
    FATHER: 'father'
};

const SCHOOL_CALENDAR = {
    NO_INSTRUCTION_DAYS: new Set([
        '2026-01-05', // PD Day
        '2026-01-19', // MLK Day
        '2026-02-16', // Presidents Day
        '2026-03-30', '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03', // Spring Break
        '2026-05-25', // Memorial Day
        '2026-11-11', // Veterans Day
        '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', // Thanksgiving Break
        '2025-12-22', '2025-12-23', '2025-12-24', '2025-12-25', '2025-12-26', // Winter Break 2025
        '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02' // Winter Break 2026
    ])
};

const WEEKEND_ANCHOR = new Date(2025, 11, 12); // December 12, 2025 (odd weekend = Mother)

function isInstructionDay(date) {
    const dateStr = formatDateKey(date);
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    if (SCHOOL_CALENDAR.NO_INSTRUCTION_DAYS.has(dateStr)) return false;

    return true;
}

function formatDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getPickupTime(date) {
    return isInstructionDay(date) ? '2:15 PM (Alfie) / 2:50 PM (Brooke)' : '9:00 AM';
}

function createEvent(type, title, time, location) {
    return { type, title, time, location };
}

function createResult(parent, events, rule, level, ruleId) {
    return {
        parent,
        events: events || [],
        matchedLevel: level,
        matchedRule: rule,
        ruleId
    };
}

// Simplified custody evaluation (core logic from custody-engine.js)
function evaluateCustody(date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    const dayOfWeek = date.getDay();

    // Level 0: Super-Overrides (Mother's Day, Father's Day, Birthdays)
    if (month === 4 && dayOfWeek === 0) { // May, Sunday
        const secondSunday = new Date(year, 4, 8);
        if (date >= secondSunday && date < new Date(year, 4, 15)) {
            return createResult(PARENT.MOTHER, [], "Mother's Day", 0, 'mothers_day');
        }
    }

    if (month === 5 && dayOfWeek === 0) { // June, Sunday
        const thirdSunday = new Date(year, 5, 15);
        if (date >= thirdSunday && date < new Date(year, 5, 22)) {
            return createResult(PARENT.FATHER, [], "Father's Day", 0, 'fathers_day');
        }
    }

    if (month === 9 && day === 2) { // October 2 - Mother's birthday
        return createResult(PARENT.MOTHER, [], "Mother's Birthday", 0, 'mothers_birthday');
    }

    if (month === 6 && day === 25) { // July 25 - Father's birthday
        return createResult(PARENT.FATHER, [], "Father's Birthday", 0, 'fathers_birthday');
    }

    // Level 1: Winter Break 2025/26
    if (year === 2025 && month === 11) {
        if (day >= 19 && day <= 21) {
            const events = day === 19 ? [createEvent('receive', 'HE DROPS OFF', '11:00 AM', 'Your Home')] : [];
            return createResult(PARENT.FATHER, events, 'Winter Break 2025/26', 1, 'winter_break_father');
        }
        if (day >= 22 && day <= 28) {
            const events = day === 22 ? [createEvent('pick', 'YOU PICK UP', '9:00 AM', 'His Home')] : [];
            return createResult(PARENT.MOTHER, events, 'Winter Break 2025/26', 1, 'winter_break_mother');
        }
        if (day >= 29 && day <= 31) {
            const events = day === 29 ? [createEvent('receive', 'HE DROPS OFF', '9:00 AM', 'Your Home')] : [];
            return createResult(PARENT.FATHER, events, 'Winter Break 2025/26', 1, 'winter_break_father_2');
        }
    }

    if (year === 2026 && month === 0) {
        if (day >= 1 && day <= 3) {
            return createResult(PARENT.FATHER, [], 'Winter Break 2025/26', 1, 'winter_break_father_3');
        }
        if (day >= 4 && day <= 5) {
            const events = day === 4 ? [createEvent('pick', 'YOU PICK UP', '9:00 AM', 'His Home')] : [];

            const nextDay = new Date(date);
            nextDay.setDate(nextDay.getDate() + 1);
            const mondayIsInstruction = isInstructionDay(nextDay);

            if (day === 5 && !mondayIsInstruction) {
                return createResult(PARENT.MOTHER, events, 'Winter Break + Monday Extension', 1, 'winter_break_monday_extension');
            }

            return createResult(PARENT.MOTHER, events, 'Winter Break 2025/26', 1, 'winter_break_mother_2');
        }
    }

    // Level 2: Recurring holidays
    if (month === 9 && day === 31) { // Halloween
        return createResult(PARENT.MOTHER, [], 'Halloween', 2, 'halloween');
    }

    // Level 3: Summer schedule (8-week rotation)
    const summerStart = new Date(year, 5, 15); // June 15
    const summerEnd = new Date(year, 7, 10); // August 10
    if (date >= summerStart && date <= summerEnd) {
        const daysSinceSummerStart = Math.floor((date - summerStart) / (1000 * 60 * 60 * 24));
        const weekNumber = Math.floor(daysSinceSummerStart / 7);

        if (weekNumber % 2 === 0) {
            return createResult(PARENT.MOTHER, [], 'Summer Schedule (Mother\'s Week)', 3, 'summer_mother');
        } else {
            return createResult(PARENT.FATHER, [], 'Summer Schedule (Father\'s Week)', 3, 'summer_father');
        }
    }

    // Level 4: Standard weekly rotation
    const diffTime = date - WEEKEND_ANCHOR;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    const diffWeeks = Math.floor(diffDays / 7);
    const isOddWeekend = (diffWeeks % 2 === 0);

    // Check for 5th weekend
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const fridays = [];
    for (let d = new Date(firstDayOfMonth); d <= lastDayOfMonth; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 5) fridays.push(d.getDate());
    }
    const is5thWeekend = fridays.length === 5 && (dayOfWeek === 5 || dayOfWeek === 6) && day >= fridays[4];

    if (is5thWeekend) {
        return createResult(PARENT.MOTHER, [], '5th Weekend', 4, '5th_weekend');
    }

    // Thursday overnight
    if (dayOfWeek === 4) {
        const events = [createEvent('pick', 'YOU PICK UP', getPickupTime(date), isInstructionDay(date) ? 'School' : 'His Home')];
        return createResult(PARENT.MOTHER, events, 'Thursday Overnight', 4, 'thursday_overnight');
    }

    // Friday - check weekend assignment
    if (dayOfWeek === 5) {
        if (isOddWeekend) {
            return createResult(PARENT.MOTHER, [], 'Odd Weekend (Mother)', 4, 'odd_weekend_friday');
        } else {
            const events = [createEvent('drop', 'YOU DROP OFF', getPickupTime(date), isInstructionDay(date) ? 'School' : 'His Home')];
            return createResult(PARENT.FATHER, events, 'Even Weekend (Father)', 4, 'even_weekend_friday');
        }
    }

    // Saturday - continue weekend assignment
    if (dayOfWeek === 6) {
        if (isOddWeekend) {
            return createResult(PARENT.MOTHER, [], 'Odd Weekend (Mother)', 4, 'odd_weekend_saturday');
        } else {
            return createResult(PARENT.FATHER, [], 'Even Weekend (Father)', 4, 'even_weekend_saturday');
        }
    }

    // Sunday - end of weekend
    if (dayOfWeek === 0) {
        if (isOddWeekend) {
            const events = [createEvent('drop', 'YOU DROP OFF', '5:00 PM', 'His Home')];
            return createResult(PARENT.MOTHER, events, 'Odd Weekend (Mother)', 4, 'odd_weekend_sunday');
        } else {
            const events = [createEvent('receive', 'HE DROPS OFF', '5:00 PM', 'Your Home')];
            return createResult(PARENT.FATHER, events, 'Even Weekend (Father)', 4, 'even_weekend_sunday');
        }
    }

    // Monday-Wednesday
    if (dayOfWeek >= 1 && dayOfWeek <= 3) {
        const events = dayOfWeek === 1 ? [createEvent('pick', 'YOU PICK UP', getPickupTime(date), isInstructionDay(date) ? 'School' : 'His Home')] : [];
        return createResult(PARENT.MOTHER, events, 'Weekday', 4, 'weekday');
    }

    return createResult(PARENT.FATHER, [], 'Default', 4, 'default');
}

function formatICalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function formatICalDateTime(date, time) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(time.hours).padStart(2, '0');
    const minutes = String(time.minutes).padStart(2, '0');
    return `${year}${month}${day}T${hours}${minutes}00`;
}

function parseEventTime(timeStr) {
    if (timeStr === 'TBD') return { hours: 9, minutes: 0 };

    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return { hours: 9, minutes: 0 };

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const meridiem = match[3].toUpperCase();

    if (meridiem === 'PM' && hours !== 12) hours += 12;
    else if (meridiem === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
}

function generateICalFeed() {
    const icalEvents = [];
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
    const endDate = new Date(today.getFullYear() + 1, today.getMonth(), 0);

    // Generate events for 12 months
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const date = new Date(d);
        const result = evaluateCustody(date);

        const dateStr = formatICalDate(date);
        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDayStr = formatICalDate(nextDay);

        // All-day event for custody
        if (result.parent === 'mother') {
            icalEvents.push({
                type: 'custody',
                start: dateStr,
                end: nextDayStr,
                summary: 'Alexandra with Mother',
                description: `Level ${result.matchedLevel}: ${result.matchedRule}`
            });
        }

        // Add exchange events
        if (result.events && result.events.length > 0) {
            result.events.forEach(e => {
                const eventTime = parseEventTime(e.time);
                const startDateTime = formatICalDateTime(date, eventTime);
                const endTime = new Date(date);
                endTime.setHours(eventTime.hours + 1, eventTime.minutes);
                const endDateTime = formatICalDateTime(endTime, { hours: endTime.getHours(), minutes: endTime.getMinutes() });

                icalEvents.push({
                    type: 'event',
                    start: startDateTime,
                    end: endDateTime,
                    summary: e.title,
                    location: e.location,
                    description: `${e.title} at ${e.time}\\nLocation: ${e.location}`
                });
            });
        }
    }

    // Generate iCal file content
    let icalContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Alexandra Schedule//Custody Calendar//EN',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'X-WR-CALNAME:Alexandra\'s Custody Schedule',
        'X-WR-TIMEZONE:America/Los_Angeles',
        'X-WR-CALDESC:Roberts/Gardenhire Custody Schedule - Auto-updating feed',
        'REFRESH-INTERVAL;VALUE=DURATION:P1D',
        'X-PUBLISHED-TTL:PT1H'
    ].join('\r\n');

    // Add all events
    const timestamp = formatICalDate(new Date());
    icalEvents.forEach((event, idx) => {
        const uid = `${event.start}-${idx}@alexandra-schedule.vercel.app`;

        if (event.type === 'custody') {
            icalContent += '\r\n' + [
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${timestamp}`,
                `DTSTART;VALUE=DATE:${event.start}`,
                `DTEND;VALUE=DATE:${event.end}`,
                `SUMMARY:${event.summary}`,
                `DESCRIPTION:${event.description}`,
                'TRANSP:TRANSPARENT',
                'STATUS:CONFIRMED',
                'END:VEVENT'
            ].join('\r\n');
        } else {
            icalContent += '\r\n' + [
                'BEGIN:VEVENT',
                `UID:${uid}`,
                `DTSTAMP:${timestamp}`,
                `DTSTART:${event.start}`,
                `DTEND:${event.end}`,
                `SUMMARY:${event.summary}`,
                `LOCATION:${event.location}`,
                `DESCRIPTION:${event.description}`,
                'STATUS:CONFIRMED',
                'END:VEVENT'
            ].join('\r\n');
        }
    });

    icalContent += '\r\nEND:VCALENDAR';

    return icalContent;
}

// Vercel serverless function handler
export default function handler(req, res) {
    try {
        const icalContent = generateICalFeed();

        res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
        res.setHeader('Content-Disposition', 'inline; filename="alexandra-custody-schedule.ics"');
        res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
        res.status(200).send(icalContent);
    } catch (error) {
        console.error('Error generating calendar feed:', error);
        res.status(500).json({ error: 'Failed to generate calendar feed' });
    }
}
