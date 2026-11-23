# Team Worker test deployment

Lily's Studio and its built-in sounds run as public Workers Static Assets. Open `/studio.html#manual` for Manual Compose. The Worker also implements the three same-origin generation requests made by Studio. Generating sample audio, speech or a backing song consumes ElevenLabs credits. A regular team member signs in with Cloudflare Access before using these controls. The existing `python3 local_server.py` workflow still uses the local proxy.

## Check a change locally

From the repository root with Node 24, npm, Python 3 and Git available, run:

```sh
npm ci
npm run test:worker
npm run build:assets
./node_modules/.bin/wrangler deploy --dry-run
./node_modules/.bin/wrangler dev --local
```

Open the local Studio at the URL Wrangler prints with `/studio.html#manual` appended. Use built-in audio for public smoke testing. The unit tests sign their own fixture tokens and mock the signing-key endpoint, rate limiter and provider. They exercise all three generation routes without credentials. A local configuration warning about the absent runtime key is expected. The asset builder recreates `.worker-assets/` with the five public pages, their scripts and styles, tracked media and credits. The Python server, workflow, tests and repository metadata stay outside this directory.

## Student setup after code review

1. Select a dedicated Cloudflare test account with a registered `workers.dev` subdomain. Reserve the Worker name `loudest-wer-worker` for this project and confirm rate-limit namespace ID `591301` is unused by unrelated Workers in that account. Change and review the manifest first if there is a collision. This workflow deploys to the named Worker's **active** workers.dev URL, with per-version preview URLs disabled. Lily's existing GitHub Pages preview has its own hosting.
2. In Zero Trust, configure a **self-hosted Access application** for `loudest-wer-worker.<account-subdomain>.workers.dev/api/*`. Use a dedicated application audience. Configure an Allow policy limited to the students' exact identities or managed team group and enable their identity provider. Keep the rest of the site public. Check for overlapping Access policies, including blanket Worker protection. Test an excluded identity before approving paid use. [Cloudflare Access for Workers](https://developers.cloudflare.com/workers/configuration/cloudflare-access/)
3. In GitHub, create the **loudest-wer-worker** Environment. Restrict deployment branches to protected `main`, enable required reviewers where available, and review changes to the workflow and its dependencies before merging. Configure the following values **on this Environment**.

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | Test account ID, 32 lowercase hexadecimal characters. |
| Variable | `ACCESS_TEAM_DOMAIN` | Bare Zero Trust team hostname such as `studio-team.cloudflareaccess.com`. |
| Variable | `ACCESS_AUD` | The protected application's 64-character lowercase hexadecimal audience tag. |
| Secret | `CLOUDFLARE_API_TOKEN` | Deploy credential scoped to the single test account. |
| Secret | `ELEVENLABS_API_KEY` | Dedicated test key, restricted to Sound Effects, Music and Text to Speech generation. Set a low credit quota and expiry where supported. |

The direct deploy uses the account permission **Workers Scripts Edit** (API name **Workers Scripts Write**) for script, runtime bindings and bundled assets. With an explicit account ID and an existing workers.dev subdomain, the workflow configures no zone routes, DNS, Access policies or external storage. The assets upload session requires account-level Workers Scripts Write. Treat this credential as able to modify other Workers in the selected account. The Worker name in the manifest is not a token restriction. A separate account provides isolation for this first deploy. [Assets upload permissions](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/assets/subresources/upload/methods/create/) · [Workers subdomain permissions](https://developers.cloudflare.com/api/resources/workers/subresources/subdomains/methods/get/) · [ElevenLabs key controls](https://elevenlabs.io/docs/overview/administration/workspaces/api-keys)

## Deploy and verify

After student review and merge, choose **Actions → Worker checks and manual deploy → Run workflow → main**. Opening a PR only runs checks. Check the selected commit before approving the protected deployment. The deploy step validates configuration, writes the runtime secret into a private temporary JSON file outside the assets directory, and passes it to pinned Wrangler with `deploy --secrets-file`. That command uploads code and the runtime secret together. The runner removes the file on exit. Only the final deploy step receives either secret. [Wrangler deploy options](https://developers.cloudflare.com/workers/wrangler/commands/workers/#deploy)

Record the commit SHA, Worker version ID and active URL. In Cloudflare settings, verify binding names and types: `ASSETS` static assets, `GENERATION_LIMITER` rate limiter, `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` text variables, and `ELEVENLABS_API_KEY` encrypted secret. Leave secret values hidden.

- In a signed-out window, open `/studio.html#manual`, play a starter pet and pitched instrument, save/reopen and export WAV. Requests for `/local_server.py` and `/worker/index.mjs` should return 404.
- Open `/api/generate-sample` in a new tab. Signed-out users should see Access sign-in, and an unapproved identity should be denied. After a permitted student signs in, GET returns 405 with `Allow: POST`. That verifies sign-in without generating audio. Return to Studio on the same origin. A signed-in malformed POST should return 400 and consume no generation quota.
- A valid paid request requires a separate student decision and budget. If approved, make one short request, play the result and inspect provider usage. Keep prompts, JWTs, provider headers and keys out of logs, screenshots and issues. Automated checks already exercise all three success paths and 429 using a mock.

The Worker verifies the team signature, issuer, audience, expiry and user claims, then checks bounded JSON and the limiter before sending a request to a fixed provider endpoint. It allows two requests per signed-in subject per 60 seconds across all three routes at each Cloudflare location. Cloudflare's limiter is approximate and local to each location. Use the provider's credit cap as the spend boundary. [Rate limiting behavior](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

## Stop or roll back

For an unexpected charge or access-policy error, disable the provider test key and block the Access application first. On a first deployment with no known-good version, disable the Worker's public route in Cloudflare until reviewed. For a later regression, use Workers & Pages → the named Worker → Deployments to roll back to a recorded good version. Verify the active version, binding names, public playback and Access denial again. Code rollback cannot reverse charges, restore external policy or provider credentials, or undo data saved in a user's browser. Reconcile the GitHub main branch before the next manual dispatch. [Workers rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/)
