export interface CollageLayout {
  rows: number;
  cols: number;
}

export class CollageService {
  async generateCollage(
    images: File[],
    variantLabels: string[]
  ): Promise<Blob> {
    const count = images.length;
    // Changed to Portrait Aspect Ratio (3:4) for fashion
    const canvasWidth = 1500;
    const canvasHeight = 2000;

    // Determine layout configuration (items per row)
    // Optimized for Fashion Products
    let rowsConfig: number[] = [];

    if (count === 1) {
      rowsConfig = [1];
    } else if (count === 2) {
      rowsConfig = [2]; // 2 side by side (Tall strips)
    } else if (count === 3) {
      rowsConfig = [3]; // 3 side by side (Very tall strips - Trendy)
    } else if (count === 4) {
      rowsConfig = [2, 2]; // 2x2 Grid
    } else if (count === 5) {
      rowsConfig = [3, 2]; // 3 top, 2 bottom
    } else if (count === 6) {
      rowsConfig = [3, 3]; // 3x3 Grid
    } else if (count <= 9) {
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      rowsConfig = Array(rows).fill(cols);
      const remainder = count % cols;
      if (remainder > 0) rowsConfig[rows - 1] = remainder;
    } else {
      // Fallback
      rowsConfig = [Math.ceil(count / 2), Math.floor(count / 2)];
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Load all images
    const loadedImages = await Promise.all(
      images.map(file => this.loadImageFromFile(file))
    );

    // Draw based on rowsConfig
    let currentImageIndex = 0;
    const rowHeight = canvasHeight / rowsConfig.length;

    for (let rowIndex = 0; rowIndex < rowsConfig.length; rowIndex++) {
      const itemsInRow = rowsConfig[rowIndex];
      const colWidth = canvasWidth / itemsInRow;
      const y = rowIndex * rowHeight;

      for (let colIndex = 0; colIndex < itemsInRow; colIndex++) {
        if (currentImageIndex >= loadedImages.length) break;

        const img = loadedImages[currentImageIndex];
        const label = variantLabels[currentImageIndex];
        const x = colIndex * colWidth;

        // CINEMATIC BLUR FIT LOGIC:

        // 1. Draw Blurred Background to cover everything (No white space)
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, colWidth, rowHeight);
        ctx.clip();

        // Calculate COVER scale for background to fill the cell
        const scaleCover = Math.max(colWidth / img.width, rowHeight / img.height);
        const wCover = img.width * scaleCover;
        const hCover = img.height * scaleCover;
        const xCover = x + (colWidth - wCover) / 2;
        const yCover = y + (rowHeight - hCover) / 2;

        ctx.filter = 'blur(40px)'; // Heavy blur to act as ambient background
        // Draw slightly larger to avoid edge bleeding
        ctx.drawImage(img, 0, 0, img.width, img.height, xCover - 20, yCover - 20, wCover + 40, hCover + 40);
        ctx.filter = 'none'; // Reset filter
        ctx.restore();

        // 2. Draw Main Image (CONTAIN/FIT) - Ensure FULL BODY is visible
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, colWidth, rowHeight);
        ctx.clip();

        // Calculate CONTAIN scale to show mostly everything
        // For fashion, we fit fully into the cell so nothing is cut.
        const scaleContain = Math.min(colWidth / img.width, rowHeight / img.height);
        const scale = scaleContain;

        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;

        // Center the image within the cell
        const drawX = x + (colWidth - scaledWidth) / 2;
        const drawY = y + (rowHeight - scaledHeight) / 2;

        // Draw main image sharp
        ctx.drawImage(img, 0, 0, img.width, img.height, drawX, drawY, scaledWidth, scaledHeight);
        ctx.restore();

        // Add border (inner white border for clean look)
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, colWidth, rowHeight);

        // Add Label (CENTERED)
        if (label) {
          this.drawLabelCentered(ctx, label, x, y, colWidth, rowHeight);
        }

        currentImageIndex++;
      }
    }

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

  // Helper for centered label
  private drawLabelCentered(
    ctx: CanvasRenderingContext2D,
    label: string,
    cellX: number,
    cellY: number,
    cellW: number,
    cellH: number
  ) {
    // JUMBO SIZE (2X Previous)
    const labelSize = 200; // Was 100

    // Calculate center of cell
    const centerX = cellX + cellW / 2;
    // Calculate center Y
    const centerY = cellY + cellH / 2;

    const x = centerX - (labelSize / 2);
    const y = centerY - (labelSize / 2);

    // Background with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 5;
    ctx.shadowOffsetY = 5;

    // Dark background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)'; // Semi-transparent black
    ctx.fillRect(x, y, labelSize, labelSize);

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // Text
    ctx.font = 'bold 130px Arial, sans-serif'; // Jumbo Font
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, centerX, centerY + 8); // +8 for visual centering

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 6;
    ctx.strokeRect(x, y, labelSize, labelSize);
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
  getCollageDimensions(_imageCount: number): { width: number; height: number } {
    // We now standardize on a high-res portrait canvas
    return {
      width: 1500,
      height: 2000
    };
  }
  // Restored for UI compatibility (AIAutoUploadModal uses it)
  getOptimalLayout(count: number): { rows: number; cols: number } {
    if (count <= 3) return { rows: 1, cols: count };
    if (count === 4) return { rows: 2, cols: 2 };
    if (count === 5) return { rows: 2, cols: 3 }; // Upper bound cols
    if (count === 6) return { rows: 2, cols: 3 };
    if (count === 7) return { rows: 2, cols: 4 };
    if (count === 8) return { rows: 2, cols: 4 };
    if (count === 9) return { rows: 3, cols: 3 };
    if (count === 10) return { rows: 3, cols: 4 };

    // Fallback
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  }
}

export const collageService = new CollageService();
