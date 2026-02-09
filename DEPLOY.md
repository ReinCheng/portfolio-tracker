# Deploy Portfolio Tracker to GitHub & View on Phone

Follow these steps to put your app on GitHub and open it on your phone.

---

## Step 1: Set Git identity (one-time)

In PowerShell or Terminal, run (use your real name and GitHub email):

```powershell
git config --global user.email "your-email@example.com"
git config --global user.name "Your Name"
```

---

## Step 2: Create the repo on GitHub

1. Go to **https://github.com/new**
2. Repository name: `portfolio-tracker` (or any name you like)
3. Leave it **empty** (no README, no .gitignore)
4. Click **Create repository**

---

## Step 3: Commit and push from your project folder

In PowerShell:

```powershell
cd "c:\Users\10655\Documents\portfolio-tracker"

# If you haven't committed yet:
git add .gitignore index.html styles.css app.js README.md
git commit -m "Initial commit: Portfolio Tracker"
git branch -M main

# Add your repo (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/portfolio-tracker.git

# Push
git push -u origin main
```

When prompted, sign in to GitHub (browser or token).

---

## Step 4: Turn on GitHub Pages (so you get a public link)

1. On GitHub, open your repo **portfolio-tracker**
2. Go to **Settings** → **Pages**
3. Under **Build and deployment** → **Source**, choose **Deploy from a branch**
4. Branch: **main**, Folder: **/ (root)** → **Save**
5. Wait 1–2 minutes. Your site will be at:

   **https://YOUR_USERNAME.github.io/portfolio-tracker/**

---

## Step 5: View on your phone

- Open the link above in your phone’s browser.
- Optionally **bookmark** or **Add to Home Screen** so it opens like an app.

**Note:** Data is stored in each device’s browser (localStorage). Your phone and PC will have separate data unless you re-enter holdings on each.

---

## Quick reference

| Goal              | Action |
|-------------------|--------|
| GitHub repo link  | `https://github.com/YOUR_USERNAME/portfolio-tracker` |
| Live site (phone/PC) | `https://YOUR_USERNAME.github.io/portfolio-tracker/` |
