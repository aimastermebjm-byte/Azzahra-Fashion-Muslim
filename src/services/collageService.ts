export interface CollageLayout {
  rows: number;
  cols: number;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class CollageService {
  async generateCollage(
    images: File[],
    variantLabels: string[]
  ): Promise<Blob> {
    const count = images.length;

    // Canvas dimensions (Portrait 3:4 High Res)
    const W = 1500;
    const H = 2000;

    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    // Load all images
    const loadedImages = await Promise.all(
      images.map(file => this.loadImageFromFile(file))
    );

    // Get Layout Configuration
    const layout = this.calculateLayout(count, W, H);

    // Draw images based on layout
    layout.forEach((box, index) => {
      if (index >= loadedImages.length) return;

      const img = loadedImages[index];
      const label = variantLabels[index];

      // Draw standard clean cover
      this.drawImageInBox(ctx, img, box.x, box.y, box.w, box.h);

      // Draw Divider/Border
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeRect(box.x, box.y, box.w, box.h);

      // Draw Label
      if (label) {
        this.drawLabelCentered(ctx, label, box.x, box.y, box.w, box.h);
      }
    });

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/jpeg', 0.95);
    });
  }

  // --- LAYOUT ENGINE ---
  private calculateLayout(count: number, W: number, H: number): Rect[] {
    const boxes: Rect[] = [];

    if (count === 1) {
      boxes.push({ x: 0, y: 0, w: W, h: H });
    }
    else if (count === 2) {
      // 2 Cols side by side
      const w = W / 2;
      boxes.push({ x: 0, y: 0, w: w, h: H });
      boxes.push({ x: w, y: 0, w: w, h: H });
    }
    else if (count === 3) {
      // MAGAZINE LAYOUT (Request: 1 Left Big, 2 Right Stacked)
      // Left Col
      const wHalf = W / 2;
      const hHalf = H / 2;

      // A: Left Full
      boxes.push({ x: 0, y: 0, w: wHalf, h: H });
      // B: Right Top
      boxes.push({ x: wHalf, y: 0, w: wHalf, h: hHalf });
      // C: Right Bottom
      boxes.push({ x: wHalf, y: hHalf, w: wHalf, h: hHalf });
    }
    else if (count === 4) {
      // 2x2 Grid (Perfect 3:4 Aspect)
      const w = W / 2;
      const h = H / 2;
      boxes.push({ x: 0, y: 0, w: w, h: h });
      boxes.push({ x: w, y: 0, w: w, h: h });
      boxes.push({ x: 0, y: h, w: w, h: h });
      boxes.push({ x: w, y: h, w: w, h: h });
    }
    else if (count === 5) {
      // Top: 2 Big, Bottom: 3 Small
      const hTop = H * 0.4; // 40% height for top row
      const hBot = H * 0.6; // 60% height for bottom row (taller because narrower width)

      // Row 1 (2 items)
      const wTop = W / 2;
      boxes.push({ x: 0, y: 0, w: wTop, h: hTop });
      boxes.push({ x: wTop, y: 0, w: wTop, h: hTop });

      // Row 2 (3 items)
      const wBot = W / 3;
      boxes.push({ x: 0, y: hTop, w: wBot, h: hBot });
      boxes.push({ x: wBot, y: hTop, w: wBot, h: hBot });
      boxes.push({ x: wBot * 2, y: hTop, w: wBot, h: hBot });
    }
    else if (count === 6) {
      // 2 Cols x 3 Rows (To check width)
      // Cells will be W/2 x H/3
      const w = W / 2;
      const h = H / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 2; c++) {
          boxes.push({ x: c * w, y: r * h, w: w, h: h });
        }
      }
    }
    else if (count === 7) {
      // 1 Top (Header), 6 Grid below (2x3)
      const hHead = H * 0.4;
      const hGrid = (H - hHead) / 2; // Remaining 2 rows

      // 1. Header Full
      boxes.push({ x: 0, y: 0, w: W, h: hHead });

      // 6 items in 2 rows x 3 cols
      const wGrid = W / 3;
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 3; c++) {
          boxes.push({ x: c * wGrid, y: hHead + (r * hGrid), w: wGrid, h: hGrid });
        }
      }
    }
    else if (count === 8) {
      // 2 Cols x 4 Rows
      const w = W / 2;
      const h = H / 4;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 2; c++) {
          boxes.push({ x: c * w, y: r * h, w: w, h: h });
        }
      }
    }
    else if (count === 9) {
      // 3x3 Grid (Perfect)
      const w = W / 3;
      const h = H / 3;
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
          boxes.push({ x: c * w, y: r * h, w: w, h: h });
        }
      }
    }
    else if (count === 10) {
      // 2 Top, 4 Mid, 4 Bot
      const hRow1 = H * 0.4;
      const hRowOther = (H - hRow1) / 2;

      // Row 1: 2 Items
      const wRow1 = W / 2;
      boxes.push({ x: 0, y: 0, w: wRow1, h: hRow1 });
      boxes.push({ x: wRow1, y: 0, w: wRow1, h: hRow1 });

      // Row 2: 4 Items
      const wRow2 = W / 4;
      for (let c = 0; c < 4; c++) {
        boxes.push({ x: c * wRow2, y: hRow1, w: wRow2, h: hRowOther });
      }

      // Row 3: 4 Items
      for (let c = 0; c < 4; c++) {
        boxes.push({ x: c * wRow2, y: hRow1 + hRowOther, w: wRow2, h: hRowOther });
      }
    }
    else {
      // Fallback > 10 (Simple Grid)
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      const w = W / cols;
      const h = H / rows;

      for (let i = 0; i < count; i++) {
        const r = Math.floor(i / cols);
        const c = i % cols;
        boxes.push({ x: c * w, y: r * h, w: w, h: h });
      }
    }

    return boxes;
  }

  // --- DRAWING HELPERS ---

  private drawImageInBox(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();

    // CLEAN COVER Logic
    const scale = Math.max(w / img.width, h / img.height);
    const scaledW = img.width * scale;
    const scaledH = img.height * scale;

    // Center logic
    const dx = x + (w - scaledW) / 2;
    const dy = y + (h - scaledH) / 2;

    ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, scaledW, scaledH);
    ctx.restore();
  }

  private drawLabelCentered(
    ctx: CanvasRenderingContext2D,
    label: string,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number
  ) {
    // JUMBO SIZE
    const labelSize = 200;

    const centerX = cellX + cellW / 2;
    const centerY = cellY + cellH / 2;

    const x = centerX - (labelSize / 2);
    const y = centerY - (labelSize / 2);

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    // Box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, labelSize, labelSize);

    // Reset Shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Text
    ctx.font = 'bold 130px Arial, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, centerX, centerY + 8);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, labelSize, labelSize);
  }

  private loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(img.src); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error(`Failed to load image: ${file.name}`)); };
      img.src = URL.createObjectURL(file);
    });
  }

  // Helper: Convert File to base64 for Gemini API
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  // Compression Helper (Maintained)
  async compressImage(file: File, maxSizeMB: number = 1): Promise<File> {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB <= maxSizeMB) return file;

    const img = await this.loadImageFromFile(file);
    const scaleFactor = Math.sqrt(maxSizeMB / fileSizeMB);
    const newWidth = Math.floor(img.width * scaleFactor);
    const newHeight = Math.floor(img.height * scaleFactor);

    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');

    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        } else {
          reject(new Error('Failed to compress image'));
        }
      }, 'image/jpeg', 0.85);
    });
  }

  // Variant Label Generator (Maintained)
  generateVariantLabels(count: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(String.fromCharCode(65 + i));
    }
    return labels;
  }

  // Dimensions Helper (Maintained)
  getCollageDimensions(_imageCount: number): { width: number; height: number } {
    return { width: 1500, height: 2000 };
  }

  // Layout Helper for UI (Maintained - Rough Estimate)
  getOptimalLayout(count: number): { rows: number; cols: number } {
    if (count <= 3) return { rows: 1, cols: count };
    // This is just for UI previews, actual layout is handled by calculateLayout
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  }
}

export const collageService = new CollageService();
