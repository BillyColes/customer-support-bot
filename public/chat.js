// chat.js
// Frontend logic for the chat widget. This runs in the browser and talks
// to our Express server's /api/chat endpoint.

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatLog = document.getElementById("chat-log");

// Our server doesn't remember past messages on its own (it runs as a
// stateless serverless function on Vercel), so the browser keeps track of
// the conversation and sends the whole thing along with each new message.
// Each entry looks like { role: "user" | "assistant", content: "..." }.
const conversationHistory = [];

// Adds a message bubble to the chat log. "sender" is either "user" or "bot".
function addMessage(text, sender) {
  const messageEl = document.createElement("div");
  messageEl.classList.add("message", sender);
  messageEl.textContent = text;
  chatLog.appendChild(messageEl);

  // Auto-scroll to the newest message.
  chatLog.scrollTop = chatLog.scrollHeight;
}

chatForm.addEventListener("submit", async (event) => {
  // Stop the browser from doing a full page reload on form submit.
  event.preventDefault();

  const userMessage = chatInput.value.trim();
  if (!userMessage) return;

  addMessage(userMessage, "user");
  chatInput.value = "";

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: userMessage, history: conversationHistory }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    addMessage(data.reply, "bot");

    // Now that this turn succeeded, remember both sides of it for next time.
    conversationHistory.push({ role: "user", content: userMessage });
    conversationHistory.push({ role: "assistant", content: data.reply });
  } catch (error) {
    console.error("Chat request failed:", error);
    addMessage("Sorry, something went wrong. Please try again.", "bot");
  }
});
