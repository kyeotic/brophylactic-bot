use chrono::{DateTime, Utc};
use chrono_humanize::HumanTime;
use chrono_tz::Tz;

/// Check if a UTC datetime is "today" in the given timezone.
pub fn is_today(tz: Tz, date: DateTime<Utc>) -> bool {
    let today = Utc::now().with_timezone(&tz).date_naive();
    let other = date.with_timezone(&tz).date_naive();
    today == other
}

/// Format a UTC datetime as "YYYY-MM-DD" in the given timezone.
pub fn get_day_string(tz: Tz, date: DateTime<Utc>) -> String {
    date.with_timezone(&tz).format("%Y-%m-%d").to_string()
}

/// Format a datetime as a human-readable distance from now (e.g. "3 days ago").
pub fn format_distance_to_now(date: DateTime<Utc>) -> String {
    HumanTime::from(date).to_string()
}
