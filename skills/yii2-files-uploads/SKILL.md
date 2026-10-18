---
name: yii2-files-uploads
description: Implement Yii 22.0 uploaded-file validation, storage, and download responses. Use for file lifecycle and path handling; not general asset bundle publication or server administration.
license: BSD-3-Clause
---

# Files, uploads, and downloads

Read [the bundled conventions](references/conventions.md) before applying this skill.

## Decisions that affect behavior

- UploadedFile retrieval follows the model/form attribute name; it does not validate
  or persist the upload. Keep form encoding, single/multiple input names, model
  attributes and validator cardinality consistent. PHP upload errors and empty
  optional input are different conditions.
  Assign the retrieved `UploadedFile` to the model attribute covered by the upload
  rules, then validate while the temporary file still exists. `getInstance()` does
  not assign that attribute, and validation deferred until after default `saveAs()`
  may lack the temporary bytes needed for MIME checks.
  Keep those bytes available through the last validation, including default
  ActiveRecord `save()` revalidation. Retaining the temporary file with
  `saveAs($destination, false)` can support that sequence. If persistence skips
  validation, first validate the complete state being saved, including its final
  metadata; validating only the upload attribute is insufficient.
- FileValidator checks configured size/extensions/MIME and defaults to checking
  extension consistency with detected MIME. Do not disable that check merely to
  accept a mislabeled fixture. Client-supplied names/types are untrusted; preserve
  the application's allowed types and independent image/content rules.
- An upload limit also depends on PHP/server limits. An empty body after an oversized
  request is not evidence the user submitted a valid empty form. Verify the actual
  request/validator failure path instead of only testing a constructed object.
- Choose destinations under the application's authorized storage root. Do not use
  a supplied filename as a trusted path; preserve naming/collision policy and
  access control. A normalized path is not by itself proof of containment or that
  symlinks cannot escape the root. Keep private uploads outside publicly executable
  locations according to the existing storage design.
- `saveAs()` can fail and its default consumes the temporary upload. Handle failure
  before recording successful persistence, and do not assume the same temporary
  file can be saved repeatedly. Replacement snippets must return, throw, or follow
  an existing failure branch before dereferencing a missing upload or saving failed
  storage metadata; a comment-only error branch does not stop execution.
  Keep cleanup consistent with database failures and
  the application's retention rules; avoid deleting unrelated files.
- Download access must be checked before sending a file. Preserve response headers,
  content disposition, streaming/range behavior, and supported server offload
  integration. Outputting diagnostics before a binary response can corrupt it.

## Observable acceptance

Use isolated temporary storage to verify a valid upload, relevant rejected type/
size/error cases, collision/path handling, and storage failure. Confirm the stored
bytes and metadata agree. Through the actual response path, verify authorized
file retrieval and denied access, plus headers/ranges if changed. Never overwrite
user files or exercise arbitrary filesystem paths as a generic check.

## Evidence routes

Read `framework/web/UploadedFile.php`, `framework/validators/{FileValidator,ImageValidator}.php`,
`framework/helpers/BaseFileHelper.php`, and `framework/web/Response.php`.
Tests: `tests/framework/web/UploadedFileTest.php`,
`tests/framework/validators/{FileValidatorTest,ImageValidatorTest}.php`,
`tests/framework/helpers/FileHelperTest.php`, and `tests/framework/web/ResponseTest.php`.
Guides: `input-file-upload`, `helper-overview`.
