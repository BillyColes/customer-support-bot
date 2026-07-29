// server.js
// This is our Express server. Express is a lightweight web framework for
// Node.js — it makes it easy to handle web requests (like "someone loaded
// the page" or "the chat widget sent a message") without writing raw
// low-level networking code.

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// This middleware lets Express understand JSON in the body of incoming
// requests (e.g. { "message": "hello" }) and puts it on req.body for us.
app.use(express.json());

// This serves everything in the "public" folder as static files —
// so a request for "/" will return public/index.html, "/style.css"
// will return public/style.css, etc.
app.use(express.static(path.join(__dirname, "public")));

// This is the endpoint our chat widget will call whenever the "customer"
// sends a message. For now it just echoes the message back with a canned
// reply — we'll swap this out for a real Claude API call in the next step.
app.post("/api/chat", (req, res) => {
  const userMessage = req.body.message;

  if (!userMessage || typeof userMessage !== "string") {
    return res.status(400).json({ error: "Missing 'message' in request body." });
  }

  const reply = `You said: "${userMessage}". (Real AI replies are coming in the next step!)`;

  res.json({ reply });
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
