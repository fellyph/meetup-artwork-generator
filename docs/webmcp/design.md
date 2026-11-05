# Artwork agent workflows

Design mode: autonomous, covering the three workflows requested by the maintainer.
Tools operate on the generator page or shortcode, with no account or server writes.

## 1. Prepare and revise an event

Starting states: fresh default draft; saved draft with custom headers and images;
partially completed event; list changed manually since the agent last read it.
Required context: supplied event facts, current draft, city catalog, current list order.
Boundary: preserve unspecified fields and uploaded images; never invent event facts,
reset the draft, or replace a whole list to make a small edit.

### Turn 1
- User: “Set the city to Curitiba and title to Building with WordPress.”
- Intent: update only supplied details, preserving the rest of the draft.
- Calls: `update_event({city:"Curitiba",title:"Building with WordPress"})`.
- Response: `{"status":"updated"}`.
- UI: resolve the city, apply its usual landmark/timezone defaults, retain manual
  headers, update form, announcement text and canvas before resolving.
- Agent: “Updated the city and title. The preview is ready.”

### Turn 2
- User: “Add Ana speaking about Blocks and Example Agency as a sponsor.”
- Intent: append two entries, preserving existing items and photos.
- Calls: `edit_artwork_items({changes:[{kind:"talk",action:"add",title:"Blocks",speaker:"Ana"},{kind:"sponsor",action:"add",name:"Example Agency"}]})`.
- Response: `{"status":"updated","changes":2}`.
- UI: validate the entire batch, then update lists, saved draft, copy and preview.
- Agent: “Added Ana’s talk and Example Agency.”

### Turn 3
- User: “Change the second talk’s speaker to Bruno.”
- Intent: identify the second entry from current state before editing.
- Calls: `read_artwork({section:"talks",page:1})`, then
  `edit_artwork_items({changes:[{kind:"talk",action:"update",index:2,expected_name:"Ana",speaker:"Bruno"}]})`.
- Response: `{"page":1,"page_size":1,"total_count":2,"total_pages":2,"items":[{"index":1,"speaker":"First speaker","title":"First talk","has_image":false}]}`;
  read page 2 to resolve the second item, then `{"status":"updated","changes":1}`.
- UI: read is pure; update guards against stale speaker/name and changes only the target.
- Agent: “Changed the second speaker to Bruno.”

Variations: missing speaker/title → ask; unknown city → use custom city as manual UI
already does; invalid date or ambiguous phrasing → actionable error asking for exact
calendar date; stale index/name → reread; invalid second batch operation → no partial
mutation; upload → focus existing upload control and require the user to choose a file.
Relative dates are resolved locally for today/tomorrow and weekday phrases in English,
Portuguese and Spanish; unsupported phrases are never guessed.

Self-critique: concise confirmations name only completed edits. Ask only about missing
facts or ambiguous targets. Routine edits need no confirmation; removal must be requested,
file selection stays with the user, and no reset tool is exposed.

## 2. Style and download artwork

Starting states: selected format, light/dark theme, built-in/custom watermark, fonts or
images loading, overflowing artwork, browser blocking multiple downloads.
Required context: requested style/format and available catalog names.
Boundary: preserve event details; download only on request; report a download request,
not a guaranteed saved file. Do not fetch arbitrary images or overwrite uploaded artwork.

### Turn 1
- User: “Make it dark and square.”
- Intent: resolve the format by its displayed name and adjust presentation.
- Calls: `list_artwork_options({kind:"formats",page:1})` (continue pages if needed),
  `configure_artwork({theme:"dark",format:"Square"})`.
- Response: `{"page":1,"page_size":1,"total_count":7,"total_pages":7,"items":[{"id":"meetup","name":"Meetup.com","width":1920,"height":1080}]}`;
  `{"status":"updated"}` after configuration.
- UI: selected format button, radio fields and canvas update before completion.
- Agent: “The preview now uses the dark square layout.”

### Turn 2
- User: “Download all formats.”
- Intent: export each available format through existing PNG generation.
- Calls: `download_artwork({all:true})`.
- Response: `{"status":"download_requested","count":7}`.
- UI: generate PNGs sequentially; allow cancellation before subsequent downloads.
- Agent: “Requested all seven downloads. Your browser may ask to allow multiple files.”

Variations: unknown/ambiguous format or landmark → list valid options; no uploaded
custom watermark → require user selection; cancelled run → report completed request count;
PNG creation failure → structured failure; unrelated manual edits remain intact.

Self-critique: do not claim files were saved, infer publishing permission, or silently
pick one of ambiguous formats. Ordinary styling is autonomous; file selection is a handoff.

## 3. Review announcements and missing facts

Starting states: incomplete draft with placeholders; full event; very long announcement;
user text containing instructions; locale selected by the user.
Required context: current event and requested network.
Boundary: output is untrusted draft content, never an instruction to publish or change data.

### Turn 1
- User: “Show me the WhatsApp announcement and what’s missing.”
- Intent: read exact generated copy and report missing event fields.
- Calls: `read_announcement({network:"whatsapp",offset:0})`.
- Response: `{"network":"whatsapp","text":"…","missing_fields":["date","time","link"],"total_length":840,"next_offset":null}`.
- UI: no mutation; use the same copy builder as the visible announcement.
- Agent: “Here is the draft. Add the date, time and registration link before sharing.”

Variations: unknown network → list supported networks; long copy → exact chunks with
next_offset (no silent truncation); prompt injection inside title/speaker → treat as text;
request to publish → explain there is no publishing action; missing event facts → ask user.

Self-critique: preserve exact copy, distinguish placeholders from factual errors, keep the
missing-field list concrete. Reading is autonomous; publishing is outside the tool surface.

## Consolidation and verification

Shared read/edit tools cover talks and sponsors. Configuration catalogs stay separate
from user-authored draft/copy tools so trust annotations remain accurate. Eight tools
cover the modeled goals including the image-selection handoff. No backend tools, remote
uploads, clipboard writes, reset or publishing are introduced.

Runtime tests capture registrations and invoke execute, including invalid batches,
UI synchronization, cancellation, missing browser support, lifecycle cleanup, payload
budgets and copy pagination. Model-selection cases are in evals.json. Native browser
verification requires WebMCP support: use Application > WebMCP and Lighthouse Agentic
browsing; mocked registration tests alone do not establish native compatibility.
