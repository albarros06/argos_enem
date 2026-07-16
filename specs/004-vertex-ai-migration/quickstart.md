# Quickstart: Running Gemini Grading on Vertex AI

**Feature**: `004-vertex-ai-migration` | **Date**: 2026-07-16

How to configure and verify grading through Vertex AI. Targets an operator setting up a
deployment and a developer running locally.

## One-time Google Cloud setup (operator)

Using the **existing** OCR service account and its project:

1. Enable Vertex AI on the project:
   ```bash
   gcloud services enable aiplatform.googleapis.com --project <PROJECT_ID>
   ```
2. Grant the OCR service account permission to invoke Vertex AI:
   ```bash
   gcloud projects add-iam-policy-binding <PROJECT_ID> \
     --member="serviceAccount:<SA_EMAIL>" \
     --role="roles/aiplatform.user"
   ```
   `<SA_EMAIL>` is the `client_email` from `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
3. Confirm the grading model is served in `us-central1`. If it is not,
   choose an available model (`GRADING_MODEL_ID`) or override the region (`GOOGLE_CLOUD_LOCATION`).

Billing must be enabled on the project.

## Environment configuration

```bash
# Existing secret — reused for grading (single-line service-account JSON)
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account", ...}

# Vertex AI region (default shown; override only if needed)
GOOGLE_CLOUD_LOCATION=us-central1

# Optional: only if the Vertex project differs from the credential's project_id
# GOOGLE_CLOUD_PROJECT=

# Model — gemini-* routes through Vertex AI
GRADING_MODEL_ID=gemini-2.5-pro
```

**Removed**: `GEMINI_API_KEY` is no longer used. Delete it from your environment.

### Vercel

Set `GOOGLE_APPLICATION_CREDENTIALS_JSON` (already present) and `GOOGLE_CLOUD_LOCATION` in the
project's Environment Variables. Remove `GEMINI_API_KEY`. Redeploy.

## Local development (developer, no Google Cloud access)

No Vertex credentials required — use the deterministic fake provider:

```bash
FAKE_VENDORS=1
```

Grading returns a fixed evaluation with zero external calls. Alternatively, set
`GRADING_MODEL_ID=claude-sonnet-5` with `ANTHROPIC_API_KEY` to exercise the Claude path.

## Verify

1. **Tests** (offline, no cloud):
   ```bash
   npm test
   ```
   Expect env-config and grading tests to pass with no network calls.

2. **Real grading** (staging with credentials):
   - Submit an essay through the app.
   - Confirm it reaches `completed` status with five competency scores.
   - In Google Cloud → Vertex AI / billing, confirm the request appears under `<PROJECT_ID>`.

3. **Determinism**: grade the same essay + theme twice; scores must match (temperature 0).

## Rollback

Grading provider selection is config-driven. To revert to Claude without redeploying code, set
`GRADING_MODEL_ID=claude-sonnet-5` (requires `ANTHROPIC_API_KEY`). The Gemini-Developer-API path
is removed, so reverting to it would require restoring the previous code.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Error naming missing `GOOGLE_APPLICATION_CREDENTIALS_JSON` | Secret unset/blank | Set the service-account JSON. |
| `PERMISSION_DENIED` from Vertex | Missing `roles/aiplatform.user` | Grant the role (setup step 2). |
| Model-not-found / not available in region | Model absent in `us-central1` | Change `GRADING_MODEL_ID` or `GOOGLE_CLOUD_LOCATION`. |
| `aiplatform.googleapis.com` disabled | API not enabled | Run setup step 1. |
