ECHOES OF SPACE - GitHub Pages package

1. Copy your own asset files into the folders below (names must match EXACTLY, including capital letters):
   assets/models/    all .glb files (surveyor-3.glb, apollo-11-eagle.glb, sojourner.glb, mars.glb, moon.glb, earth.glb ...)
   assets/textures/  moon.jpg, mars.jpg, earth.jpg
   assets/logos/     nasa-space-apps.png, bahrain-space-agency.png
   assets/videos/, assets/images/, assets/audio/, assets/fonts/  (only if you use them)
   Without the .glb files no machines appear (the app skips machines with no model).
2. Upload everything (including the hidden .nojekyll file) to a GitHub repository, branch main, root folder.
3. Settings > Pages > Deploy from a branch > main / (root). Wait 1-2 minutes.
Each file must be under 100 MB (use git push or GitHub Desktop for files over 25 MB).
Local test: python3 -m http.server 8000
