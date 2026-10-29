# nachomndzb.github.io

Personal site, served by GitHub Pages at https://nachomndzb.github.io.

Two views of the same content, no build step:

- `index.html` holds the writing (the plain "reading" page) and the HUD for the room.
- `scene.js` is the room: a procedural three.js night scene (desk, monitor with a live terminal, Abu Dhabi out of the window). It loads only when WebGL 2 is available and the visitor hasn't picked the lo-fi version or asked for less motion. `?view=reading` or `?view=room` forces either.

Edit, commit, push to `main`.
