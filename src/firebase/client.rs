use base64::Engine;
use firestore::*;
use gcloud_sdk::TokenSourceType;
use tracing::info;

/// Initialize a FirestoreDb from a base64-encoded service account JSON string.
///
/// The `cert_base64` parameter is the FIREBASE_64 env var: a base64url-encoded
/// JSON service account key.
pub async fn create_firestore_db(
    project_id: &str,
    cert_base64: &str,
) -> anyhow::Result<FirestoreDb> {
    let json_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(cert_base64)
        .or_else(|_| base64::engine::general_purpose::STANDARD.decode(cert_base64))?;
    let json_string = String::from_utf8(json_bytes)?;

    let db = FirestoreDb::with_options_token_source(
        FirestoreDbOptions::new(project_id.to_string()),
        vec!["https://www.googleapis.com/auth/datastore".to_string()],
        TokenSourceType::Json(json_string),
    )
    .await?;

    info!(project_id, "Firestore client initialized");
    Ok(db)
}
