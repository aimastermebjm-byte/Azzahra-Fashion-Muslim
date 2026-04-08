import React, { useState, useRef, useEffect, useCallback } from 'react';

// Common interface matches collageService Rect
export interface BoxRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

interface InteractiveCropperProps {
    images: string[]; // Blob URLs
    layoutBoxes: BoxRect[]; // Defines the size of each crop box. For gallery, just one array item, or array of individual identical boxes.
    containerWidth: number; // Viewport width for rendering
    containerHeight: number; // Viewport height for rendering
    labels?: string[]; // E.g. ['A', 'B'] for collage
    onChange?: (offsets: Record<number, { x: number, y: number }>, scales: Record<number, number>) => void;
    readOnly?: boolean;
}

interface ImageMeta {
    width: number;
    height: number;
    url: string;
}

export const InteractiveCropper: React.FC<InteractiveCropperProps> = ({
    images,
    layoutBoxes,
    containerWidth,
    containerHeight,
    labels,
    onChange,
    readOnly = false
}) => {
    const [metaData, setMetaData] = useState<Record<number, ImageMeta>>({});
    
    // x, y represents the translate value. It's stored in actual Canvas-scale pixels.
    const [offsets, setOffsets] = useState<Record<number, { x: number, y: number }>>({});
    const [scales, setScales] = useState<Record<number, number>>({});
    const [baseScales, setBaseScales] = useState<Record<number, number>>({});
    
    const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
    const lastMousePos = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
    const lastPinchDist = useRef<number | null>(null);

    // Load original image dimensions
    useEffect(() => {
        images.forEach((url, index) => {
            if (!metaData[index]) {
                const img = new Image();
                img.onload = () => {
                    const width = img.naturalWidth;
                    const height = img.naturalHeight;
                    setMetaData(prev => ({ ...prev, [index]: { width, height, url } }));
                    
                    // Initialize Scale and Offsets
                    const box = layoutBoxes[index];
                    if (box && width && height) {
                        // Default: pas (cover) tanpa zoom tambahan agar foto yang sudah bagus
                        // (misal 3:4) tidak perlu lagi digeser-geser.
                        const baseScale = Math.max(box.w / width, box.h / height);
                        const scale = baseScale; // Tidak ada zoom 25% default
                        
                        const scaledW = width * scale;
                        const scaledH = height * scale;
                        
                        // Default position
                        const initX = (box.w - scaledW) / 2;
                        // Khusus untuk fashion (gambar terlalu tinggi 9:16), kita posisikan agak ke atas (0.15)
                        // supaya kepala tidak gampang terpotong, tapi tidak nempel plafon juga
                        const initY = (box.h - scaledH) * 0.15;
                        
                        setBaseScales(prev => ({ ...prev, [index]: baseScale }));
                        setScales(prev => ({ ...prev, [index]: scale }));
                        setOffsets(prev => ({ ...prev, [index]: { x: initX, y: initY } }));
                    }
                };
                img.src = url;
            }
        });
    }, [images, layoutBoxes]);

    // Send data to parent when settled
    useEffect(() => {
        if (onChange && Object.keys(offsets).length > 0) {
            onChange(offsets, scales);
        }
    }, [offsets, scales]);

    const handlePointerDown = (index: number, clientX: number, clientY: number) => {
        if (readOnly) return;
        setDraggingIdx(index);
        lastMousePos.current = { x: clientX, y: clientY };
    };

    const handlePointerMove = useCallback((e: MouseEvent | TouchEvent, clientX: number, clientY: number) => {
        if (draggingIdx === null || readOnly) return;

        // --- Pinch to Zoom ---
        if (window.TouchEvent && e instanceof window.TouchEvent && e.touches.length === 2) {
            const touch1 = e.touches[0];
            const touch2 = e.touches[1];
            const dist = Math.hypot(touch1.clientX - touch2.clientX, touch1.clientY - touch2.clientY);

            if (lastPinchDist.current !== null) {
                const deltaScale = dist / lastPinchDist.current;
                
                let actualDeltaScale = 1;
                let nextScale = 1;
                
                setScales(prev => {
                    const currentScale = prev[draggingIdx] || 1;
                    const baseS = baseScales[draggingIdx] || 1;
                    
                    // Limit zoom out to baseScale (cover), max zoom in to 3x
                    let newScale = currentScale * deltaScale;
                    newScale = Math.max(baseS, Math.min(newScale, baseS * 3));
                    
                    actualDeltaScale = newScale / currentScale; // to avoid over-shifting if clamped
                    nextScale = newScale;
                    
                    return { ...prev, [draggingIdx]: newScale };
                });
                
                setOffsets(prev => {
                    const current = prev[draggingIdx] || { x: 0, y: 0 };
                    const box = layoutBoxes[draggingIdx];
                    const meta = metaData[draggingIdx];
                    if (!box || !meta) return prev;
                    
                    // Gunakan center of the IMAGE as focal point agar pembesaran 100% simetris
                    // (Kiri dan Kanan membesar dengan persentase/jarak yang sama persis)
                    const oldScale = scales[draggingIdx] || 1;
                    const currentScaledW = meta.width * oldScale;
                    const currentScaledH = meta.height * oldScale;
                    
                    const fx = current.x + currentScaledW / 2;
                    const fy = current.y + currentScaledH / 2;
                    
                    let newX = current.x + (fx - current.x) * (1 - actualDeltaScale);
                    let newY = current.y + (fy - current.y) * (1 - actualDeltaScale);
                    
                    // Clamping Rules agar tidak ada space kosong akibat zoom out
                    const scaledW = meta.width * nextScale;
                    const scaledH = meta.height * nextScale;
                    
                    const minX = box.w - scaledW;
                    const maxX = 0;
                    const minY = box.h - scaledH;
                    const maxY = 0;

                    newX = Math.max(minX, Math.min(maxX, newX));
                    newY = Math.max(minY, Math.min(maxY, newY));
                    
                    return { ...prev, [draggingIdx]: { x: newX, y: newY } };
                });
            }
            lastPinchDist.current = dist;
            
            // Adjust lastMousePos to center of pinch to prevent sudden jump after pinch
            lastMousePos.current = { 
               x: (touch1.clientX + touch2.clientX) / 2, 
               y: (touch1.clientY + touch2.clientY) / 2 
            };
            return;
        }

        // --- Drag ---
        if (window.TouchEvent && e instanceof window.TouchEvent && e.touches.length === 1) {
            lastPinchDist.current = null; // reset pinch
        }

        const deltaX = clientX - lastMousePos.current.x;
        const deltaY = clientY - lastMousePos.current.y;
        
        lastMousePos.current = { x: clientX, y: clientY };

        setOffsets(prev => {
            const current = prev[draggingIdx] || { x: 0, y: 0 };
            const box = layoutBoxes[draggingIdx];
            const meta = metaData[draggingIdx];
            const scale = scales[draggingIdx]; // scales are updated async, but drag doesn't change scale so it's fine.
            
            if (!box || !meta || scale === undefined) return prev;

            const scaledW = meta.width * scale;
            const scaledH = meta.height * scale;

            // Clamping rules
            const minX = box.w - scaledW;
            const maxX = 0;
            const minY = box.h - scaledH;
            const maxY = 0;

            const newX = Math.max(minX, Math.min(maxX, current.x + deltaX));
            const newY = Math.max(minY, Math.min(maxY, current.y + deltaY));

            return {
                ...prev,
                [draggingIdx]: { x: newX, y: newY }
            };
        });
    }, [draggingIdx, layoutBoxes, metaData, scales, baseScales, readOnly]);

    const handlePointerUp = () => {
        setDraggingIdx(null);
        lastPinchDist.current = null;
    };

    // Global listeners for dragging smoothly
    useEffect(() => {
        const onMouseMove = (e: MouseEvent) => handlePointerMove(e, e.clientX, e.clientY);
        const onTouchMove = (e: TouchEvent) => {
            // Mencegah scroll atau zoom layar browser saat mencubit/geser gambar di dalam editor
            if (e.cancelable) e.preventDefault();

            if (e.touches.length === 1) {
                handlePointerMove(e, e.touches[0].clientX, e.touches[0].clientY);
            } else if (e.touches.length === 2) {
                // pass center point for single signature (not used in pinch mode but required)
                const cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
                const cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
                handlePointerMove(e, cx, cy);
            }
        };
        
        const onEnd = () => handlePointerUp();

        if (draggingIdx !== null && !readOnly) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onEnd);
            window.addEventListener('touchmove', onTouchMove, { passive: false });
            window.addEventListener('touchend', onEnd);
            window.addEventListener('touchcancel', onEnd);
        }

        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onEnd);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('touchend', onEnd);
            window.removeEventListener('touchcancel', onEnd);
        };
    }, [draggingIdx, handlePointerMove, readOnly]);

    const containerRef = useRef<HTMLDivElement>(null);

    return (
        <div 
            ref={containerRef}
            className="relative select-none touch-none rounded-xl overflow-hidden shadow-sm"
            style={{ 
                width: containerWidth, 
                height: containerHeight,
                background: '#f8fafc', // subtle background to show container bounds
                border: '1px solid #e2e8f0'
            }}
        >
            {layoutBoxes.map((box, index) => {
                const meta = metaData[index];
                const off = offsets[index];
                const scale = scales[index];

                if (!meta || !off) return null;

                const scaledW = meta.width * scale;
                const scaledH = meta.height * scale;

                return (
                    <div 
                        key={index}
                        className={`absolute overflow-hidden ${!readOnly ? 'cursor-grab active:cursor-grabbing' : ''}`}
                        style={{
                            left: box.x,
                            top: box.y,
                            width: box.w,
                            height: box.h,
                            // Add a subtle border right and bottom for grids like collage
                            borderRight: box.x + box.w < containerWidth ? '2px solid white' : 'none',
                            borderBottom: box.y + box.h < containerHeight ? '2px solid white' : 'none'
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            handlePointerDown(index, e.clientX, e.clientY);
                        }}
                        onTouchStart={(e) => {
                            // Only prevent default if we intend to drag (handled carefully) to avoid blocking scrolling altogether
                            if (!readOnly) {
                                // e.preventDefault(); // Prevents scroll, but we do this selectively
                                handlePointerDown(index, e.touches[0].clientX, e.touches[0].clientY);
                            }
                        }}
                    >
                        {/* The Draggable Image */}
                        <img 
                            src={meta.url}
                            alt={`Preview ${index}`}
                            draggable={false} // Disable native HTML image dragging
                            style={{
                                position: 'absolute',
                                left: 0,
                                top: 0,
                                width: scaledW,
                                height: scaledH,
                                transform: `translate(${off.x}px, ${off.y}px)`,
                                transformOrigin: 'top left',
                                willChange: 'transform' // Hardware acceleration
                            }}
                        />

                        {/* Collage Label */}
                        {labels && labels[index] && (
                            <div className="absolute top-2 left-2 bg-black/70 text-white text-[10px] sm:text-xs px-2 py-1 rounded font-bold shadow-sm pointer-events-none z-10">
                                {labels[index]}
                            </div>
                        )}
                        
                        {/* Drag Hint (only shows briefly or on hover if needed, or we just rely on intuitive UX) */}
                        {!readOnly && (
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/10 pointer-events-none">
                                <div className="bg-black/50 text-white backdrop-blur-sm px-2 py-1 rounded text-[10px] flex items-center gap-1 font-medium">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                                    </svg>
                                    Geser
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
