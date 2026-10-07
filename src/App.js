import React, { useEffect, useRef, useState } from "react";
import logo from "./logo.png";

const API_URL =
  process.env.REACT_APP_API_URL || "http://localhost:8080/api/items";

const emptyForm = {
  itemName: "",
  description: "",
  category: "",
  location: "",
  date: "",
  type: "LOST",
  status: "OPEN",
  contactInfo: "",
  image: "",
};

// Shrink a photo to max 800px and convert to JPEG so it stays small
const resizeImage = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const maxSize = 800;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.7));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });

// Read which page to show from the URL hash (#/history opens History)
const getPage = () =>
  window.location.hash === "#/history" ? "history" : "home";

function App() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [page, setPage] = useState(getPage());
  const [filter, setFilter] = useState("ALL");
  const fileInputRef = useRef(null);

  // Keep page in sync with the URL hash (back button, new tab, etc.)
  useEffect(() => {
    const onHashChange = () => setPage(getPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Get all items
  const loadItems = async () => {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }

      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
      // photos are only for FOUND items
      ...(name === "type" && value === "LOST" ? { image: "" } : {}),
    });
  };

  // Handle photo pick / camera capture
  const handleImage = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Please choose an image file.");
      e.target.value = "";
      return;
    }

    try {
      const resized = await resizeImage(file);
      setForm((prev) => ({ ...prev, image: resized }));
    } catch (error) {
      console.error(error);
      alert("Could not read that image.");
    }
  };

  const removeImage = () => {
    setForm({ ...form, image: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Add item
  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        throw new Error("Failed to add item");
      }

      alert("Item added successfully!");
      setForm(emptyForm);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadItems();
    } catch (error) {
      console.error(error);
      alert("Could not connect to the backend.");
    }
  };

  // Delete item
  const deleteItem = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete item");
      }

      loadItems();
    } catch (error) {
      console.error(error);
    }
  };

  // Claim item
  const claimItem = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}/claim`, {
        method: "PUT",
      });

      if (!response.ok) {
        throw new Error("Failed to claim item");
      }

      loadItems();
    } catch (error) {
      console.error(error);
    }
  };

  // Home shows only items that are still open
  const openItems = items.filter((item) => item.status !== "CLAIMED");

  // History shows every item, newest first, with a filter
  const historyItems = [...items]
    .sort((a, b) => b.id - a.id)
    .filter((item) => {
      if (filter === "ALL") return true;
      if (filter === "CLAIMED") return item.status === "CLAIMED";
      return item.type === filter;
    });

  const renderCard = (item, showClaim) => (
    <div key={item.id} style={styles.card}>
      <div style={styles.cardHeader}>
        <h3 style={styles.cardTitle}>{item.itemName}</h3>
        <span
          style={{
            ...styles.badge,
            background: item.status === "CLAIMED" ? "#2e7d32" : "#f2b84b",
            color: item.status === "CLAIMED" ? "white" : "#222",
          }}
        >
          {item.status}
        </span>
      </div>

      {item.image && (
        <img
          src={item.image}
          alt={item.itemName}
          style={styles.cardImage}
        />
      )}

      <p>
        <b>Description:</b> {item.description}
      </p>

      <p>
        <b>Category:</b> {item.category}
      </p>

      <p>
        <b>Location:</b> {item.location}
      </p>

      <p>
        <b>Date:</b> {item.date}
      </p>

      <p>
        <b>Type:</b> {item.type}
      </p>

      <p>
        <b>Contact:</b> {item.contactInfo}
      </p>

      {showClaim && (
        <button
          onClick={() => claimItem(item.id)}
          style={styles.claimButton}
          disabled={item.status === "CLAIMED"}
        >
          {item.status === "CLAIMED" ? "Claimed" : "Mark as Claimed"}
        </button>
      )}

      <button
        onClick={() => deleteItem(item.id)}
        style={styles.deleteButton}
      >
        Delete
      </button>
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Logo + title */}
      <div style={styles.brand}>
        <img src={logo} alt="University logo" style={styles.logo} />
        <h1 style={styles.title}>Lost & Found</h1>
      </div>

      <p style={styles.subtitle}>Report and find lost items easily</p>

      {/* Navigation */}
      <nav style={styles.nav}>
        <a
          href="#/"
          style={page === "home" ? styles.navActive : styles.navLink}
        >
          Home
        </a>
        <a
          href="#/history"
          style={page === "history" ? styles.navActive : styles.navLink}
        >
          History ({items.length})
        </a>
        <a
          href="#/history"
          target="_blank"
          rel="noreferrer"
          style={styles.navLink}
          title="Open History in a new tab"
        >
          Open History in new tab ↗
        </a>
      </nav>

      {page === "home" && (
        <>
          {/* Add Item Form */}
          <div style={styles.formBox}>
            <h2>Add Lost / Found Item</h2>

            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="text"
                name="itemName"
                placeholder="Item Name"
                value={form.itemName}
                onChange={handleChange}
                required
                style={styles.input}
              />

              <input
                type="text"
                name="description"
                placeholder="Description"
                value={form.description}
                onChange={handleChange}
                required
                style={styles.input}
              />

              <input
                type="text"
                name="category"
                placeholder="Category"
                value={form.category}
                onChange={handleChange}
                required
                style={styles.input}
              />

              <input
                type="text"
                name="location"
                placeholder="Location"
                value={form.location}
                onChange={handleChange}
                required
                style={styles.input}
              />

              <input
                type="date"
                name="date"
                value={form.date}
                onChange={handleChange}
                required
                style={styles.input}
              />

              <select
                name="type"
                value={form.type}
                onChange={handleChange}
                style={styles.input}
              >
                <option value="LOST">LOST</option>
                <option value="FOUND">FOUND</option>
              </select>

              {form.type === "FOUND" && (
                <div style={styles.photoBox}>
                  <label style={styles.photoLabel}>
                    📷 Add a photo of the found item (take a photo or choose one)
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImage}
                  />
                  {form.image && (
                    <div>
                      <img
                        src={form.image}
                        alt="Preview"
                        style={styles.preview}
                      />
                      <button
                        type="button"
                        onClick={removeImage}
                        style={styles.removePhoto}
                      >
                        Remove photo
                      </button>
                    </div>
                  )}
                </div>
              )}

              <input
                type="text"
                name="contactInfo"
                placeholder="Contact Information"
                value={form.contactInfo}
                onChange={handleChange}
                required
                style={styles.input}
              />

              <button type="submit" style={styles.addButton}>
                Add Item
              </button>
            </form>
          </div>

          {/* Open items */}
          <h2 style={styles.heading}>Open Items</h2>

          {openItems.length === 0 ? (
            <p>No open items. Claimed items are in History.</p>
          ) : (
            <div style={styles.items}>
              {openItems.map((item) => renderCard(item, true))}
            </div>
          )}
        </>
      )}

      {page === "history" && (
        <>
          <h2 style={styles.heading}>History</h2>

          {/* Filter */}
          <div style={styles.filters}>
            {["ALL", "LOST", "FOUND", "CLAIMED"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                style={filter === f ? styles.filterActive : styles.filterBtn}
              >
                {f}
              </button>
            ))}
          </div>

          {historyItems.length === 0 ? (
            <p>No history found.</p>
          ) : (
            <div style={styles.items}>
              {historyItems.map((item) => renderCard(item, false))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: "900px",
    margin: "0 auto",
    padding: "30px",
    fontFamily: "Arial, sans-serif",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "12px",
    marginBottom: "5px",
  },

  logo: {
    height: "56px",
    width: "auto",
    objectFit: "contain",
  },

  title: {
    margin: 0,
    textAlign: "center",
  },

  subtitle: {
    textAlign: "center",
    color: "#666",
    marginBottom: "20px",
  },

  nav: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "30px",
  },

  navLink: {
    padding: "8px 16px",
    border: "1px solid #1f3a5f",
    borderRadius: "20px",
    color: "#1f3a5f",
    textDecoration: "none",
    fontSize: "14px",
  },

  navActive: {
    padding: "8px 16px",
    border: "1px solid #1f3a5f",
    borderRadius: "20px",
    background: "#1f3a5f",
    color: "white",
    textDecoration: "none",
    fontSize: "14px",
  },

  formBox: {
    padding: "25px",
    border: "1px solid #ddd",
    borderRadius: "12px",
    marginBottom: "30px",
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  input: {
    padding: "12px",
    fontSize: "16px",
    border: "1px solid #ccc",
    borderRadius: "6px",
  },

  addButton: {
    padding: "12px",
    background: "#1f3a5f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
  },

  heading: {
    marginBottom: "15px",
  },

  photoBox: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    border: "1px dashed #1f3a5f",
    borderRadius: "6px",
  },

  photoLabel: {
    fontSize: "14px",
    color: "#1f3a5f",
  },

  preview: {
    display: "block",
    maxWidth: "100%",
    maxHeight: "200px",
    borderRadius: "8px",
    marginBottom: "8px",
  },

  removePhoto: {
    padding: "6px 12px",
    background: "#d9534f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  cardImage: {
    width: "100%",
    maxHeight: "200px",
    objectFit: "cover",
    borderRadius: "8px",
    margin: "10px 0",
  },

  filters: {
    display: "flex",
    gap: "8px",
    marginBottom: "20px",
    flexWrap: "wrap",
  },

  filterBtn: {
    padding: "8px 14px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    background: "white",
    cursor: "pointer",
  },

  filterActive: {
    padding: "8px 14px",
    border: "1px solid #1f3a5f",
    borderRadius: "6px",
    background: "#1f3a5f",
    color: "white",
    cursor: "pointer",
  },

  items: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: "20px",
  },

  card: {
    padding: "20px",
    border: "1px solid #ddd",
    borderRadius: "12px",
    background: "#fafafa",
  },

  cardHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
  },

  cardTitle: {
    margin: 0,
  },

  badge: {
    padding: "3px 10px",
    borderRadius: "12px",
    fontSize: "12px",
    fontWeight: "bold",
  },

  claimButton: {
    padding: "10px",
    marginRight: "8px",
    background: "#333",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  deleteButton: {
    padding: "10px",
    background: "#d9534f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },
};

export default App;