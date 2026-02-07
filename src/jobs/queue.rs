use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use firestore::*;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tracing::{error, info};

const COLLECTION: &str = "jobs";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    #[serde(rename = "type")]
    pub job_type: String,
    pub payload: serde_json::Value,
    #[serde(with = "firestore::serialize_as_timestamp")]
    pub execute_at: DateTime<Utc>,
    pub status: String,
}

/// Async handler function type for processing jobs.
pub type JobHandler = Arc<
    dyn Fn(serde_json::Value) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send>>
        + Send
        + Sync,
>;

pub struct JobQueue {
    db: FirestoreDb,
    handlers: Arc<RwLock<HashMap<String, JobHandler>>>,
    poll_handle: Option<JoinHandle<()>>,
}

impl JobQueue {
    pub fn new(db: FirestoreDb) -> Self {
        Self {
            db,
            handlers: Arc::new(RwLock::new(HashMap::new())),
            poll_handle: None,
        }
    }

    /// Register a handler for a given job type.
    pub async fn register<F, Fut>(&self, job_type: &str, handler: F)
    where
        F: Fn(serde_json::Value) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = anyhow::Result<()>> + Send + 'static,
    {
        let wrapped: JobHandler =
            Arc::new(move |payload| Box::pin(handler(payload)) as Pin<Box<dyn Future<Output = _> + Send>>);
        self.handlers
            .write()
            .await
            .insert(job_type.to_string(), wrapped);
    }

    /// Enqueue a job to run after `delay_seconds`.
    pub async fn enqueue(
        &self,
        job_type: &str,
        payload: serde_json::Value,
        delay_seconds: u64,
    ) -> anyhow::Result<()> {
        let execute_at = Utc::now() + chrono::Duration::seconds(delay_seconds as i64);
        let id = format!("{}-{}", job_type, Utc::now().timestamp_millis());

        let job = Job {
            id: id.clone(),
            job_type: job_type.to_string(),
            payload,
            execute_at,
            status: "pending".to_string(),
        };

        self.db
            .fluent()
            .insert()
            .into(COLLECTION)
            .document_id(&id)
            .object(&job)
            .execute::<()>()
            .await?;

        info!(job_type, id, %execute_at, "Job enqueued");
        Ok(())
    }

    /// Get all pending jobs.
    pub async fn get_pending_jobs(&self) -> anyhow::Result<Vec<Job>> {
        let jobs: Vec<Job> = self
            .db
            .fluent()
            .select()
            .from(COLLECTION)
            .filter(|q| q.for_all([q.field(path!(Job::status)).eq("pending")]))
            .obj()
            .query()
            .await?;
        Ok(jobs)
    }

    /// Start the polling loop. Processes immediately on startup for recovery,
    /// then polls at the given interval.
    pub fn start(&mut self, poll_interval_ms: u64) {
        info!(poll_interval_ms, "Job queue started");

        let db = self.db.clone();
        let handlers = self.handlers.clone();

        let handle = tokio::spawn(async move {
            // Process immediately on startup for recovery
            if let Err(e) = process_due_jobs(&db, &handlers).await {
                error!(error = %e, "Error processing jobs on startup");
            }

            let mut interval =
                tokio::time::interval(tokio::time::Duration::from_millis(poll_interval_ms));
            loop {
                interval.tick().await;
                if let Err(e) = process_due_jobs(&db, &handlers).await {
                    error!(error = %e, "Error processing jobs");
                }
            }
        });

        self.poll_handle = Some(handle);
    }

    /// Stop the polling loop.
    pub fn stop(&mut self) {
        if let Some(handle) = self.poll_handle.take() {
            handle.abort();
            info!("Job queue stopped");
        }
    }
}

/// Poll for due jobs and execute them.
async fn process_due_jobs(
    db: &FirestoreDb,
    handlers: &Arc<RwLock<HashMap<String, JobHandler>>>,
) -> anyhow::Result<()> {
    let jobs: Vec<Job> = db
        .fluent()
        .select()
        .from(COLLECTION)
        .filter(|q| q.for_all([q.field(path!(Job::status)).eq("pending")]))
        .obj()
        .query()
        .await?;

    let now = Utc::now();

    for job in jobs {
        if job.execute_at <= now {
            execute_job(db, handlers, &job).await;
        }
    }

    Ok(())
}

/// Execute a single job: mark running, call handler, delete on success or mark failed.
async fn execute_job(
    db: &FirestoreDb,
    handlers: &Arc<RwLock<HashMap<String, JobHandler>>>,
    job: &Job,
) -> () {
    let handler = {
        let map = handlers.read().await;
        map.get(&job.job_type).cloned()
    };

    let Some(handler) = handler else {
        error!(job_type = job.job_type, "No handler registered for job type");
        return;
    };

    // Mark as running
    let running = Job {
        status: "running".to_string(),
        ..job.clone()
    };
    if let Err(e) = db
        .fluent()
        .update()
        .in_col(COLLECTION)
        .document_id(&job.id)
        .object(&running)
        .execute::<()>()
        .await
    {
        error!(error = %e, id = job.id, "Failed to mark job as running");
        return;
    }

    // Execute
    match handler(job.payload.clone()).await {
        Ok(()) => {
            // Delete completed job
            if let Err(e) = db
                .fluent()
                .delete()
                .from(COLLECTION)
                .document_id(&job.id)
                .execute()
                .await
            {
                error!(error = %e, id = job.id, "Failed to delete completed job");
            }
            info!(job_type = job.job_type, id = job.id, "Job completed");
        }
        Err(e) => {
            error!(error = %e, job_type = job.job_type, id = job.id, "Job failed");
            let failed = Job {
                status: "failed".to_string(),
                ..job.clone()
            };
            if let Err(e) = db
                .fluent()
                .update()
                .in_col(COLLECTION)
                .document_id(&job.id)
                .object(&failed)
                .execute::<()>()
                .await
            {
                error!(error = %e, id = job.id, "Failed to mark job as failed");
            }
        }
    }
}
