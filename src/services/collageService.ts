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
    const canvasSize = 2000; // High-Res Square

    // Determine layout configuration (items per row)
    let rowsConfig: number[] = [];
    if (count <= 5) {
      rowsConfig = [count]; // Single row
    } else if (count === 6) {
      rowsConfig = [3, 3];
    } else if (count === 7) {
      rowsConfig = [4, 3];
    } else if (count === 8) {
      rowsConfig = [4, 4];
    } else if (count === 9) {
      rowsConfig = [5, 4];
    } else if (count === 10) {
      rowsConfig = [5, 5];
    } else {
      // Fallback for > 10 (or standard grid logic)
      const cols = Math.ceil(Math.sqrt(count));
      const rows = Math.ceil(count / cols);
      rowsConfig = Array(rows).fill(cols);
      // Adjust last row
      const remainder = count % cols;
      if (remainder > 0) rowsConfig[rows - 1] = remainder;
    }

    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
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
    const rowHeight = canvasSize / rowsConfig.length;

    for (let rowIndex = 0; rowIndex < rowsConfig.length; rowIndex++) {
      const itemsInRow = rowsConfig[rowIndex];
      const colWidth = canvasSize / itemsInRow;
      const y = rowIndex * rowHeight;

      for (let colIndex = 0; colIndex < itemsInRow; colIndex++) {
        if (currentImageIndex >= loadedImages.length) break;

        const img = loadedImages[currentImageIndex];
        const label = variantLabels[currentImageIndex];
        const x = colIndex * colWidth;

        // Save context for clipping
        ctx.save();

        // Define clipping region for this cell
        ctx.beginPath();
        ctx.rect(x, y, colWidth, rowHeight);
        ctx.clip();

        // Smart SCALING: Fill the cell (Cover)
        // Scale to match the dimension that ensures coverage
        // Try filling Height first
        let scale = rowHeight / img.height;
        let scaledWidth = img.width * scale;
        let scaledHeight = rowHeight;

        // If scaled width is still too small to cover the cell, scale by Width instead
        if (scaledWidth < colWidth) {
          scale = colWidth / img.width;
          scaledWidth = colWidth;
          scaledHeight = img.height * scale;
        }

        // Centering
        const drawX = x + (colWidth - scaledWidth) / 2;
        const drawY = y + (rowHeight - scaledHeight) / 2;

        ctx.drawImage(img, 0, 0, img.width, img.height, drawX, drawY, scaledWidth, scaledHeight);

        // Restore context
        ctx.restore();

        // Add border
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 2;
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
      }, 'image/jpeg', 0.9);
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
    const labelSize = 80;

    // Calculate center of cell
    const centerX = cellX + cellW / 2;
    // Calculate center Y
    const centerY = cellY + cellH / 2;

    const x = centerX - (labelSize / 2);
    const y = centerY - (labelSize / 2);

    // Background with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    // Dark background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, labelSize, labelSize);

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
    ctx.fillText(label, centerX, centerY);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 2;
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
  getCollageDimensions(imageCount: number): { width: number; height: number } {
    // We now standardize on a high-res square canvas
    return {
      width: 2000,
      height: 2000
    };
  }
  // Restored for UI compatibility (AIAutoUploadModal uses it)
  getOptimalLayout(count: number): { rows: number; cols: number } {
    if (count <= 5) return { rows: 1, cols: count };
    if (count === 6) return { rows: 2, cols: 3 };
    if (count === 7) return { rows: 2, cols: 4 }; // Approximate max cols
    if (count === 8) return { rows: 2, cols: 4 };
    if (count === 9) return { rows: 2, cols: 5 };
    if (count === 10) return { rows: 2, cols: 5 };

    // Fallback
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    return { rows, cols };
  }
}

export const collageService = new CollageService();
