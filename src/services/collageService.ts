export interface CollageLayout {
  rows: number;
  cols: number;
}

export class CollageService {
  async generateCollage(
    images: File[],
    variantLabels: string[]
  ): Promise<Blob> {
    const cols = images.length === 5 ? 5 : this.getOptimalLayout(images.length).cols;
    const rows = images.length === 5 ? 1 : this.getOptimalLayout(images.length).rows;

    const imageWidth = 600;
    const imageHeight = 800; // Portrait 3:4

    // WIDTH-BASED CALCULATION
    // Total strip width
    const stripWidth = cols * imageWidth;
    const stripHeight = rows * imageHeight;

    // Create Square Canvas based on width (to fit horizontal strip completely)
    // Or based on max dimension logic
    const canvasSize = Math.max(stripWidth, stripHeight);

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize; // Square Canvas 1:1
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Vertical/Horizontal Centering Offsets
    const offsetX = (canvasSize - stripWidth) / 2;
    const offsetY = (canvasSize - stripHeight) / 2;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load all images
    const loadedImages = await Promise.all(
      images.map(file => this.loadImageFromFile(file))
    );

    // Draw images
    // Standard Grid Layout (works for 1x5 too)
    for (let i = 0; i < images.length; i++) {
      // Calculate grid position
      const row = Math.floor(i / cols);
      const col = i % cols;

      // Calculate canvas coordinates with offset (centering)
      const x = offsetX + (col * imageWidth);
      const y = offsetY + (row * imageHeight);

      // Draw image (CONTAIN / FIT CENTER)
      this.drawImageContain(ctx, loadedImages[i], x, y, imageWidth, imageHeight);

      // Add border
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, imageWidth, imageHeight);

      // Add variant label
      if (variantLabels[i]) {
        this.drawLabel(ctx, variantLabels[i], x, y);
      }
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob from canvas'));
        }
      }, 'image/jpeg', 0.9);
    });
  }

  getOptimalLayout(count: number): CollageLayout {
    const layouts: Record<number, CollageLayout> = {
      1: { rows: 1, cols: 1 },
      2: { rows: 1, cols: 2 },
      3: { rows: 1, cols: 3 },
      4: { rows: 2, cols: 2 },
      5: { rows: 1, cols: 5 }, // FIXED: 1 row, 5 columns (Horizontal)
      6: { rows: 2, cols: 3 },
      7: { rows: 2, cols: 4 },
      8: { rows: 2, cols: 4 },
      9: { rows: 3, cols: 3 }
    };

    return layouts[count] || { rows: 2, cols: 2 };
  }

  // CHANGED: Use CONTAIN logic instead of COVER to show full image
  private drawImageContain(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement,
    x: number,
    y: number,
    width: number,
    height: number
  ) {
    // Calculate aspect ratios
    const imgRatio = img.width / img.height;
    const boxRatio = width / height;

    let drawWidth = width;
    let drawHeight = height;
    let drawX = x;
    let drawY = y;

    // Contain logic: Fit image inside the box preserving aspect ratio
    if (imgRatio > boxRatio) {
      // Image is wider than box -> fit to width
      drawHeight = width / imgRatio;
      drawY = y + (height - drawHeight) / 2; // Center vertically
    } else {
      // Image is taller than box -> fit to height
      drawWidth = height * imgRatio;
      drawX = x + (width - drawWidth) / 2; // Center horizontally
    }

    ctx.drawImage(
      img,
      0, 0, img.width, img.height, // Source full image
      drawX, drawY, drawWidth, drawHeight // Destination scaled
    );
  }

  private drawLabel(
    ctx: CanvasRenderingContext2D,
    label: string,
    x: number,
    y: number
  ) {
    const padding = 10;
    const labelSize = 80;

    // Background with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Dark background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(x + padding, y + padding, labelSize, labelSize);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Text
    ctx.font = 'bold 48px Arial, sans-serif';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + padding + labelSize / 2, y + padding + labelSize / 2);

    // Optional: Add a small border to label background
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + padding, y + padding, labelSize, labelSize);
  }

  private loadImageFromFile(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        URL.revokeObjectURL(img.src);
        resolve(img);
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error(`Failed to load image: ${file.name}`));
      };

      img.src = URL.createObjectURL(file);
    });
  }

  // Helper: Convert File to base64 for Gemini API
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => {
        const result = reader.result as string;
        // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsDataURL(file);
    });
  }

  // Helper: Compress image if too large
  async compressImage(file: File, maxSizeMB: number = 1): Promise<File> {
    const fileSizeMB = file.size / (1024 * 1024);

    if (fileSizeMB <= maxSizeMB) {
      return file;
    }

    // Load image
    const img = await this.loadImageFromFile(file);

    // Calculate new dimensions (maintain aspect ratio)
    const scaleFactor = Math.sqrt(maxSizeMB / fileSizeMB);
    const newWidth = Math.floor(img.width * scaleFactor);
    const newHeight = Math.floor(img.height * scaleFactor);

    // Create canvas for compression
    const canvas = document.createElement('canvas');
    canvas.width = newWidth;
    canvas.height = newHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Draw scaled image
    ctx.drawImage(img, 0, 0, newWidth, newHeight);

    // Convert to blob
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            // Create new File from blob
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Failed to compress image'));
          }
        },
        'image/jpeg',
        0.85 // Quality
      );
    });
  }

  // Helper: Generate variant labels (A, B, C, ...)
  generateVariantLabels(count: number): string[] {
    const labels: string[] = [];
    for (let i = 0; i < count; i++) {
      labels.push(String.fromCharCode(65 + i)); // A, B, C, ...
    }
    return labels;
  }

  // Helper: Preview collage dimensions
  getCollageDimensions(imageCount: number): { width: number; height: number } {
    const layout = this.getOptimalLayout(imageCount);
    const imageSize = 600;

    return {
      width: layout.cols * imageSize,
      height: layout.rows * imageSize
    };
  }
}

export const collageService = new CollageService();
