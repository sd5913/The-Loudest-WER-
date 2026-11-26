# Public Studio Worker

The same Worker serves the Studio and its three public, same-origin audio generation routes. No Cloudflare Access login is needed. The local `python3 local_server.py` preview is unchanged.

## Before the first merge

1. Choose the Cloudflare account and register its `workers.dev` subdomain. The Worker is named `loudest-wer-worker`. Check that rate-limit namespace ID `591301` is not used by an unrelated Worker. If a previous test installed Cloudflare Access for the Worker or `/api/*`, an account admin must remove that policy in Cloudflare; this workflow does not modify Access.
2. Create the GitHub Environment **loudest-wer-worker**, allow deployments from **main** only, and do not add required deployment reviewers if the team wants deployment to continue automatically after merge.
3. Configure these environment entries:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account ID. |
| Secret | `CLOUDFLARE_API_TOKEN` | Token restricted to the target account with Workers Scripts Edit. |
| Secret | `ELEVENLABS_API_KEY` | Dedicated key scoped to the needed generation APIs, with a low credit quota before public use. |

No Zero Trust variables are needed. The ElevenLabs key is installed as a Worker secret, never served in frontend assets. The deploy token is account-scoped, not scoped to one Worker. [Cloudflare deploy options](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy) · [ElevenLabs API key controls](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys)

## Check and deploy

```sh
npm ci
npm run test:worker
npm run build:assets
./node_modules/.bin/wrangler deploy --dry-run
./node_modules/.bin/wrangler dev --local
```

PRs test with a mocked provider and build without secrets. Pushes to upstream `main`, including merges, deploy only after checks pass. If initial setup was incomplete, fix the environment and rerun the failed job. The public URL is in the deploy log. Open `/studio.html#manual` in a signed-out browser. Try built-in sounds first, then make one short generation request only after checking the key credit quota. A GET to `/api/generate-sample` returns 405, without spending credits.

Input validation, the fixed provider endpoints and the existing shared rate limiter remain. All three generation endpoints share an allowance of two requests per client IP per minute **at each Cloudflare location**; networks sharing an IP also share that allowance. Requests without a Cloudflare client IP share one fallback bucket. This is an approximate abuse control, not authentication or a global budget cap. Anyone can use the public API; same-origin checks do not stop scripted requests. Use the dedicated key’s credit quota as the spend boundary. [Cloudflare rate limit behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

For unexpected usage, revoke the provider key first. To restore an earlier Worker version, use Cloudflare’s [rollback controls](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/); reconcile the code on main so the next merge does not redeploy the unwanted version.
