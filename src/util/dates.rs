use chrono::{DateTime, Datelike, Utc};
use chrono_humanize::HumanTime;
use chrono_tz::Tz;

/// Check if a UTC datetime is "today" in the given timezone.
pub fn is_today(timezone: &str, date: DateTime<Utc>) -> bool {
    let tz: Tz = timezone.parse().expect("Invalid timezone");
    let today = Utc::now().with_timezone(&tz).date_naive();
    let other = date.with_timezone(&tz).date_naive();
    today == other
}

/// Format a UTC datetime as "YYYY-MM-DD" in the given timezone.
pub fn get_day_string(timezone: &str, date: DateTime<Utc>) -> String {
    let tz: Tz = timezone.parse().expect("Invalid timezone");
    let zoned = date.with_timezone(&tz);
    format!(
        "{:04}-{:02}-{:02}",
        zoned.year(),
        zoned.month(),
        zoned.day()
    )
}

/// Format a datetime as a human-readable distance from now (e.g. "3 days ago").
pub fn format_distance_to_now(date: DateTime<Utc>) -> String {
    HumanTime::from(date).to_string()
}
