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

// Node can load a .json file directly with require() — it just becomes a
// regular JavaScript array. This is our fake "database" of orders.
const orders = require("./data/orders.json");

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
- If someone asks about the status of an order, use the lookup_order tool.
  Ask for an order ID or the name the order was placed under if you don't
  have one yet.
- If you don't know something specific about Widget Co, say so honestly
  instead of making it up.`;

// A "tool" is how we give Claude the ability to take an action beyond just
// generating text — here, looking something up in our order data. We
// describe the tool (name, what it does, what inputs it needs) and Claude
// decides on its own when a user's message calls for using it.
const tools = [
  {
    name: "lookup_order",
    description:
      "Look up a Widget Co order's status by its order ID (e.g. 'WC-1001') " +
      "or by the customer name it was placed under. Call this whenever a " +
      "user asks about their order status, shipping, or delivery.",
    input_schema: {
      type: "object",
      properties: {
        orderId: {
          type: "string",
          description: "The order ID, e.g. 'WC-1001'.",
        },
        customerName: {
          type: "string",
          description: "The customer's name the order was placed under.",
        },
      },
    },
  },
];

// This is the actual function that runs when Claude calls the lookup_order
// tool. It just searches our fake in-memory order list — in a real app this
// might be a database query instead.
function lookupOrder({ orderId, customerName }) {
  const match = orders.find((order) => {
    const idMatches = orderId && order.orderId.toLowerCase() === orderId.trim().toLowerCase();
    const nameMatches =
      customerName && order.customerName.toLowerCase().includes(customerName.trim().toLowerCase());
    return idMatches || nameMatches;
  });

  if (!match) {
    return { found: false, message: "No matching order was found." };
  }

  return { found: true, order: match };
}

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
    // The conversation Claude sees for this request. We'll add to this as
    // we go if Claude decides to use a tool.
    const messages = [{ role: "user", content: userMessage }];

    // Claude can only run ONE step at a time — either it replies with text,
    // or it asks to use a tool. When it uses a tool, we have to run the
    // tool ourselves, send the result back, and ask Claude to continue. So
    // this is a small loop: keep going until Claude gives a plain text
    // reply instead of a tool request. (In practice this loop runs once or
    // twice — a `for` loop with a max keeps us safe from ever looping forever.)
    let finalReply = "Sorry, I couldn't come up with a reply.";

    for (let step = 0; step < 5; step++) {
      const response = await anthropic.messages.create({
        model: "claude-opus-5",
        max_tokens: 1024,
        // Support replies don't need deep reasoning, so we keep effort low —
        // that means faster, cheaper responses for simple conversational Q&A.
        output_config: { effort: "low" },
        system: SYSTEM_PROMPT,
        tools,
        messages,
      });

      if (response.stop_reason !== "tool_use") {
        // Claude gave its final answer — grab the text and stop looping.
        const textBlock = response.content.find((block) => block.type === "text");
        finalReply = textBlock ? textBlock.text : finalReply;
        break;
      }

      // Claude wants to use one or more tools. Add its request to the
      // conversation, run each tool it asked for, and collect the results.
      messages.push({ role: "assistant", content: response.content });

      const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
      const toolResults = toolUseBlocks.map((toolUse) => {
        let result;
        if (toolUse.name === "lookup_order") {
          result = lookupOrder(toolUse.input);
        } else {
          result = { error: `Unknown tool: ${toolUse.name}` };
        }

        return {
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        };
      });

      // Tool results go back as a "user" turn, same as if the user had
      // supplied that information themselves.
      messages.push({ role: "user", content: toolResults });
    }

    res.json({ reply: finalReply });
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
