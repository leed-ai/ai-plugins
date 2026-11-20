# Feature images: the brief, the three paths, and `{ assetId, alt }`

A pillar post's feature image is the image at the top of the page, and the image a link to the page previews with: the site's `og:image` is the page's `featureImage`, so it is also each social cut's link preview. Approval checks it too, when the page's type requires one. This file has how campaign-schedule sets it.

## When a page gets one

- **Only when the page's own type requires it:** `requiredFields.featureImage` is true in `get_page_type` for the `pageTypeId` that `get_page` gives the page, as `SKILL.md`'s section 3 reads it, because approval checks the page against its own type. A page campaign-draft created is of the campaign's posts type, whose default requires one; a pillar retargeted on the Plan calendar can link a page of another type. A docs page (`documentation` or `api`) gets none: approval checks none of its fields.
- **Only for a ready pillar** (`SKILL.md`'s section 1) whose page has no `featureImage` yet. A page that has one keeps it, so a re-run sets no second image.
- **A kept image still gets the brief's alt text.** However the image got there (an earlier run, the editor, or a person before this run), when its `featureImage.alt` is not the brief's alt text, correct it as the editor path below does, with the page's own `assetId`, and list it in the preparation list. The editor stores the asset's name as the alt text, and that name can be empty. An image with no `assetId` cannot be written as `{ assetId, alt }`: list it, and the user picks the image again in the editor.
- **A PUBLISHED page** (a `republish` pillar's, say): any metadata write moves it to IN_REVISION, so the live page waits for its revision to be scheduled. Ask first, and leave it alone on a no.

## The brief

Campaign-draft wrote the image brief into the pillar's `detail`, as its `Feature image (campaign-draft)` block (`../campaign-draft/references/detail-format.md`):

- **`Shows:`** what the image shows. Tell the user, so they know which image to supply.
- **`Alt text:`** the alt text, sent as `alt` exactly as written. It is 1 to 300 characters.

A pillar whose `detail` has no such block, no `Alt text:` line, or alt text over 300 characters is listed with its reason, and `/leed:campaign-draft <id> <ref> edit` is named to fix it. Never write alt text of your own.

**The skill never makes an image.** The user supplies the file, picks one already in the asset manager, or generates one in the editor.

## Three paths, one write

Every path ends in the same write: `update_page_metadata` with `pageId` and `featureImage: { assetId, alt }`, the image holding exactly those two keys. The CMS fills `src`, `width`, `height` and `svg` from the image asset. **Never build `src` yourself**: it is a path on the image-delivery account, which only the CMS knows. A 400 naming `featureImage.assetId` means the id is not a live image in this company: find the asset again, and never retry the same id.

### With the CLI

Only when campaign-patterns' surface check finds the CLI signed in to this company, and the working directory is a checkout of its site. Upload the file the user names:

```bash
leed asset upload <file> --alt '<alt text>' --company <companyId> -e <environment> --json
```

- **The alt text goes in single quotes,** with each `'` in it written as `'\''`, and never in double quotes. It is text from the CMS, and inside single quotes the shell runs nothing: a `$`, a backtick or a `"` in it stays text.

- **The asset id** is the entry's `assetId` when its `status` is `uploaded`.
- **An exact duplicate** comes back `rejected-duplicate`: the image is already in the asset manager, as `duplicateOf.assetId`. Use that id; nothing new was uploaded.
- **Any other `status`,** such as `failed` with its `error`, gives no asset id to use: say so, and try the upload again or take the MCP-only path. A `featureImage` is written only with an id from an `uploaded` or `rejected-duplicate` entry.
- **`not_a_site_repo` or `not_authenticated`:** the upload runs only inside the site's checkout, with a signed-in session, and an API key cannot upload. Take the MCP-only path instead.

Then write `featureImage: { assetId, alt }` with that id and the brief's alt text.

### With MCP alone

1. Ask the user to upload the image under Assets in Leed, or to name one that is already there.
2. Find it with `list_assets`, passing `type: "image"` and its name as `q`.
3. Show the match: its `name`, its size as `originalWidth`×`originalHeight`, and its `src`. A row without a size shows none. With more than one match, show each and ask which. With none, say so, and ask again; a pillar left without its image is refused at its approval preview, with `missing_required_fields`, until a later run sets it.
4. Write `featureImage: { assetId, alt }`, with the match's `assetId` and the brief's alt text, only after a yes.

### Generated or picked in the editor

The user can generate or pick the image on the page itself: `<CMS origin>/pages/<pageId>`, page settings ▸ Feature Image. Then re-read the page with `get_page`. The editor stores the asset's name as the alt text, so when `featureImage.alt` is not the brief's alt text, send `featureImage: { assetId, alt }` with the `assetId` the page now holds and the brief's alt text. That corrects only the alt text, and keeps the image the user chose.

## Ruled out

- **`upload_company_image`:** it fills only the company's logo and favicon slots, never a page's feature image.
- **`ogCard`:** stays unset. The site falls back to the feature image, the title and the summary.
