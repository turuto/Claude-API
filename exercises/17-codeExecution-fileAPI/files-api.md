# Files API

An alternative to inlining base64 data (as in 13-images and 14-pdf): upload a file once via
a dedicated endpoint, get back a file ID, then reference that ID from any later message
instead of resending the raw bytes.

## Why bother, if base64 already works

- **Reuse.** The same file ID can be referenced across many separate requests — no
  re-uploading or re-encoding.
- **Large files.** Base64-encoding a big file inline bloats the request body; uploading once
  and referencing an ID doesn't.
- **The only way in/out of a code execution container.** Containers have no network access
  (see `code-execution.md`), so file upload/download is the sole data bridge in both
  directions.

## Still beta

Unlike code execution itself (GA on the SDK version this project pins), file upload/download
lives under `client.beta.files` and needs the `files-api-2025-04-14` beta flag on every
call — `upload`, `download`, and `retrieveMetadata` all take a `betas: [...]` option:

```js
const fileMetadata = await client.beta.files.upload({
    file: fs.createReadStream(csvPath),
    betas: ['files-api-2025-04-14'],
});
```

`fileMetadata.id` is what gets referenced afterward (e.g. `file_01AbC...`).

## Referencing an uploaded file

For code execution, wrap the file ID in a `container_upload` content block, alongside
whatever text tells Claude what to do with it:

```js
{
    role: 'user',
    content: [
        { type: 'text', text: 'Analyze this data...' },
        { type: 'container_upload', file_id: fileMetadata.id },
    ],
}
```

`container_upload` itself is a regular (non-beta) content block type — only the upload/
download *endpoints* are beta, not every block that references a file ID. (Referencing a
file as a `document` or `image` source, outside code execution, uses a different block shape
— `{type: 'document', source: {type: 'file', file_id: ...}}` — not covered by this exercise.)

## Downloading files Claude generates

Code execution can write new files (a plot, a processed dataset) into the container. Those
come back in the response as **file IDs**, not raw bytes — download them the same way:

```js
const downloaded = await client.beta.files.download(fileId, { betas: ['files-api-2025-04-14'] });
const bytes = Buffer.from(await downloaded.arrayBuffer());
```

`download` returns a standard `Response` object — `.arrayBuffer()` (or `.blob()`) gets the
actual bytes.

## Security note

A filename that comes back from `retrieveMetadata` is still untrusted input — nothing stops
a crafted response from naming a file `../../../etc/passwd`. Always run it through
`path.basename(...)` before joining it onto an output directory, so it can't escape via `..`
or an absolute path. See `index.js` for where this is applied.
