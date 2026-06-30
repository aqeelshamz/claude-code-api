import express from "express";
import cors from "cors";
import { execFile } from "child_process";

const app = express();
app.use(cors());
app.use(express.json());

// Run a question through the local `claude -p` CLI and return its response.
// Takes the same OpenRouter-style JSON: { model, messages: [{ role, content }] }
app.post("/claude", (req, res) => {
    const messages = req.body?.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Missing 'messages' in request body" });
    }

    const system = messages.filter(m => m.role === "system").map(m => m.content).join("\n\n");
    const prompt = messages.filter(m => m.role !== "system").map(m => m.content).join("\n\n");

    const args = ["-p", prompt];
    if (system) {
        args.push("--append-system-prompt", system);
    }

    execFile("claude", args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) {
            return res.status(500).json({ error: stderr || err.message });
        }
        res.json({ answer: stdout.trim() });
    });
});

// FIFO queues bridging the /ask request to the AI's poll/respond loop.
const pending = [];      // payloads not yet picked up by the AI (via GET /)
const awaiting = [];     // payloads picked up, waiting for the AI's answer (POST /)

// New single API: submit the OpenRouter request JSON, get the answer back in the SAME request.
app.post("/ask", (req, res) => {
    const payload = req.body;
    if (!payload?.messages) {
        return res.status(400).json({ error: "Missing 'messages' in request body" });
    }

    // Hold the response open until POST / delivers the answer.
    pending.push({ payload, resolve: (answer) => res.json({ answer }) });
});

// The AI polls this to get the next OpenRouter request payload.
app.get("/", (req, res) => {
    const item = pending.shift();
    if (!item) {
        return res.status(204).end(); // nothing to answer right now
    }

    awaiting.push(item); // now waiting for its answer via POST /

    res.type("application/json").send(JSON.stringify(item.payload));
});

// The AI submits its answer here; it resolves the oldest awaiting /ask request.
app.post("/", (req, res) => {
    const answer = req.body?.choices?.[0]?.message?.content;  // OpenRouter reply
    console.log(answer);

    const item = awaiting.shift();
    if (item) {
        item.resolve(answer);
    }

    res.send("Submitted");
});

app.listen(8080, () => console.log("Server started"));
