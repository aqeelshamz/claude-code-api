# Claude Code Wrapper API

A small Express server that exposes an HTTP API which forwards a prompt to the
local **Claude Code CLI** (`claude -p`) and returns the response as JSON.

It accepts an OpenRouter-style request body (`{ model, messages }`), so existing
clients built for that format work without changes.

## Prerequisites

- **Node.js 18+** (uses the built-in `child_process` / `fetch`)
- **Claude Code CLI** installed and authenticated

## 1. Set up the Claude Code CLI

Install the CLI:

```bash
npm install -g @anthropic-ai/claude-code
```

Authenticate (opens a browser to log in):

```bash
claude
```

Verify it works from the command line:

```bash
claude -p "Say hello in one word"
```

If that prints a response, the CLI is ready. The API uses whatever model and
account your `claude` CLI is configured with.

## 2. Run the project

Install dependencies and start the server:

```bash
npm install
npm start
```

The server listens on **http://localhost:8080** (`npm start` runs it with
`nodemon`, so it restarts on file changes).

## 3. Make a request

Send a `POST` to `/claude` with the OpenRouter-style JSON body:

```bash
curl -X POST http://localhost:8080/claude \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      { "role": "system", "content": "You are a helpful assistant." },
      { "role": "user", "content": "tell me about our solar system" }
    ]
  }'
```

Response:

```json
{ "answer": "The solar system consists of the Sun and everything bound to it..." }
```

### How the request maps to the CLI

| Request field            | How it's used                                   |
| ------------------------ | ----------------------------------------------- |
| `messages` (role `system`) | Joined and passed as `--append-system-prompt`   |
| `messages` (other roles)   | Joined and passed as the `claude -p` prompt     |
| `model`                  | Ignored — the CLI's configured model is used    |

## 4. Make the API public with ngrok

By default the server is only reachable on `localhost`. To expose it on a public
URL (e.g. so an external client or webhook can reach it), use
[ngrok](https://ngrok.com/).

Install ngrok:

```bash
# macOS (Homebrew)
brew install ngrok

# or download from https://ngrok.com/download
```

Add your auth token once (sign up at https://dashboard.ngrok.com to get it):

```bash
ngrok config add-authtoken <YOUR_TOKEN>
```

With the server running (`npm start`), start a tunnel to port 8080 in a second
terminal:

```bash
ngrok http 8080
```

ngrok prints a public **Forwarding** URL, for example:

```
Forwarding   https://1a2b-3c4d.ngrok-free.app -> http://localhost:8080
```

Use that URL in place of `http://localhost:8080`:

```bash
curl -X POST https://1a2b-3c4d.ngrok-free.app/claude \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai/gpt-4o",
    "messages": [
      { "role": "user", "content": "tell me about our solar system" }
    ]
  }'
```

> **Note:** The public URL forwards requests to your machine, where they run
> through your authenticated `claude` CLI. Anyone with the URL can use it, so
> keep it private or add authentication before sharing. The free ngrok URL
> changes each time you restart the tunnel.

## API

### `POST /claude`

- **Body:** `{ "model": string, "messages": [{ "role": string, "content": string }] }`
- **Success:** `200` → `{ "answer": string }`
- **Errors:**
  - `400` → `{ "error": "Missing 'messages' in request body" }`
  - `500` → `{ "error": "<CLI stderr or error message>" }`
