// server.js
// This is our Express server. Express is a lightweight web framework for
// Node.js — it makes it easy to handle web requests (like "someone loaded
// the page" or "the chat widget sent a message") without writing raw
// low-level networking code.

// dotenv reads the .env file (which is gitignored, so secrets never get
// committed) and loads its values into process.env, so process.env.ANTHROPIC_API_KEY
// becomes available below.
require("dotenv").config();

const express = require("express");
const path = require("path");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = process.env.PORT || 3000;

// The Anthropic client reads ANTHROPIC_API_KEY from process.env automatically —
// we never write the key itself into our code.
const anthropic = new Anthropic();

// This tells Claude who it is and how to behave for every message. Since
// this is a fictional business, we invent a name and give Claude some
// ground rules so it stays "in character" as a support assistant.
const SYSTEM_PROMPT = `You are a friendly customer support assistant for
Widget Co, a small online store that sells (fictional) widgets and gadgets.

- Answer general questions about ordering, shipping, returns, and business hours.
- Keep answers short, warm, and to the point.
- You cannot look up a specific order's status yet — that feature is coming
  soon. If someone asks about their order status, let them know that's not
  available yet rather than guessing.
- If you don't know something specific about Widget Co, say so honestly
  instead of making it up.`;

// This middleware lets Express understand JSON in the body of incoming
// requests (e.g. { "message": "hello" }) and puts it on req.body for us.
app.use(express.json());

// This serves everything in the "public" folder as static files —
// so a request for "/" will return public/index.html, "/style.css"
// will return public/style.css, etc.
app.use(express.static(path.join(__dirname, "public")));

// This is the endpoint our chat widget calls whenever the "customer" sends
// a message. It forwards the message to Claude and sends back Claude's reply.
app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage || typeof userMessage !== "string") {
    return res.status(400).json({ error: "Missing 'message' in request body." });
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 1024,
      // Support replies don't need deep reasoning, so we keep effort low —
      // that means faster, cheaper responses for simple conversational Q&A.
      output_config: { effort: "low" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    // response.content is a list of blocks (text, tool calls, etc.) — for a
    // plain conversational reply we just want the text block.
    const textBlock = response.content.find((block) => block.type === "text");
    const reply = textBlock ? textBlock.text : "Sorry, I couldn't come up with a reply.";

    res.json({ reply });
  } catch (error) {
    console.error("Claude API error:", error);
    res.status(500).json({ error: "Something went wrong talking to the AI. Please try again." });
  }
});

// Only start listening for requests when this file is run directly with
// "node server.js". When Vercel imports this file to run it as a
// serverless function, it does the exporting/handling itself, so we don't
// want a second server trying to listen on a port in that case.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

module.exports = app;
