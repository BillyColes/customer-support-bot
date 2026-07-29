// chat.js
// Frontend logic for the chat widget. This runs in the browser and talks
// to our Express server's /api/chat endpoint.

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatLog = document.getElementById("chat-log");

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
      body: JSON.stringify({ message: userMessage }),
    });

    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }

    const data = await response.json();
    addMessage(data.reply, "bot");
  } catch (error) {
    console.error("Chat request failed:", error);
    addMessage("Sorry, something went wrong. Please try again.", "bot");
  }
});
