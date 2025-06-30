(function () {
  "use strict";

  // Extract widget key from script URL
  const scriptTag =
    document.currentScript ||
    (function () {
      const scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  const scriptSrc = scriptTag.src;
  const widgetKeyMatch = scriptSrc.match(/\/widget\/([^\/]+)\/embed\.js/);

  if (!widgetKeyMatch) {
    console.error("AI-KMS Widget: Invalid embed script URL");
    return;
  }

  const widgetKey = widgetKeyMatch[1];
  const baseUrl = scriptSrc.replace(/\/widget\/.*$/, "");

  let isWidgetOpen = false;
  let sessionId = null;
  let widgetConfig = null;

  // Generate unique visitor ID
  function generateVisitorId() {
    return (
      "visitor_" +
      Math.random().toString(36).substr(2, 9) +
      Date.now().toString(36)
    );
  }

  // Create widget HTML
  function createWidget() {
    const widgetContainer = document.createElement("div");
    widgetContainer.id = "ai-kms-widget-container";
    widgetContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Chat button
    const chatButton = document.createElement("div");
    chatButton.id = "ai-kms-chat-button";
    chatButton.style.cssText = `
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: #2563eb;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      transition: all 0.3s ease;
    `;

    chatButton.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    `;

    // Chat window
    const chatWindow = document.createElement("div");
    chatWindow.id = "ai-kms-chat-window";
    chatWindow.style.cssText = `
      position: absolute;
      bottom: 70px;
      right: 0;
      width: 350px;
      height: 500px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
      display: none;
      flex-direction: column;
      overflow: hidden;
    `;

    // Chat header
    const chatHeader = document.createElement("div");
    chatHeader.style.cssText = `
      background: #2563eb;
      color: white;
      padding: 16px;
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    chatHeader.innerHTML = `
      <div>
        <div style="font-size: 16px;">AI Assistant</div>
        <div style="font-size: 12px; opacity: 0.8;">We're online</div>
      </div>
      <div id="ai-kms-close-btn" style="cursor: pointer; padding: 4px;">✕</div>
    `;

    // Chat messages
    const chatMessages = document.createElement("div");
    chatMessages.id = "ai-kms-chat-messages";
    chatMessages.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      background: #f9fafb;
    `;

    // Chat input
    const chatInput = document.createElement("div");
    chatInput.style.cssText = `
      padding: 16px;
      border-top: 1px solid #e5e7eb;
      background: white;
    `;

    chatInput.innerHTML = `
      <div style="display: flex; gap: 8px;">
        <input 
          type="text" 
          id="ai-kms-message-input" 
          placeholder="Type your message or Thai Citizen ID..."
          style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px; outline: none;"
        />
        <button 
          id="ai-kms-send-btn"
          style="padding: 8px 16px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer;"
        >
          Send
        </button>
      </div>
    `;

    // Assemble widget
    chatWindow.appendChild(chatHeader);
    chatWindow.appendChild(chatMessages);
    chatWindow.appendChild(chatInput);

    widgetContainer.appendChild(chatButton);
    widgetContainer.appendChild(chatWindow);

    document.body.appendChild(widgetContainer);

    // Event listeners
    chatButton.addEventListener("click", toggleChat);
    document
      .getElementById("ai-kms-close-btn")
      .addEventListener("click", toggleChat);
    document
      .getElementById("ai-kms-send-btn")
      .addEventListener("click", sendMessage);

    const messageInput = document.getElementById("ai-kms-message-input");
    messageInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        sendMessage();
      }
    });

    // Add welcome message
    addMessage(
      "assistant",
      "Hi! How can I help you today? You can also check employee status by providing a Thai Citizen ID (13 digits).",
    );
  }

  function toggleChat() {
    const chatWindow = document.getElementById("ai-kms-chat-window");
    isWidgetOpen = !isWidgetOpen;
    chatWindow.style.display = isWidgetOpen ? "flex" : "none";
  }

  function addMessage(role, content, isTyping = false) {
    const messagesContainer = document.getElementById("ai-kms-chat-messages");
    const messageDiv = document.createElement("div");

    messageDiv.style.cssText = `
      margin-bottom: 12px;
      display: flex;
      ${role === "user" ? "justify-content: flex-end;" : "justify-content: flex-start;"}
    `;

    const messageBubble = document.createElement("div");
    messageBubble.style.cssText = `
      max-width: 80%;
      padding: 8px 12px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.4;
      ${
        role === "user"
          ? "background: #2563eb; color: white; margin-left: auto;"
          : "background: white; color: #374151; border: 1px solid #e5e7eb;"
      }
    `;

    if (isTyping) {
      messageBubble.innerHTML = `
        <div style="display: flex; align-items: center; gap: 4px;">
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: pulse 1.4s ease-in-out infinite;"></div>
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: pulse 1.4s ease-in-out 0.2s infinite;"></div>
          <div style="width: 6px; height: 6px; border-radius: 50%; background: #9ca3af; animation: pulse 1.4s ease-in-out 0.4s infinite;"></div>
        </div>
      `;
    } else {
      messageBubble.textContent = content;
    }

    messageDiv.appendChild(messageBubble);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
  }

  async function sendMessage() {
    const messageInput = document.getElementById("ai-kms-message-input");
    const message = messageInput.value.trim();

    if (!message) return;

    // Add user message
    addMessage("user", message);
    messageInput.value = "";

    // Show typing indicator
    const typingDiv = addMessage("assistant", "", true);

    try {
      const response = await fetch(`${baseUrl}/api/widget/${widgetKey}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: sessionId,
          message: message,
          visitorInfo: {
            name: null,
            email: null,
            phone: null,
          },
        }),
      });

      const data = await response.json();

      // Remove typing indicator
      typingDiv.remove();

      if (response.ok) {
        sessionId = data.sessionId;
        const messageType = data.messageType;
        const reply = data.response?.trim();

        if (messageType && data.metadata?.found === true) {
          addMessage("assistant", reply);
        } else if (messageType && data.metadata?.found === false) {
          addMessage(
            "assistant",
            "Sorry, we couldn’t find any employee with that Citizen ID. Please double-check and try again.",
          );
        } else if (
          messageType === "text" &&
          reply ===
            "Hi! How can I help you today? You can also check employee status by providing a Thai Citizen ID (13 digits)."
        ) {
          addMessage(
            "assistant",
            "Sorry, we couldn’t find any employee with that Citizen ID. Please double-check and try again.",
          );
        } else {
          addMessage("assistant", reply || "Not Found");
        }
        // addMessage("assistant", data.response);
      } else {
        addMessage(
          "assistant",
          "Sorry, I encountered an error. Please try again.",
        );
      }
    } catch (error) {
      // Remove typing indicator
      typingDiv.remove();
      addMessage(
        "assistant",
        "Sorry, I'm having trouble connecting. Please try again later.",
      );
    }
  }

  // Initialize widget when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createWidget);
  } else {
    createWidget();
  }

  // Add CSS animation keyframes
  const style = document.createElement("style");
  style.textContent = `
    @keyframes pulse {
      0%, 80%, 100% { opacity: 0.4; }
      40% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
})();
