# Upload project to GitHub

Repo URL: **https://github.com/danylodiachyshyn-ops/Skarbo**  
(If your repo name is different, replace `Skarbo` in the commands below.)

## 1. Initialize Git (if not already)

```bash
cd "/Users/diachykdiachyshyn/Desktop/Binance Pattern Recognition"

git init
```

## 2. Add remote

```bash
git remote add origin https://github.com/danylodiachyshyn-ops/Skarbo.git
```

If you already have a remote and the URL is wrong:

```bash
git remote set-url origin https://github.com/danylodiachyshyn-ops/Skarbo.git
```

## 3. Add, commit, push

```bash
git add .
git status
git commit -m "Initial commit: Binance Pattern Recognition training pipeline"
git branch -M main
git push -u origin main
```

If the repo already has content (e.g. README) and you want to overwrite or merge:

```bash
git pull origin main --allow-unrelated-histories
# resolve conflicts if any, then:
git push -u origin main
```

## Notes

- `.gitignore` is set so **large data and models are not pushed**: `archive_extracted/`, `*.parquet`, `model/`, `checkpoint_dir/`, etc.
- Only code and config (e.g. `main_train.py`, `src/`, `requirements.txt`) will be uploaded.
- Use a **Personal Access Token** if GitHub asks for a password: GitHub → Settings → Developer settings → Personal access tokens.
