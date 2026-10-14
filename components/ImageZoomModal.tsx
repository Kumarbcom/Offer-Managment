import React, { useState, useEffect } from 'react';

interface ImageZoomModalProps {
    imageUrl: string;
    partNo?: string;
    description?: string;
    onClose: () => void;
}

export const ImageZoomModal: React.FC<ImageZoomModalProps> = ({ imageUrl, partNo, description, onClose }) => {
    const [zoom, setZoom] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
            if (e.key === '+' || e.key === '=') setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)));
            if (e.key === '-' || e.key === '_') setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)));
            if (e.key === '0') { setZoom(1); setPosition({ x: 0, y: 0 }); }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        if (e.deltaY < 0) {
            setZoom(z => Math.min(4, +(z + 0.2).toFixed(2)));
        } else {
            setZoom(z => Math.max(0.5, +(z - 0.2).toFixed(2)));
        }
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (zoom > 1) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    const resetZoom = () => {
        setZoom(1);
        setPosition({ x: 0, y: 0 });
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xs select-none no-print print:hidden p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl max-w-3xl w-full flex flex-col overflow-hidden max-h-[90vh]"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50">
                    <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-base">{partNo || 'Product Image'}</span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold">
                                {Math.round(zoom * 100)}%
                            </span>
                        </div>
                        {description && (
                            <p className="text-xs text-slate-500 truncate mt-0.5" title={description}>{description}</p>
                        )}
                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => setZoom(z => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-base font-bold shadow-xs active:scale-95"
                            title="Zoom Out (-)"
                        >
                            −
                        </button>
                        <button
                            type="button"
                            onClick={resetZoom}
                            className="px-2.5 h-8 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 shadow-xs active:scale-95"
                            title="Reset Zoom (0)"
                        >
                            Reset
                        </button>
                        <button
                            type="button"
                            onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))}
                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 text-base font-bold shadow-xs active:scale-95"
                            title="Zoom In (+)"
                        >
                            +
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 ml-2 flex items-center justify-center rounded-lg bg-slate-200 text-slate-700 hover:bg-red-500 hover:text-white font-bold transition-colors"
                            title="Close (Esc)"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Image Viewport */}
                <div 
                    className="relative flex-1 min-h-[350px] max-h-[65vh] overflow-hidden flex items-center justify-center bg-slate-900/5 p-6"
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    style={{ cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default' }}
                >
                    <img 
                        src={imageUrl} 
                        alt={partNo || 'Product'} 
                        draggable={false}
                        className="max-h-[60vh] max-w-full object-contain transition-transform duration-75 select-none"
                        style={{
                            transform: `scale(${zoom}) translate(${position.x / zoom}px, ${position.y / zoom}px)`,
                            transformOrigin: 'center center'
                        }}
                        onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                        }}
                    />
                </div>

                {/* Footer hints */}
                <div className="px-5 py-2.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between">
                    <span>💡 Scroll mouse wheel or use +/- to zoom. Drag to pan when zoomed in.</span>
                    <button
                        type="button"
                        onClick={() => {
                            const link = document.createElement('a');
                            link.href = imageUrl;
                            link.download = `${partNo || 'product'}_image.jpg`;
                            link.click();
                        }}
                        className="text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                        Download Image
                    </button>
                </div>
            </div>
        </div>
    );
};
