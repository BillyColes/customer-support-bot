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

// Static facts about the (fictional) store — business hours and return policy.
const storeInfo = require("./data/storeInfo.json");

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
- If someone asks about business hours or the return policy, use the
  get_store_info tool rather than guessing.
- If someone wants to return an order, find out which order it is (order ID
  or customer name) and ask why they're returning it, then use the
  start_return tool. Don't guess a reason on their behalf.
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
  {
    name: "get_store_info",
    description:
      "Get Widget Co's business hours or return policy. Call this whenever " +
      "a user asks when the store is open, or how returns/refunds work.",
    input_schema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          enum: ["business_hours", "return_policy"],
          description: "Which piece of store information to look up.",
        },
      },
      required: ["topic"],
    },
  },
  {
    name: "start_return",
    description:
      "Start a return for a Widget Co order. Requires the order (ID or " +
      "customer name) and a reason for the return. Call this once you know " +
      "which order the customer wants to return and why — don't guess the reason.",
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
        reason: {
          type: "string",
          enum: ["defective_or_damaged", "wrong_item", "no_longer_needed", "doesnt_fit", "other"],
          description: "The customer's reason for returning the item.",
        },
        reasonDetails: {
          type: "string",
          description: "Any extra detail the customer gave about the reason, especially if reason is 'other'.",
        },
      },
      required: ["reason"],
    },
  },
];

// Shared by lookup_order and start_return — finds an order by ID or by a
// (partial, case-insensitive) match on the customer name.
function findOrder({ orderId, customerName }) {
  return orders.find((order) => {
    const idMatches = orderId && order.orderId.toLowerCase() === orderId.trim().toLowerCase();
    const nameMatches =
      customerName && order.customerName.toLowerCase().includes(customerName.trim().toLowerCase());
    return idMatches || nameMatches;
  });
}

// This is the actual function that runs when Claude calls the lookup_order
// tool. It just searches our fake in-memory order list — in a real app this
// might be a database query instead.
function lookupOrder({ orderId, customerName }) {
  const match = findOrder({ orderId, customerName });

  if (!match) {
    return { found: false, message: "No matching order was found." };
  }

  return { found: true, order: match };
}

// Runs when Claude calls the start_return tool. Since this is a learning
// project with no real database, we don't actually persist the return
// anywhere — we just confirm the order exists and hand back a fake
// confirmation (including the reason) for Claude to relay to the customer.
function startReturn({ orderId, customerName, reason, reasonDetails }) {
  const match = findOrder({ orderId, customerName });

  if (!match) {
    return { started: false, message: "No matching order was found, so the return could not be started." };
  }

  // A fake return ID, just so the reply feels concrete — e.g. "WC-1001" -> "RET-1001".
  const returnId = `RET-${match.orderId.split("-").pop()}`;

  return {
    started: true,
    returnId,
    order: match,
    reason,
    reasonDetails: reasonDetails || null,
  };
}

// Runs when Claude calls the get_store_info tool — just returns the
// relevant slice of our static store info.
function getStoreInfo({ topic }) {
  if (topic === "business_hours") {
    return { topic, businessHours: storeInfo.businessHours };
  }
  if (topic === "return_policy") {
    return { topic, returnPolicy: storeInfo.returnPolicy };
  }
  return { error: `Unknown topic: ${topic}` };
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

  // The browser sends along the prior conversation so Claude has context
  // from earlier messages. We trust it's an array of { role, content }
  // objects, but fall back to an empty conversation if it's missing or malformed.
  const history = Array.isArray(req.body.history) ? req.body.history : [];

  try {
    // The conversation Claude sees for this request: everything said so
    // far, plus the new message. We'll add to this further if Claude
    // decides to use a tool.
    const messages = [...history, { role: "user", content: userMessage }];

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
        } else if (toolUse.name === "get_store_info") {
          result = getStoreInfo(toolUse.input);
        } else if (toolUse.name === "start_return") {
          result = startReturn(toolUse.input);
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
