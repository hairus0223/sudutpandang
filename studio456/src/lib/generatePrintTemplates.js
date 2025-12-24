export async function generatePrintTemplates({
  images,
  editorData,
  template,
  orientation = "landscape",
}) {
  const templates = [];

  const landscape = { w: 1800, h: 1200 };
  const portrait  = { w: 1200, h: 1800 };
  const { w, h } = orientation === "landscape" ? landscape : portrait;

  const border = 30;

  const loadImage = (src) =>
    new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.src = src;
    });

  // ==== TEMPLATE SINGLE ====
  if (template === "single") {
    for (let i = 0; i < images.length; i++) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);

      const img = await loadImage(images[i]);
      const edit = editorData[i];

      applyImage(ctx, img, edit, border, border, w - border * 2, h - border * 2);

      templates.push(canvas);
    }
  }

  // ==== TEMPLATE DOUBLE ====
  if (template === "double") {
    for (let i = 0; i < images.length; i += 2) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);

      const leftImg  = await loadImage(images[i]);
      const rightImg = await loadImage(images[i + 1]);

      applyImage(ctx, leftImg, editorData[i], border, border, w/2 - border*2, h - border*2);

      if (rightImg)
        applyImage(ctx, rightImg, editorData[i+1], w/2 + border, border, w/2 - border*2, h - border*2);

      templates.push(canvas);
    }
  }

  // ==== TEMPLATE GRID (2×2) ====
  if (template === "grid") {
    const perPage = 4;
    for (let p = 0; p < images.length; p += perPage) {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");

      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);

      const cellW = w / 2 - border * 1.5;
      const cellH = h / 2 - border * 1.5;

      for (let i = 0; i < 4; i++) {
        const index = p + i;
        if (!images[index]) continue;

        const img = await loadImage(images[index]);
        const edit = editorData[index];

        const col = i % 2;
        const row = Math.floor(i / 2);

        applyImage(
          ctx,
          img,
          edit,
          border + col * (cellW + border),
          border + row * (cellH + border),
          cellW,
          cellH
        );
      }

      templates.push(canvas);
    }
  }

  return templates;
}

function applyImage(ctx, img, edit, x, y, w, h) {
  const { croppedAreaPixels, rotation, brightness, contrast } = edit;

  ctx.filter = `brightness(${brightness}%) contrast(${contrast}%)`;

  ctx.save();
  ctx.translate(x + w/2, y + h/2);
  ctx.rotate((rotation * Math.PI) / 180);

  ctx.drawImage(
    img,
    croppedAreaPixels.x,
    croppedAreaPixels.y,
    croppedAreaPixels.width,
    croppedAreaPixels.height,
    -w/2,
    -h/2,
    w,
    h
  );

  ctx.restore();
}
