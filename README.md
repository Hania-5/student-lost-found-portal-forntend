# Lost & Found Campus Portal – Frontend

A React web app where students report lost and found items on campus, search them, and get suggestions when a lost item matches a found one.

## Features
- Report **lost** or **found** items with details and a photo (take a photo or choose from gallery)
- **Auto-match suggestions**: lost items are matched with found items by category, location and similar name
- **Home** page with open items, search, and newest/oldest sorting
- **History** page with all items, search, filters (All / Lost / Found / Claimed) and statistics
- Tap a photo to enlarge it
- **Admin login**: only the admin can mark items as claimed, edit them or delete them (with an "Are you sure?" confirmation)
- Help chatbot that answers common questions about using the portal
- Responsive design in the university's red and white colours

## Tech Stack
- React (Create React App)
- Fetch API for talking to the backend
- Spring Boot REST API + MySQL (separate backend repository)

## Requirements
- Node.js 16 or newer
- The backend running on `http://localhost:8080`

## How to Run
1. Start the backend first (see the backend repository's README).
2. Install the dependencies:
   ```
   npm install
   ```
3. Start the app:
   ```
   npm start
   ```
4. Open http://localhost:3000

## Admin Login (demo)
Click **Admin Login** in the menu.

- Username: `admin`
- Password: `admin123`

Only the admin can mark items as claimed, edit and delete them. Everyone else can report and view items.

## Configuration
The backend address is set at the top of `src/App.js`. To use a different address, create a `.env` file in the project root:
```
REACT_APP_API_URL=http://localhost:8080/api/items
```
Restart `npm start` after changing it.

## Optional: campus photo in the banner
Save a photo as `public/campus.jpg` and it appears faintly behind the title.

## Project Structure
```
src/
  App.js        main app (pages, forms, admin login, matching)
  Chatbot.js    help chatbot
  index.js      entry point
  index.css     global styles
  logo.png      university logo
```

## Author
Hania Fathima – B.Tech Data Science, Anurag University