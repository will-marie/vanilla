# Frontend Polling Mismatch — Factual Analysis

**Date**: January 6, 2026 @ 11:20AM
**Branch**: `feat/adaptive-polling`

## Purpose

Collect confirmed facts about why the frontend showed a premature "eBook Generated Successfully" state and did not perform polling for completion.

### Summary

- Backend: `POST /api/ebook/generate` uses async acceptance and returns HTTP 202 (queued). See [server/index.js](server/index.js#L2995-L3025).
- Frontend: the ebook flow treats the immediate POST response as a completed result and sets `status: "success"` and `result` without polling. See [client/src/stores/ebookStore.js](client/src/stores/ebookStore.js#L116-L136) and [client/src/lib/ebookApi.js](client/src/lib/ebookApi.js#L1-L120).
- Smart polling exists and is implemented in the frontend, but it is wired to a different flow (`GenerateFlow.svelte`) and not used by the ebook path. See [client/src/lib/SmartPoller.js](client/src/lib/SmartPoller.js#L1) and [client/src/components/GenerateFlow.svelte](client/src/components/GenerateFlow.svelte#L214-L330).

### Confirmed facts (logs & code)

- Log shows Gemini returned 503 for the generation call:

  [GEMINI] callComplete model=gemini-2.5-pro callIndex=0 elapsed=6609ms status=503

  and the job later failed in the backend (`server/genieService.js` stack trace referenced in logs).

- After the failed call the server logged a quota release:

  [QUOTA] reservation released: { success: true, released: 3 }

- Server side acceptance behavior (excerpt): `POST /api/ebook/generate` returns 202 and a `resultId` immediately, then hands off to `genieService.process(...)` which completes later (success or error). See [server/index.js](server/index.js#L2995-L3130).

- Frontend ebook store behavior (excerpt): `ebookStore.generate()` calls `ebookApi.generateEbook()`, logs response fields, and then unconditionally updates the store with `result` and `status: "success"` on the POST response. See [client/src/stores/ebookStore.js](client/src/stores/ebookStore.js#L116-L136).

- UI behavior (excerpt): `App.svelte` shows the success panel and enables the Export button whenever `ebookResult` is present. See [client/src/App.svelte](client/src/App.svelte#L152-L176).

- SmartPoller presence and usage: `SmartPoller` exists and is used by the general generator flow in `GenerateFlow.svelte`, which polls `/api/status/:resultId` until `status === 'complete'`. See [client/src/lib/SmartPoller.js](client/src/lib/SmartPoller.js#L1) and [client/src/components/GenerateFlow.svelte](client/src/components/GenerateFlow.svelte#L214-L330).

### Direct, non-speculative conclusion

- The ebook frontend path does not implement polling for asynchronous completion; it consumes the 202 acceptance envelope as if it were the final result. This is the reason the UI displays success and enables export even when the backend later fails (e.g., Gemini 503). The SmartPoller code is not invoked for the ebook flow.

### Suggested minimal metadata for follow-up (what to capture next)

- Exact POST response body returned by `/api/ebook/generate` (envelope) when the UI shows success.
- Server-side logs for the `resultId` shown to the user (to correlate frontend acceptance with backend failures).
- A small trace of the frontend network call that showed 202 (headers + body) and the subsequent `/api/status/:resultId` behavior (if any).

File created for operational/engineering review. No code changes in this document.
