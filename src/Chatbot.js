import React, { useEffect, useRef, useState } from "react";

// Each entry: words to look for in the user's message + the reply
const FAQ = [
  {
    keywords: ["hi", "hello", "hey", "help"],
    answer:
      "Hi! 👋 I can help you use the Lost & Found portal. Ask me how to report a lost item, report a found item, add a photo, claim an item or use History.",
  },
  {
    keywords: ["lost", "lose", "missing", "report lost", "misplaced"],
    answer:
      "To report a lost item: on the Home page, fill in the form, choose LOST in the type dropdown, add the item details and your contact information, then click Add Item. You can also add a photo if you have one.",
  },
  {
    keywords: ["found", "picked", "got an item", "report found"],
    answer:
      "To report a found item: on the Home page, choose FOUND in the type dropdown, fill in the details, add a photo of the item and your contact information, then click Add Item. The owner will be able to contact you.",
  },
  {
    keywords: ["photo", "picture", "image", "camera", "gallery", "upload"],
    answer:
      "In the form, use 📷 Take a photo to open your camera, or 🖼️ Choose from gallery to pick an existing picture. You will see a preview, and you can click Remove photo to change it. Photos work for both lost and found items.",
  },
  {
    keywords: ["claim", "claimed", "owner", "mine", "collect", "returned"],
    answer:
      "Only the admin can mark an item as claimed. When the owner collects the item, the admin logs in (🔒 Admin Login) and clicks Mark as Claimed on its card. The item then moves to History with a CLAIMED badge.",
  },
  {
    keywords: ["history", "old", "past", "claimed items", "previous"],
    answer:
      "Click History in the menu at the top. It shows every item that was reported, newest first. Use the ALL, LOST, FOUND and CLAIMED buttons to filter them.",
  },
  {
    keywords: ["delete", "remove", "cancel"],
    answer:
      "Only the admin can delete items. If you added something by mistake, ask the admin to remove it. The admin is asked \"Are you sure?\" before an item is deleted.",
  },
  {
    keywords: ["edit", "change", "update", "wrong", "mistake", "typo", "correct"],
    answer:
      "Only the admin can edit items. The admin clicks Edit on the card, changes the details in the form at the top and clicks Save Changes. If you made a mistake, ask the admin to fix it.",
  },
  {
    keywords: ["match", "similar", "suggest", "same item"],
    answer:
      "When you add an item, the portal checks for LOST and FOUND items with the same category or location and shows them as possible matches. Cards with matches also show a 🔍 possible match button.",
  },
  {
    keywords: ["contact", "phone", "email", "reach", "call"],
    answer:
      "Every item card shows contact information. If you see your lost item, use the contact details on its card to reach the person who reported it.",
  },
  {
    keywords: ["search", "look for", "see my item", "check", "is my"],
    answer:
      "Scroll down on the Home page to see all open items, or open History to see everything and filter by LOST or FOUND. Check the item details and photo to see if it is yours.",
  },
  {
    keywords: ["admin", "login", "log in", "password", "staff"],
    answer:
      "Everyone can report items and search them. The admin (🔒 Admin Login in the menu) is the only one who can mark items as claimed, edit them or delete them.",
  },
  {
    keywords: ["thanks", "thank you", "thx", "bye"],
    answer: "You're welcome! Let me know if you need anything else. 😊",
  },
];

const FALLBACK =
  "Sorry, I didn't understand that. I can help with reporting lost or found items, adding photos, claiming items, deleting items and using History. Try one of the buttons below.";

const QUICK_QUESTIONS = [
  "How do I report a lost item?",
  "How do I report a found item?",
  "How do I add a photo?",
  "How do I claim an item?",
  "Where is History?",
];

const getAnswer = (text) => {
  const message = text.toLowerCase();
  let best = null;
  let bestScore = 0;

  FAQ.forEach((entry) => {
    const score = entry.keywords.filter((k) => {
      // short words like "hi" must match as whole words
      if (k.length <= 3) {
        return new RegExp(`\\b${k}\\b`).test(message);
      }
      return message.includes(k);
    }).length;

    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  });

  return best ? best.answer : FALLBACK;
};

function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      from: "bot",
      text: "Hi! 👋 I'm the AU Lost & Found helper. How can I help you?",
    },
  ]);
  const bottomRef = useRef(null);

  // Scroll to the newest message
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open]);

  const send = (text) => {
    const clean = text.trim();
    if (!clean) return;

    setMessages((prev) => [
      ...prev,
      { from: "user", text: clean },
      { from: "bot", text: getAnswer(clean) },
    ]);
    setInput("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  return (
    <>
      {open && (
        <div style={styles.window}>
          <div style={styles.header}>
            <span>AU Help Assistant</span>
            <button
              onClick={() => setOpen(false)}
              style={styles.close}
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          <div style={styles.body}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={m.from === "user" ? styles.userMsg : styles.botMsg}
              >
                {m.text}
              </div>
            ))}

            <div style={styles.quickBox}>
              {QUICK_QUESTIONS.map((q) => (
                <button key={q} onClick={() => send(q)} style={styles.quick}>
                  {q}
                </button>
              ))}
            </div>

            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSubmit} style={styles.inputRow}>
            <input
              type="text"
              placeholder="Type your question..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={styles.input}
            />
            <button type="submit" style={styles.send}>
              Send
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        style={styles.bubble}
        aria-label={open ? "Close AU help chat" : "Open AU help chat"}
        title="AU Help"
      >
        {open ? (
          <span>✕ Close</span>
        ) : (
          <>
            <span style={styles.badge}>AU</span>
            <span>💬 Chat with us</span>
          </>
        )}
      </button>
    </>
  );
}

const styles = {
  bubble: {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 18px 10px 10px",
    borderRadius: "30px",
    background: "#c8102e",
    color: "white",
    fontSize: "15px",
    fontWeight: "bold",
    fontFamily: "Arial, sans-serif",
    cursor: "pointer",
    border: "2px solid white",
    boxShadow: "0 4px 14px rgba(200,16,46,0.55)",
    zIndex: 1000,
  },

  badge: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    background: "white",
    color: "#c8102e",
    fontSize: "14px",
    fontWeight: "bold",
  },

  window: {
    position: "fixed",
    bottom: "88px",
    right: "20px",
    width: "320px",
    maxWidth: "calc(100vw - 40px)",
    height: "440px",
    maxHeight: "calc(100vh - 120px)",
    display: "flex",
    flexDirection: "column",
    background: "white",
    border: "1px solid #ddd",
    borderRadius: "12px",
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    overflow: "hidden",
    zIndex: 1000,
    fontFamily: "Arial, sans-serif",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 14px",
    background: "#c8102e",
    color: "white",
    fontWeight: "bold",
  },

  close: {
    background: "none",
    border: "none",
    color: "white",
    fontSize: "16px",
    cursor: "pointer",
  },

  body: {
    flex: 1,
    padding: "12px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "#fff5f6",
  },

  botMsg: {
    alignSelf: "flex-start",
    maxWidth: "85%",
    padding: "8px 12px",
    background: "white",
    border: "1px solid #f3c9cf",
    borderRadius: "12px 12px 12px 2px",
    fontSize: "14px",
    lineHeight: "1.4",
  },

  userMsg: {
    alignSelf: "flex-end",
    maxWidth: "85%",
    padding: "8px 12px",
    background: "#c8102e",
    color: "white",
    borderRadius: "12px 12px 2px 12px",
    fontSize: "14px",
    lineHeight: "1.4",
  },

  quickBox: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "4px",
  },

  quick: {
    padding: "6px 10px",
    border: "1px solid #c8102e",
    borderRadius: "14px",
    background: "white",
    color: "#c8102e",
    fontSize: "12px",
    cursor: "pointer",
  },

  inputRow: {
    display: "flex",
    gap: "6px",
    padding: "10px",
    borderTop: "1px solid #ddd",
    background: "white",
  },

  input: {
    flex: 1,
    padding: "8px 10px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    fontSize: "14px",
  },

  send: {
    padding: "8px 14px",
    border: "none",
    borderRadius: "6px",
    background: "#c8102e",
    color: "white",
    cursor: "pointer",
  },
};

export default Chatbot;