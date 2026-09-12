# Automated deploy script for Color Sort Game
# Pushes changes to both main and gh-pages (GitHub Pages live server)

param (
    [string]$CommitMessage = "Update game and deploy to gh-pages"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Step 1: Pushing current changes to 'main' ===" -ForegroundColor Cyan
git add .
try {
    git commit -m $CommitMessage
} catch {
    Write-Host "No new changes to commit on main." -ForegroundColor Yellow
}
git push origin main

Write-Host "=== Step 2: Syncing files to 'gh-pages' ===" -ForegroundColor Cyan
git checkout gh-pages
git checkout main -- public

# Copy all assets from public/ into root for GitHub Pages
Copy-Item -Recurse -Force public/* .

git add index.html js/ style.css public/
try {
    git commit -m $CommitMessage
} catch {
    Write-Host "No changes to commit on gh-pages." -ForegroundColor Yellow
}
git push origin gh-pages

Write-Host "=== Step 3: Returning to 'main' branch ===" -ForegroundColor Cyan
git checkout main

Write-Host "`n Deployment to live server complete!" -ForegroundColor Green
Write-Host "Live WebApp URL: https://yyt1093-source.github.io/color_sort_game/" -ForegroundColor Green
