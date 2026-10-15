---
id: 11-filepond-avatar
title: FilePond avatar with validated encoded storage
criterion: A1
skill: yii2-filepond-uploads
docs:
  - extensions/filepond/configuration/index.md
  - extensions/filepond/uploads/index.md
  - extensions/filepond/reference/filepond/index.md
  - extensions/filepond/reference/validator/encodedfilevalidator/index.md
  - extensions/filepond/reference/file/encodedfile/index.md
  - extensions/filepond/reference/file/filesaver/index.md
outputs:
  - resources/views/site/_avatar.php
  - src/models/UploadForm.php
checks:
  - outputs
  - php-lint
  - strict-types
  - 'grep:EncodedFile'
  - 'grep:FileSaver'
  - app-boot
  - app-static
  - 'app-probe:filepond-widget:resources/views/site/_avatar.php'
  - 'app-probe:filepond-upload:app\models\UploadForm'
---

Work in an isolated workspace, not a complete Yii application. A separate checker will copy your two outputs into
a Yii 22.0 application with yii2-extensions/filepond installed. Create only the files requested below.

Write resources/views/site/\_avatar.php as a standalone avatar input named avatar. Accept JPEG, PNG and WebP up to
2 MB; open the editor immediately after selecting an image, keep a square crop and apply it on the client before
submitting the encoded upload. Use the package widget instead of hand-written input or script markup.

Write app\models\UploadForm in src/models/UploadForm.php with a public avatar attribute that accepts the submitted
encoded value. Require exactly one image, allow the same file extensions and real MIME types, and enforce the same
2 MB (2,000,000 bytes) limit on decoded bytes on the server. Client file names and reported types are untrusted;
reject malformed payloads, HTML or SVG renamed as allowed images, excess size and multiple files.

Provide public saveAvatar(string $directory): ?string. It validates the model first, returns null for invalid
input without writing any file, and otherwise uses the package decoder and saver to store the confirmed upload
with the base name avatar, returning the saved absolute path. The extension must follow the content detected from
decoded bytes, not the reported MIME type or a forged extension. The caller supplies a directory outside the web
root. Do not repeat server cropping because the client has already transformed the image.

Read .eval-docs/INDEX.md first, then only the local pages needed to confirm widget options, validation, decoding and
storage. Do not use external documentation or network access. When done, report the files written and the local
documentation pages read.
