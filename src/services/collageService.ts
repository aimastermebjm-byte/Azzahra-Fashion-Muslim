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

    // IMPROVEMENT: Compress images first for mobile reliability
    const compressedImages = await Promise.all(
      images.map(file => this.compressImage(file, 2)) // Max 2MB per image
    );

    // Load all images with timeout and retry
    const loadedImages = await Promise.all(
      compressedImages.map(file => this.loadImageWithRetry(file, 3, 10000))
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

  // Load image with retry and timeout for mobile reliability
  private async loadImageWithRetry(file: File, maxRetries: number = 3, timeout: number = 10000): Promise<HTMLImageElement> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const img = await this.loadImageWithTimeout(file, timeout);
        return img;
      } catch (error) {
        lastError = error as Error;
        console.warn(`Image load attempt ${attempt}/${maxRetries} failed for ${file.name}:`, error);
        // Wait a bit before retry (exponential backoff)
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }
    }

    throw lastError || new Error(`Failed to load image after ${maxRetries} attempts`);
  }

  // Load image with timeout
  private loadImageWithTimeout(file: File, timeout: number): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);

      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Image load timeout after ${timeout}ms: ${file.name}`));
      }, timeout);

      img.onload = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        URL.revokeObjectURL(objectUrl);
        reject(new Error(`Failed to load image: ${file.name}`));
      };

      img.src = objectUrl;
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
      // REVISION: Use 50/50 split to make top cells Perfect 3:4 Aspect Ratio (750x1000)
      // This prevents head cropping!
      const hTop = H * 0.5;
      const hBot = H * 0.5;

      // Row 1 (2 items) - Perfect 3:4
      const wTop = W / 2;
      boxes.push({ x: 0, y: 0, w: wTop, h: hTop });
      boxes.push({ x: wTop, y: 0, w: wTop, h: hTop });

      // Row 2 (3 items) - Tall Strips (1:2)
      const wBot = W / 3;
      boxes.push({ x: 0, y: hTop, w: wBot, h: hBot });
      boxes.push({ x: wBot, y: hTop, w: wBot, h: hBot });
      boxes.push({ x: wBot * 2, y: hTop, w: wBot, h: hBot });
    }
    else if (count === 6) {
      // 3 top + 3 bottom
      const h = H / 2;
      const w = W / 3;
      // Row 1: 3 items
      for (let c = 0; c < 3; c++) {
        boxes.push({ x: c * w, y: 0, w: w, h: h });
      }
      // Row 2: 3 items
      for (let c = 0; c < 3; c++) {
        boxes.push({ x: c * w, y: h, w: w, h: h });
      }
    }
    else if (count === 7) {
      // 3 top + 4 bottom
      const h = H / 2;
      const wTop = W / 3;
      const wBot = W / 4;
      // Row 1: 3 items
      for (let c = 0; c < 3; c++) {
        boxes.push({ x: c * wTop, y: 0, w: wTop, h: h });
      }
      // Row 2: 4 items
      for (let c = 0; c < 4; c++) {
        boxes.push({ x: c * wBot, y: h, w: wBot, h: h });
      }
    }
    else if (count === 8) {
      // 4 top + 4 bottom
      const h = H / 2;
      const w = W / 4;
      // Row 1: 4 items
      for (let c = 0; c < 4; c++) {
        boxes.push({ x: c * w, y: 0, w: w, h: h });
      }
      // Row 2: 4 items
      for (let c = 0; c < 4; c++) {
        boxes.push({ x: c * w, y: h, w: w, h: h });
      }
    }
    else if (count === 9) {
      // 4 top + 5 bottom
      const h = H / 2;
      const wTop = W / 4;
      const wBot = W / 5;
      // Row 1: 4 items
      for (let c = 0; c < 4; c++) {
        boxes.push({ x: c * wTop, y: 0, w: wTop, h: h });
      }
      // Row 2: 5 items
      for (let c = 0; c < 5; c++) {
        boxes.push({ x: c * wBot, y: h, w: wBot, h: h });
      }
    }
    else if (count === 10) {
      // 5 top + 5 bottom
      const h = H / 2;
      const w = W / 5;
      // Row 1: 5 items
      for (let c = 0; c < 5; c++) {
        boxes.push({ x: c * w, y: 0, w: w, h: h });
      }
      // Row 2: 5 items
      for (let c = 0; c < 5; c++) {
        boxes.push({ x: c * w, y: h, w: w, h: h });
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

    // TOP Anchor Logic (To prevent head chopping)
    // If scaled height > box height, align top (0) instead of center.
    // Actually, let's keep Center-X, but Top-Y 
    // BUT with a slight offset so it's not stick-to-ceiling if the photo has whitespace above head.
    // However, Standard Top (0) is safest for "Don't cut head".

    const dx = x + (w - scaledW) / 2; // Center X

    // Logic: 
    // If the image is excessively tall relative to box (e.g. box 1:1, img 1:2), 
    // centering Y cuts head and feet.
    // Focusing Top (y=0) saves head, cuts feet.
    // Focusing Bottom saves feet, cuts head.
    // Fashion priority: Head > Feet.

    let dy = y + (h - scaledH) / 2; // Default Center Y

    // If we are cropping vertically (image taller than box relative to width)
    // Shift slightly up to prioritize upper body.
    if (scaledH > h) {
      // A value of 0 means align top. 
      // A value of (h - scaledH) / 2 means align center.
      // Let's use 20% from top (bias top).
      // dy = y + (h - scaledH) * 0.2; 

      // Actually, pure Top-Center is safest for 5-item top row issue.
      // Let's use pure Top Anchor if it's potentially cropping head.
      dy = y;
    }

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
    // FIXED SIZE for consistency across all collage types (like 6-image collage)
    // Base reference: 6-image collage has cells of 500x1000 (W/3 x H/2)
    const fixedLabelSize = 100; // Fixed size for all label boxes
    const fixedFontSize = 60; // Fixed font size for all labels

    const centerX = cellX + cellW / 2;
    // Position at 3/4 down the cell (not too low, slightly raised)
    const positionY = cellY + cellH * 0.75;

    const x = centerX - (fixedLabelSize / 2);
    const y = positionY - (fixedLabelSize / 2);

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    // Box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(x, y, fixedLabelSize, fixedLabelSize);

    // Reset Shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Text - positioned in center of the box
    ctx.font = `bold ${fixedFontSize}px Arial, sans-serif`;
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, centerX, positionY);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, fixedLabelSize, fixedLabelSize);
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
