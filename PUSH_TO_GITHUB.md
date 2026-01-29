# Push This Project to GitHub

Run these commands in your terminal from the project folder.

## 1. Go to project folder
```bash
cd "/Users/diachykdiachyshyn/Desktop/Binance Pattern Recognition"
```

## 2. Initialize Git (if not already)
```bash
git init
```

## 3. Add GitHub remote
Replace `REPO_NAME` with your actual repo name (e.g. `Skarbo` or full name from the URL):
```bash
git remote add origin https://github.com/danylodiachyshyn-ops/REPO_NAME.git
```
If you already have a remote:
```bash
git remote set-url origin https://github.com/danylodiachyshyn-ops/REPO_NAME.git
```

## 4. Add, commit, push
```bash
git add .
git status
git commit -m "Initial commit: Binance Pattern Recognition training pipeline"
git branch -M main
git push -u origin main
```

If GitHub asks for credentials, use your **username** and a **Personal Access Token** (not your password).  
Create a token: GitHub → Settings → Developer settings → Personal access tokens.
