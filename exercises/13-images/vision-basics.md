# Vision: image message structure & limits

## Sending an image

An image is a content block sitting alongside text blocks in a user message,
same shape as a `tool_result` or `document` block:

```js
{
  role: 'user',
  content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64String } },
    { type: 'text', text: 'What do you see in this image?' },
  ],
}
```

Claude's reply comes back as an ordinary `text` block — the rest of the
request/response flow (multi-turn history, system prompts, tools) is
unchanged from text-only messages.

## Source types

- `{ type: 'base64', media_type, data }` — read the file, base64-encode it,
  send the bytes inline. `media_type` must match the actual format
  (`image/jpeg`, `image/png`, `image/gif`, `image/webp`).
- `{ type: 'url', url }` — Claude fetches the image itself. No local file, no
  encoding step.

## Limits

- Up to **100 images** per request, across all messages.
- **5MB max** per image.
- **8000px** max width/height when sending a single image; **2000px** max
  when sending multiple images in the same request (they get downscaled
  further to fit together).
- Token cost per image ≈ `(width_px × height_px) / 750` — a large image is
  not free just because it's "one attachment."

## Multiple images

Multiple `image` blocks can sit in the same message. Claude sees them in the
order they appear, so if the prompt needs to refer to "the second image,"
put the text block after the images, not before.
