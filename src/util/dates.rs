use chrono::{DateTime, Datelike, NaiveDate, Utc};
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

/// Format a UTC datetime as "YYYY-MM-DD" for today in the given timezone.
#[allow(dead_code)]
pub fn today_string(timezone: &str) -> String {
    get_day_string(timezone, Utc::now())
}

/// Convert a millisecond duration to a human-readable string (e.g. "1d 5h 10m 48s").
#[allow(dead_code)]
pub fn humanize_milliseconds(milliseconds: u64) -> String {
    millisecond::Millisecond::from_millis(milliseconds).to_string()
}

/// Calculate the number of days between a date and now.
#[allow(dead_code)]
pub fn days_since(date: NaiveDate) -> i64 {
    let today = Utc::now().date_naive();
    (today - date).num_days()
}

/// Format a datetime as a human-readable distance from now (e.g. "3 days ago").
pub fn format_distance_to_now(date: DateTime<Utc>) -> String {
    HumanTime::from(date).to_string()
}
