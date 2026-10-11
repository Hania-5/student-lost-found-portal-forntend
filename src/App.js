import React, { useEffect, useRef, useState } from "react";
import logo from "./logo.png";
import Chatbot from "./Chatbot";


const API_URL =
  process.env.REACT_APP_API_URL ||
  "https://student-lost-and-found-portal-backend-production.up.railway.app/api/items";

// Admin endpoints live next to the items endpoints (/api/admin)
const ADMIN_URL = API_URL.replace(/\/items$/, "/admin");

// Fixed lists for the dropdowns. Edit these to match your campus.
const CATEGORIES = [
  "Electronics",
  "ID Card",
  "Books",
  "Keys",
  "Wallet / Purse",
  "Bag",
  "Clothing",
  "Accessories",
  "Documents",
  "Other",
];

const LOCATIONS = [
  "Library",
  "Canteen",
  "Classroom Block",
  "Laboratory",
  "Auditorium",
  "Hostel",
  "Sports Ground",
  "Parking",
  "Bus Stop",
  "Main Gate",
  "Other",
];

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

const norm = (value) => (value || "").toString().trim().toLowerCase();

// Does the item contain the search text anywhere useful?
const matchesSearch = (item, text) => {
  const t = norm(text);
  if (!t) return true;

  return [
    item.itemName,
    item.description,
    item.category,
    item.location,
    item.type,
    item.status,
  ]
    .join(" ")
    .toLowerCase()
    .includes(t);
};

// Auto-match: a LOST item is matched with open FOUND items, and the other way
// round, when they share the same category or location.
const getMatches = (item, all) => {
  if (!item || item.status === "CLAIMED") return [];

  const opposite = item.type === "LOST" ? "FOUND" : "LOST";
  const words = norm(item.itemName)
    .split(/\s+/)
    .filter((w) => w.length > 2);

  return all
    .filter(
      (o) => o.id !== item.id && o.type === opposite && o.status !== "CLAIMED"
    )
    .map((o) => {
      const reasons = [];
      let score = 0;

      if (norm(o.category) && norm(o.category) === norm(item.category)) {
        reasons.push("Same category");
        score += 2;
      }
      if (norm(o.location) && norm(o.location) === norm(item.location)) {
        reasons.push("Same location");
        score += 1;
      }
      if (score > 0 && words.some((w) => norm(o.itemName).includes(w))) {
        reasons.push("Similar name");
        score += 2;
      }

      return { item: o, reasons, score };
    })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score || b.item.id - a.item.id);
};

function App() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [page, setPage] = useState(getPage());

  // History page controls
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");

  // Home page controls
  const [homeSearch, setHomeSearch] = useState("");
  const [sort, setSort] = useState("NEWEST");

  // Popups
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [matchView, setMatchView] = useState(null);

  // Admin login
  const [adminToken, setAdminToken] = useState(() => {
    try {
      return sessionStorage.getItem("adminToken") || "";
    } catch (e) {
      return "";
    }
  });
  const [showLogin, setShowLogin] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const isAdmin = adminToken !== "";

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);
  const formRef = useRef(null);

  // Keep page in sync with the URL hash (back button, etc.)
  useEffect(() => {
    const onHashChange = () => setPage(getPage());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // ----- Admin login -----

  const authHeaders = () => ({ Authorization: `Bearer ${adminToken}` });

  const saveToken = (token) => {
    setAdminToken(token);
    try {
      if (token) sessionStorage.setItem("adminToken", token);
      else sessionStorage.removeItem("adminToken");
    } catch (e) {
      // storage not available - the login just won't survive a refresh
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");

    try {
      const response = await fetch(`${ADMIN_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginForm),
      });

      if (response.status === 401) {
        setLoginError("Wrong username or password.");
        return;
      }

      if (!response.ok) {
        setLoginError("Admin login is not available right now.");
        return;
      }

      const data = await response.json();
      saveToken(data.token);
      setLoginForm({ username: "", password: "" });
      setShowLogin(false);
    } catch (error) {
      console.error(error);
      setLoginError("Could not connect to the backend.");
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${ADMIN_URL}/logout`, {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error(error);
    }
    saveToken("");
    setEditingId(null);
    setForm(emptyForm);
  };

  // The server said 401: the admin session ended
  const handleUnauthorized = () => {
    saveToken("");
    setDeleteTarget(null);
    setEditingId(null);
    setForm(emptyForm);
    setLoginError("Your admin session ended. Please log in again.");
    setShowLogin(true);
  };

  // Get all items
  const loadItems = async () => {
    try {
      const response = await fetch(API_URL);

      if (!response.ok) {
        throw new Error("Failed to fetch items");
      }

      const data = await response.json();
      setItems(data);
      return data;
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
  };

  const resetFileInputs = () => {
    if (cameraInputRef.current) cameraInputRef.current.value = "";
    if (galleryInputRef.current) galleryInputRef.current.value = "";
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
    resetFileInputs();
  };

  // Start editing an existing item (loads it into the form)
  const startEdit = (item) => {
    setForm({
      itemName: item.itemName || "",
      description: item.description || "",
      category: item.category || "",
      location: item.location || "",
      date: item.date || "",
      type: item.type || "LOST",
      status: item.status || "OPEN",
      contactInfo: item.contactInfo || "",
      image: item.image || "",
    });
    setEditingId(item.id);
    resetFileInputs();

    if (window.location.hash !== "#/") {
      window.location.hash = "#/";
    }

    setTimeout(() => {
      if (formRef.current) {
        formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    resetFileInputs();
  };

  // Add or update item
  const handleSubmit = async (e) => {
    e.preventDefault();

    const isEditing = editingId !== null;

    try {
      const response = await fetch(
        isEditing ? `${API_URL}/${editingId}` : API_URL,
        {
          method: isEditing ? "PUT" : "POST",
          headers: isEditing
            ? { "Content-Type": "application/json", ...authHeaders() }
            : { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to save item");
      }

      const saved = await response.json();

      setForm(emptyForm);
      setEditingId(null);
      resetFileInputs();

      const data = await loadItems();

      if (isEditing) {
        alert("Item updated successfully!");
        return;
      }

      // After adding, show possible matches if there are any
      if (saved && getMatches(saved, data).length > 0) {
        setMatchView({ item: saved, justAdded: true });
      } else {
        alert("Item added successfully!");
      }
    } catch (error) {
      console.error(error);
      alert("Could not connect to the backend.");
    }
  };

  // Delete item (after the person confirms)
  const deleteItem = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (response.status === 401) {
        handleUnauthorized();
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to delete item");
      }

      if (editingId === id) cancelEdit();
      setDeleteTarget(null);
      loadItems();
    } catch (error) {
      console.error(error);
      alert("Could not delete the item.");
    }
  };

  // Claim item
  const claimItem = async (id) => {
    try {
      const response = await fetch(`${API_URL}/${id}/claim`, {
        method: "PUT",
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to claim item");
      }

      loadItems();
    } catch (error) {
      console.error(error);
      alert(error.message || "Could not claim the item.");
    }
  };

  // ----- Data for the screens -----

  const stats = {
    total: items.length,
    lost: items.filter((i) => i.type === "LOST").length,
    found: items.filter((i) => i.type === "FOUND").length,
    claimed: items.filter((i) => i.status === "CLAIMED").length,
  };

  // Home: open items, searched and sorted
  const openItems = items
    .filter((item) => item.status !== "CLAIMED")
    .filter((item) => matchesSearch(item, homeSearch))
    .sort((a, b) => (sort === "NEWEST" ? b.id - a.id : a.id - b.id));

  const totalOpen = items.filter((item) => item.status !== "CLAIMED").length;

  // History: every item, newest first, with filter + search
  const historyItems = [...items]
    .sort((a, b) => b.id - a.id)
    .filter((item) => {
      if (filter === "ALL") return true;
      if (filter === "CLAIMED") return item.status === "CLAIMED";
      return item.type === filter;
    })
    .filter((item) => matchesSearch(item, search));

  const matchList = matchView ? getMatches(matchView.item, items) : [];

  // Keep an old free-text value selectable when editing
  const categoryOptions =
    form.category && !CATEGORIES.includes(form.category)
      ? [...CATEGORIES, form.category]
      : CATEGORIES;
  const locationOptions =
    form.location && !LOCATIONS.includes(form.location)
      ? [...LOCATIONS, form.location]
      : LOCATIONS;

  const renderCard = (item, showClaim) => {
    const matchCount =
      showClaim && item.status !== "CLAIMED"
        ? getMatches(item, items).length
        : 0;

    return (
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
            title="Tap to enlarge"
            style={styles.cardImage}
            onClick={() => setPreviewImage(item.image)}
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

        {/* Student claim button: no admin login required */}
        {showClaim &&
          item.type?.trim().toUpperCase() === "FOUND" &&
          item.status?.trim().toUpperCase() === "OPEN" &&
          items.some(
            (lost) =>
              lost.id !== item.id &&
              lost.type?.trim().toUpperCase() === "LOST" &&
              lost.status?.trim().toUpperCase() === "OPEN" &&
              norm(lost.category) !== "" &&
              norm(lost.category) === norm(item.category)
          ) && (
            <div style={{ ...styles.actions, marginBottom: "10px" }}>
              <button
                onClick={() => claimItem(item.id)}
                style={styles.claimButton}
              >
                I've Received This Item
              </button>
            </div>
          )}

        {/* Admin-only buttons */}
        {isAdmin && (
          <div style={styles.actions}>
            <button
              onClick={() => startEdit(item)}
              style={styles.editButton}
            >
              Edit
            </button>
            <button
              onClick={() => setDeleteTarget(item)}
              style={styles.deleteButton}
            >
              Delete
            </button>
          </div>
        )}

        {matchCount > 0 && (
          <button
            onClick={() => setMatchView({ item })}
            style={styles.matchButton}
          >
            🔍 {matchCount} possible match{matchCount > 1 ? "es" : ""}
          </button>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {/* Banner: logo + title */}
      <div style={styles.banner}>
        <div style={styles.brand}>
          <div style={styles.logoBox}>
            <img src={logo} alt="University logo" style={styles.logo} />
          </div>
          <h1 style={styles.title}>Lost & Found</h1>
        </div>

        <p style={styles.subtitle}>Report and find lost items easily</p>
      </div>

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

        {isAdmin ? (
          <button onClick={handleLogout} style={styles.navAdmin}>
            👤 Admin · Logout
          </button>
        ) : (
          <button
            onClick={() => {
              setLoginError("");
              setShowLogin(true);
            }}
            style={styles.navButton}
          >
            🔒 Admin Login
          </button>
        )}
      </nav>

      {/* Stats (History page only) */}
      {page === "history" && (
      <>
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={styles.statNumber}>{stats.total}</div>
          <div style={styles.statLabel}>Total</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: "#c8102e" }}>
            {stats.lost}
          </div>
          <div style={styles.statLabel}>Lost</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: "#1f3a5f" }}>
            {stats.found}
          </div>
          <div style={styles.statLabel}>Found</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statNumber, color: "#2e7d32" }}>
            {stats.claimed}
          </div>
          <div style={styles.statLabel}>Claimed</div>
        </div>
      </div>
      </>
      )}

      {page === "home" && (
        <>
          {/* Add / Edit Item Form */}
          <div style={styles.formBox} ref={formRef}>
            <h2 style={styles.formTitle}>
              {editingId !== null ? "Edit Item" : "Add Lost / Found Item"}
            </h2>

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

              <select
                name="category"
                value={form.category}
                onChange={handleChange}
                required
                style={styles.input}
              >
                <option value="">Select Category</option>
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                name="location"
                value={form.location}
                onChange={handleChange}
                required
                style={styles.input}
              >
                <option value="">Select Location</option>
                {locationOptions.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>

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

              <div style={styles.photoBox}>
                <label style={styles.photoLabel}>
                  {form.type === "FOUND"
                    ? "Add a photo of the found item"
                    : "Add a photo of the lost item (optional)"}
                </label>

                <div style={styles.photoButtons}>
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current.click()}
                    style={styles.photoButton}
                  >
                    📷 Take a photo
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current.click()}
                    style={styles.photoButton}
                  >
                    🖼️ Choose from gallery
                  </button>
                </div>

                {/* hidden inputs: one opens the camera, one opens the gallery */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImage}
                  style={{ display: "none" }}
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                  style={{ display: "none" }}
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

              <input
                type="text"
                name="contactInfo"
                placeholder="Contact Information"
                value={form.contactInfo}
                onChange={handleChange}
                required
                style={styles.input}
              />

              <div style={styles.formActions}>
                <button type="submit" style={styles.addButton}>
                  {editingId !== null ? "Save Changes" : "Add Item"}
                </button>

                {editingId !== null && (
                  <button
                    type="button"
                    onClick={cancelEdit}
                    style={styles.cancelButton}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Open items */}
          <h2 style={styles.heading}>Open Items ({openItems.length})</h2>

          <div style={styles.toolbar}>
            <div style={{ ...styles.searchBox, flex: 1, marginBottom: 0 }}>
              <input
                type="text"
                placeholder="🔍 Search open items..."
                value={homeSearch}
                onChange={(e) => setHomeSearch(e.target.value)}
                style={styles.searchInput}
              />
              {homeSearch && (
                <button
                  onClick={() => setHomeSearch("")}
                  style={styles.clearSearch}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              style={styles.sortSelect}
            >
              <option value="NEWEST">Newest first</option>
              <option value="OLDEST">Oldest first</option>
            </select>
          </div>

          {openItems.length === 0 ? (
            <p>
              {homeSearch
                ? `No open items match "${homeSearch}".`
                : totalOpen === 0
                ? "No open items. Claimed items are in History."
                : "No open items."}
            </p>
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

          {/* Search */}
          <div style={styles.searchBox}>
            <input
              type="text"
              placeholder="🔍 Search by item name, category, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={styles.searchInput}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                style={styles.clearSearch}
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>

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
            <p>
              {search
                ? `No items match "${search}".`
                : "No history found."}
            </p>
          ) : (
            <div style={styles.items}>
              {historyItems.map((item) => renderCard(item, false))}
            </div>
          )}
        </>
      )}

      {/* Confirm delete popup */}
      {deleteTarget && (
        <div style={styles.overlay} onClick={() => setDeleteTarget(null)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Are you sure?</h3>
            <p>
              "{deleteTarget.itemName}" will be deleted permanently. This
              cannot be undone.
            </p>
            <div style={styles.modalActions}>
              <button
                onClick={() => setDeleteTarget(null)}
                style={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteItem(deleteTarget.id)}
                style={styles.confirmDelete}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin login popup */}
      {showLogin && (
        <div style={styles.overlay} onClick={() => setShowLogin(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Admin Login</h3>
            <p style={{ color: "#666", fontSize: "14px", marginTop: 0 }}>
              Only the admin can mark items as claimed, edit or delete them.
            </p>

            <form onSubmit={handleLogin} style={styles.form}>
              <input
                type="text"
                placeholder="Username"
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, username: e.target.value })
                }
                required
                autoFocus
                style={styles.input}
              />
              <input
                type="password"
                placeholder="Password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
                required
                style={styles.input}
              />

              {loginError && <p style={styles.loginError}>{loginError}</p>}

              <div style={styles.modalActions}>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
                <button type="submit" style={styles.addButtonSmall}>
                  Log in
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Possible matches popup */}
      {matchView && (
        <div style={styles.overlay} onClick={() => setMatchView(null)}>
          <div
            style={{ ...styles.modal, maxWidth: "560px" }}
            onClick={(e) => e.stopPropagation()}
          >
            {matchView.justAdded && (
              <p style={styles.successNote}>✅ Your item was added.</p>
            )}

            <h3 style={{ marginTop: 0 }}>
              Possible matches for "{matchView.item.itemName}"
            </h3>

            {matchList.length === 0 ? (
              <p>No matches right now.</p>
            ) : (
              <>
                <p style={{ color: "#666", fontSize: "14px" }}>
                  These {matchView.item.type === "LOST" ? "FOUND" : "LOST"}{" "}
                  items look similar. Check them and use the contact details.
                </p>

                <div style={styles.matchList}>
                  {matchList.map((m) => (
                    <div key={m.item.id} style={styles.matchCard}>
                      {m.item.image && (
                        <img
                          src={m.item.image}
                          alt={m.item.itemName}
                          style={styles.matchThumb}
                          onClick={() => setPreviewImage(m.item.image)}
                        />
                      )}
                      <div style={{ flex: 1 }}>
                        <b>{m.item.itemName}</b>
                        <div style={styles.matchMeta}>
                          {m.item.category} · {m.item.location} · {m.item.date}
                        </div>
                        <div style={styles.matchMeta}>
                          Contact: {m.item.contactInfo}
                        </div>
                        <div style={styles.reasons}>
                          {m.reasons.map((r) => (
                            <span key={r} style={styles.reason}>
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div style={styles.modalActions}>
              <button
                onClick={() => setMatchView(null)}
                style={styles.addButtonSmall}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Enlarged photo */}
      {previewImage && (
        <div
          style={{ ...styles.overlay, zIndex: 3000 }}
          onClick={() => setPreviewImage(null)}
        >
          <img src={previewImage} alt="Enlarged" style={styles.lightboxImage} />
          <button
            onClick={() => setPreviewImage(null)}
            style={styles.lightboxClose}
            aria-label="Close photo"
          >
            ✕
          </button>
        </div>
      )}

      <Chatbot />
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

  // White banner with a red accent line. To use a campus photo,
  // save it as public/campus.jpg (it is shown faintly behind the title).
  banner: {
    background: `linear-gradient(rgba(255,255,255,0.93), rgba(255,255,255,0.93)), url(${process.env.PUBLIC_URL}/campus.jpg) center/cover`,
    borderRadius: "12px",
    borderBottom: "5px solid #c8102e",
    padding: "24px 20px",
    marginBottom: "20px",
    boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  },

  logoBox: {
    display: "flex",
    alignItems: "center",
  },

  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "14px",
    marginBottom: "8px",
  },

  logo: {
    height: "56px",
    width: "auto",
    objectFit: "contain",
  },

  title: {
    margin: 0,
    textAlign: "center",
    color: "#1f3a5f",
  },

  subtitle: {
    textAlign: "center",
    color: "#666",
    margin: 0,
  },

  nav: {
    display: "flex",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: "10px",
    marginBottom: "20px",
  },

  navLink: {
    background: "white",
    padding: "8px 16px",
    border: "1px solid #ccc",
    borderRadius: "20px",
    color: "#1f3a5f",
    textDecoration: "none",
    fontSize: "14px",
  },

  navButton: {
    background: "white",
    padding: "8px 16px",
    border: "1px solid #ccc",
    borderRadius: "20px",
    color: "#1f3a5f",
    fontSize: "14px",
    cursor: "pointer",
  },

  navAdmin: {
    background: "#1f3a5f",
    padding: "8px 16px",
    border: "1px solid #1f3a5f",
    borderRadius: "20px",
    color: "white",
    fontSize: "14px",
    cursor: "pointer",
  },

  loginError: {
    margin: 0,
    color: "#c8102e",
    fontSize: "14px",
  },

  navActive: {
    padding: "8px 16px",
    border: "1px solid #c8102e",
    borderRadius: "20px",
    background: "#c8102e",
    color: "white",
    textDecoration: "none",
    fontSize: "14px",
  },

  statsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))",
    gap: "12px",
    marginBottom: "25px",
  },

  statCard: {
    background: "white",
    border: "1px solid #e3e6ea",
    borderRadius: "12px",
    padding: "14px",
    textAlign: "center",
  },

  statNumber: {
    fontSize: "28px",
    fontWeight: "bold",
    color: "#222",
  },

  statLabel: {
    fontSize: "13px",
    color: "#666",
    marginTop: "2px",
  },

  formBox: {
    padding: "25px",
    background: "white",
    border: "1px solid #e3e6ea",
    borderTop: "4px solid #c8102e",
    borderRadius: "12px",
    marginBottom: "30px",
  },

  formTitle: {
    marginTop: 0,
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
    background: "white",
  },

  formActions: {
    display: "flex",
    gap: "10px",
  },

  addButton: {
    flex: 1,
    padding: "12px",
    background: "#c8102e",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "16px",
  },

  addButtonSmall: {
    padding: "10px 18px",
    background: "#c8102e",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "15px",
  },

  cancelButton: {
    padding: "12px 18px",
    background: "white",
    color: "#333",
    border: "1px solid #ccc",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "15px",
  },

  heading: {
    marginBottom: "15px",
  },

  toolbar: {
    display: "flex",
    gap: "10px",
    marginBottom: "18px",
    flexWrap: "wrap",
  },

  sortSelect: {
    padding: "12px",
    fontSize: "15px",
    border: "1px solid #ccc",
    borderRadius: "6px",
    background: "white",
  },

  photoBox: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    padding: "12px",
    border: "1px dashed #999",
    borderRadius: "6px",
  },

  photoLabel: {
    fontSize: "14px",
    color: "#1f3a5f",
  },

  photoButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
  },

  photoButton: {
    padding: "10px 14px",
    border: "1px solid #1f3a5f",
    borderRadius: "6px",
    background: "white",
    color: "#1f3a5f",
    cursor: "pointer",
    fontSize: "14px",
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

  searchBox: {
    position: "relative",
    marginBottom: "15px",
  },

  searchInput: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px 40px 12px 14px",
    fontSize: "16px",
    border: "1px solid #ccc",
    borderRadius: "6px",
  },

  clearSearch: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    fontSize: "16px",
    color: "#666",
    cursor: "pointer",
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
    border: "1px solid #e3e6ea",
    borderRadius: "12px",
    background: "white",
    boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
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

  cardImage: {
    width: "100%",
    maxHeight: "200px",
    objectFit: "cover",
    borderRadius: "8px",
    margin: "10px 0",
    cursor: "zoom-in",
  },

  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },

  claimButton: {
    padding: "10px",
    background: "#1f3a5f",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  },

  editButton: {
    padding: "10px 14px",
    background: "white",
    color: "#1f3a5f",
    border: "1px solid #1f3a5f",
    borderRadius: "6px",
    cursor: "pointer",
  },

  deleteButton: {
    padding: "10px",
    background: "white",
    color: "#c8102e",
    border: "1px solid #ccc",
    borderRadius: "6px",
    cursor: "pointer",
  },

  matchButton: {
    marginTop: "12px",
    width: "100%",
    padding: "10px",
    background: "#fff5f6",
    color: "#c8102e",
    border: "1px solid #c8102e",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: "bold",
  },

  overlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "20px",
    zIndex: 2000,
  },

  modal: {
    background: "white",
    borderRadius: "12px",
    padding: "24px",
    width: "100%",
    maxWidth: "400px",
    maxHeight: "85vh",
    overflowY: "auto",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },

  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    marginTop: "16px",
  },

  confirmDelete: {
    padding: "12px 18px",
    background: "#c8102e",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "15px",
  },

  successNote: {
    margin: "0 0 8px",
    color: "#2e7d32",
    fontWeight: "bold",
  },

  matchList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  matchCard: {
    display: "flex",
    gap: "12px",
    padding: "10px",
    border: "1px solid #e3e6ea",
    borderRadius: "8px",
    background: "#fafafa",
  },

  matchThumb: {
    width: "70px",
    height: "70px",
    objectFit: "cover",
    borderRadius: "6px",
    cursor: "zoom-in",
  },

  matchMeta: {
    fontSize: "13px",
    color: "#555",
    marginTop: "2px",
  },

  reasons: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "6px",
  },

  reason: {
    fontSize: "11px",
    padding: "2px 8px",
    borderRadius: "10px",
    background: "#fde8eb",
    color: "#c8102e",
    fontWeight: "bold",
  },

  lightboxImage: {
    maxWidth: "100%",
    maxHeight: "90vh",
    borderRadius: "8px",
  },

  lightboxClose: {
    position: "fixed",
    top: "16px",
    right: "16px",
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    border: "none",
    background: "white",
    fontSize: "18px",
    cursor: "pointer",
  },
};

export default App;