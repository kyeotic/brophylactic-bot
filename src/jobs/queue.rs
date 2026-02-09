use std::collections::HashMap;
use std::fmt;
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

#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum JobType {
    #[serde(rename = "roulette:finish")]
    RouletteFinish,
    #[serde(rename = "sardines:finish")]
    SardinesFinish,
}

impl fmt::Display for JobType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::RouletteFinish => write!(f, "roulette:finish"),
            Self::SardinesFinish => write!(f, "sardines:finish"),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum JobStatus {
    Pending,
    Running,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Job {
    pub id: String,
    #[serde(rename = "type")]
    pub job_type: JobType,
    pub payload: serde_json::Value,
    #[serde(with = "firestore::serialize_as_timestamp")]
    pub execute_at: DateTime<Utc>,
    pub status: JobStatus,
}

/// Async handler function type for processing jobs.
pub type JobHandler = Arc<
    dyn Fn(serde_json::Value) -> Pin<Box<dyn Future<Output = anyhow::Result<()>> + Send>>
        + Send
        + Sync,
>;

pub struct JobQueue {
    db: FirestoreDb,
    handlers: Arc<RwLock<HashMap<JobType, JobHandler>>>,
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

    /// Register a handler for a given job type. The payload is automatically
    /// deserialized from JSON into `T` before the handler is called.
    pub async fn register<T, F, Fut>(&self, job_type: JobType, handler: F)
    where
        T: for<'de> Deserialize<'de> + Send + 'static,
        F: Fn(T) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = anyhow::Result<()>> + Send + 'static,
    {
        let wrapped: JobHandler = Arc::new(move |payload: serde_json::Value| {
            let parsed: T = match serde_json::from_value(payload) {
                Ok(v) => v,
                Err(e) => return Box::pin(async move { Err(e.into()) }),
            };
            Box::pin(handler(parsed)) as Pin<Box<dyn Future<Output = _> + Send>>
        });
        self.handlers.write().await.insert(job_type, wrapped);
    }

    /// Enqueue a job to run after `delay_seconds`. The payload is automatically
    /// serialized to JSON.
    pub async fn enqueue<T: Serialize>(
        &self,
        job_type: JobType,
        payload: &T,
        delay_seconds: u64,
    ) -> anyhow::Result<()> {
        let execute_at = Utc::now() + chrono::Duration::seconds(delay_seconds as i64);
        let id = format!("{}-{}", job_type, Utc::now().timestamp_millis());

        info!(%job_type, %id, %execute_at, "Job enqueued");

        let job = Job {
            id,
            job_type,
            payload: serde_json::to_value(payload)?,
            execute_at,
            status: JobStatus::Pending,
        };

        self.db
            .fluent()
            .insert()
            .into(COLLECTION)
            .document_id(&job.id)
            .object(&job)
            .execute::<()>()
            .await?;
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

    /// Stop the polling loop.
    pub fn stop(&mut self) {
        if let Some(handle) = self.poll_handle.take() {
            handle.abort();
            info!("Job queue stopped");
        }
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
}

/// Poll for due jobs and execute them.
async fn process_due_jobs(
    db: &FirestoreDb,
    handlers: &Arc<RwLock<HashMap<JobType, JobHandler>>>,
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
    handlers: &Arc<RwLock<HashMap<JobType, JobHandler>>>,
    job: &Job,
) {
    let handler = {
        let map = handlers.read().await;
        map.get(&job.job_type).cloned()
    };

    let Some(handler) = handler else {
        error!(job_type = %job.job_type, "No handler registered for job type");
        return;
    };

    // Mark as running
    let running = Job {
        status: JobStatus::Running,
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
            info!(job_type = %job.job_type, id = job.id, "Job completed");
        }
        Err(e) => {
            error!(error = %e, job_type = %job.job_type, id = job.id, "Job failed");
            // Delete failed jobs — there is no retry mechanism, so leaving
            // them in Firestore just leaks documents.
            if let Err(e) = db
                .fluent()
                .delete()
                .from(COLLECTION)
                .document_id(&job.id)
                .execute()
                .await
            {
                error!(error = %e, id = job.id, "Failed to delete failed job");
            }
        }
    }
}
