# ♠ Poker Dashboard

A web app for analysing your weekly [PokerNow](https://www.pokernow.club/) home game. Upload your hand history CSV files to see stats like VPIP, PFR, Aggression Factor, net chips, and preflop range grids for every player. Sessions are saved locally in your browser so you can add a new file each week and view combined stats over time.

---

## What you need before starting

You only need to do this setup once.

### 1. Install Node.js

Node.js is the engine that runs this app on your computer.

1. Go to **https://nodejs.org**
2. Click the big **"LTS"** download button (LTS = recommended stable version)
3. Run the installer — click Next through all the steps, leave everything as default
4. When it finishes, **restart your computer**

To check it worked: open a terminal (see step 2 below) and type `node --version`. You should see something like `v22.0.0`.

---

### 2. Open a terminal

A terminal is a text window you type commands into.

**On Windows:**
- Press `Windows key + R`, type `cmd`, press Enter
- *Or* search for "Command Prompt" in the Start menu

**On Mac:**
- Press `Cmd + Space`, type `Terminal`, press Enter

---

### 3. Download the project

**If you received a ZIP file:**
1. Unzip it somewhere easy to find, like your Desktop or Documents folder
2. In your terminal, navigate into the folder:

   **Windows example** (adjust the path to match where you unzipped it):
   ```
   cd C:\Users\YourName\Desktop\poker-dashboard
   ```

   **Mac example:**
   ```
   cd ~/Desktop/poker-dashboard
   ```

**If you have Git installed** (more advanced):
```
git clone <repo-url>
cd poker-dashboard
```

---

### 4. Install dependencies (one-time setup)

In your terminal, with the project folder open, run:

```
npm install
```

This downloads everything the app needs. It may take a minute or two. You'll see a lot of text — that's normal.

---

## Running the app

Every time you want to use the dashboard, open a terminal in the project folder and run:

```
npm run dev
```

You'll see output like:

```
  VITE v8.x.x  ready in 300ms

  ➜  Local:   http://localhost:5173/
```

Then open your browser and go to **http://localhost:5173**

The app is running! To stop it, go back to the terminal and press `Ctrl + C`.

> **Tip:** Keep the terminal window open while using the app. If you close it, the app stops.

---

## How to export your hand history from PokerNow

After each game session on PokerNow:

1. Go to the game room
2. Click the **menu (≡)** in the top-right corner
3. Click **"Download Hand History"** — this saves a `.csv` file to your Downloads folder

---

## Using the dashboard

1. Start the app (`npm run dev`) and open **http://localhost:5173** in your browser
2. On the home screen, drag your CSV file onto the upload area, or click to browse for it
3. The session is saved automatically — you don't need to re-upload it next time
4. Each week after your game, upload the new CSV. Click **"+ Add Session"** from the dashboard, or go back to the Sessions page and drop the new file there
5. Click **"View All Sessions (N) →"** to see combined stats across all weeks

Your data lives in your browser's local storage, so it persists between visits as long as you use the same browser on the same computer.

---

## Troubleshooting

**"npm is not recognized" or "command not found"**
- Node.js didn't install correctly, or you need to restart your computer after installing it
- Try restarting, then open a fresh terminal

**The page won't load at http://localhost:5173**
- Make sure the terminal is still running `npm run dev` (you should see the "ready" message)
- Try a different browser

**"Failed to parse file" error after uploading**
- Make sure you're uploading a PokerNow hand history CSV (not a different type of file)
- The file should come from PokerNow's "Download Hand History" option

**The app is slow or the terminal shows errors**
- Stop the app (`Ctrl + C`) and run `npm install` again, then `npm run dev`

---

## Stats glossary

| Term | Meaning |
|------|---------|
| **VPIP** | Voluntarily Put $ In Pot — % of hands where the player called or raised preflop (blinds don't count). High = loose player. |
| **PFR** | Preflop Raise % — % of hands with a preflop raise. Always ≤ VPIP. |
| **AF** | Aggression Factor — (Bets + Raises) ÷ Calls post-flop. >2 = aggressive, <1 = passive. |
| **Win%** | % of dealt hands where the player collected the pot. |
| **Fold%** | % of hands folded before seeing the flop. |
| **Luck†** | % of observed hands that were premium (AA/KK/QQ/JJ/AK). Higher = ran hot. |
| **Tight** | VPIP below 20% — plays only strong hands. |
| **Loose** | VPIP above 50% — plays most dealt hands. |
| **Passive** | AF below 1 — tends to call rather than bet or raise. |
| **Aggressive** | AF above 2 — frequently bets and raises. |
| **Net Chips** | Total cash-out minus total buy-ins across all loaded sessions. |
