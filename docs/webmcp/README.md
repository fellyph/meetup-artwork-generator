# Browser agent controls

The generator registers eight tools on `document.modelContext` when that API is
available. Everything runs in the current tab and uses the same state, canvas and
announcement builders as the manual UI. Browsers without WebMCP retain normal
manual controls. There is no backend MCP server or new external service.

| Tool | Purpose |
| --- | --- |
| `list_artwork_options` | Search/paginate cities, formats and landmarks |
| `read_artwork` | Read event fields, appearance, talks or sponsors |
| `update_event` | Patch supplied event facts, preserving other fields |
| `edit_artwork_items` | Atomically add, update, move or remove talks/sponsors |
| `configure_artwork` | Change theme, format, landmark or title weight |
| `download_artwork` | Request PNG downloads for selected or all formats |
| `read_announcement` | Read exact network copy and missing event facts |
| `initiate_image_selection` | Focus an upload button for user file selection |

## Behavior and boundaries

- Queries of draft or announcement text declare `untrustedContentHint`. Text in
  titles, speaker names and registration URLs is data, never agent instructions.
- Catalogs and draft lists return one item per page with counts. Oversized items
  return JSON text chunks with `encoding: "json"` and `next_offset`; concatenate
  the chunks and parse the JSON. Announcements return exact text chunks. Responses
  stay within 1,500 serialized characters, including escaped characters.
- List indices are one-based. Non-add operations require the current exact speaker
  or sponsor name, guarding against stale edits. Within a batch, indices refer to
  the list after preceding operations. The whole batch validates before committing.
- Event edits retain unspecified fields and images. Selecting a different city
  intentionally applies the same timezone, event-mode and landmark defaults as the
  manual city selector. Explicit fields in the same call override those defaults.
- Dates accept ISO dates, today/tomorrow and the next occurrence of named weekdays
  in English, Portuguese and Spanish. Relative dates use the browser's local
  calendar. Unsupported or ambiguous phrases return a request for an exact date;
  timezone abbreviations are display labels and never trigger time conversion.
- Mutations await form, announcement and canvas updates. A render failure reports
  `PREVIEW_FAILED` and explicitly says the draft has changed. Browser storage keeps
  the existing debounced save behavior and quota fallback.
- Tool calls serialize against other tool calls; manual controls remain available.
  Cancellation before a mutation prevents it; a committed draft edit is not rolled
  back on cancellation. Downloads check cancellation before each file is requested.
- Downloads report `download_requested`, never that the file was saved. Multiple
  downloads may need browser permission; failures report the completed request count.
- Image handoffs focus the existing control. Users select their files themselves.
  Watermark handoff switches to the custom watermark view and preserves the stored
  image. No agent-supplied filesystem paths or remote image URLs are accepted.
- Tools do not reset drafts, publish content or write to the clipboard. Removals and
  downloads should only be invoked for user requests. Tools remain same-origin;
  this plugin adds no cross-origin permissions. Registrations use AbortController
  cleanup on document exit and remain registered during back/forward cache suspension.

## Test and regenerate

No production dependency or build step is required. The schema is generated from
runtime definitions so it cannot silently drift:

```sh
node tools/webmcp-schema.cjs
node tools/webmcp-schema.cjs --check
node --test tools/webmcp.test.cjs
php -l meetup-artwork-generator.php
```

Browser integration requires PHP, Playwright and Chromium (install test dependencies
locally with `npm install --no-save --package-lock=false playwright` then
`npx playwright install chromium`). Tests render actual plugin markup and config
with test-only WordPress shims, use real renderer/copy scripts, and serve assets via
Playwright route interception. They do not test WordPress activation or hooks.

```sh
node tools/webmcp-browser.cjs
# Optional installed browser, e.g. macOS:
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node tools/webmcp-browser.cjs
# Use real WebMCP discovery/execution instead of captured registrations:
CHROME_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' WEBMCP_NATIVE=1 node tools/webmcp-browser.cjs
```

Native mode uses `getTools()` and `executeTool()` on a trustworthy localhost origin
with `--enable-features=WebMCP`. It fails if the API or eight registrations are absent.
Use a browser build supporting these APIs. The normal test mode captures registrations
and checks the same handlers; it does not prove native protocol compatibility alone.

## Conversational evaluations

`design.md` records starting states, role-plays, variations and self-critique for each
workflow. `evals.json` contains ten model-selection cases, including relative dates,
batches, upload handoff, coreference, pagination and recovery after stale edits.

Implementation and deterministic testing were selected for this PR. Model-based
evaluations were not run; they require a configured provider and can incur API usage:

```sh
npx webmcp-evals local -t docs/webmcp/schema.json -e docs/webmcp/evals.json
```

Set the evaluation runner's provider key in your local environment; never commit it.

## Native browser review

In Chrome with WebMCP enabled, open the generator and inspect **DevTools →
Application → WebMCP**. Execute tools using the Play control; check that state and
preview agree and review schema warnings. Check read-only/error cases as well as
edits. Run Lighthouse's **Agentic browsing** category when available. This PR's
native automated tests do not substitute for that pane/Lighthouse review.

`/llms.txt` and cross-origin embedding policy belong to the host WordPress site;
this plugin does not take over a site's root discovery or security configuration.

References: [WebMCP specification](https://webmachinelearning.github.io/webmcp/),
[Chrome imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api).
