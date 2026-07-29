# Customer Support System (Learning Project)

## Purpose
A fictional customer support automation system for a small business, built purely
for learning and experience with AI-assisted development. No real business, real
customers, or real data are involved — everything is fake/dummy data.

## Goal for this project
Build a web chat widget that a "customer" can type into, where the assistant can:
- Answer general support/FAQ-style questions
- Look up an order status (using fake/mock order data, not a real database at first)

This is a learning project, so prioritize clarity and simple, well-explained code
over cleverness or premature optimization.

## Stack
- Language: JavaScript (Node.js)
- Backend: Node.js (Express, unless we decide otherwise)
- Frontend: Simple web chat widget (plain HTML/CSS/JS to start — no framework yet)
- Data: Mock/fake order data stored in a local JSON file (no real database yet)
- AI: Anthropic Claude API for handling the conversational logic

## Project Conventions
- Keep code simple, readable, and well-commented — I'm learning as we go
- Before introducing a new concept, tool, or pattern, briefly explain what it is and why we're using it
- Prefer small, incremental steps over big changes all at once
- Use realistic-looking but clearly fake data (fake customer names, fake order IDs, etc.)
- Never use real personal data, even as an example
- Favor plain JavaScript/Node patterns over adding new dependencies unless there's a clear reason

## Project Structure (planned — update as it evolves)
```
customer-support-bot/
├── CLAUDE.md
├── server.js          # Express server, handles chat requests
├── data/
│   └── orders.json    # Fake order data (id, status, customer name, etc.)
├── public/
│   ├── index.html     # Chat widget UI
│   ├── style.css
│   └── chat.js         # Frontend logic for sending/receiving messages
└── package.json
```

## Core Features (in build order)
1. Basic Express server that can receive a chat message and return a reply
2. Simple chat widget UI (HTML/CSS/JS) that talks to the server
3. Connect the server to the Claude API so replies are AI-generated
4. Add an "order lookup" capability:
   - Mock order data in `data/orders.json`
   - A function the AI can call (or a simple keyword-based lookup to start)
     to find an order by ID or customer name and return its status
5. (Stretch goal) Add a couple more support "tools", e.g. return policy lookup,
   business hours, etc.

## Things to always double check
- Any code involving the Claude API should use current best practices — flag if
  something might be outdated
- Don't hardcode secrets/API keys in code — use environment variables (.env file)

## Current Status
Steps 1-4 done: Express server (`server.js`) serves the static chat widget
(`public/`), `/api/chat` calls the real Claude API, and Claude can look up
orders from `data/orders.json` via a `lookup_order` tool. Deployed on Vercel
with auto-deploy from GitHub. Next step (stretch goal): additional support
tools, e.g. return policy lookup, business hours.
