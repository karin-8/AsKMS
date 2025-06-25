import { useState, useRef, useCallback, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ResizableDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  defaultWidth?: string;
  defaultHeight?: string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: string;
  maxHeight?: string;
  children: React.ReactNode;
  className?: string;
}

export function ResizableDialog({
  open,
  onOpenChange,
  title,
  defaultWidth = "60%",
  defaultHeight = "70%",
  minWidth = 400,
  minHeight = 300,
  maxWidth = "95%",
  maxHeight = "95%",
  children,
  className,
}: ResizableDialogProps) {
  const [size, setSize] = useState({ width: defaultWidth, height: defaultHeight });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string>("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const startSizeRef = useRef({ width: 0, height: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    setIsResizing(true);
    setResizeHandle(handle);
    
    const rect = dialogRef.current?.getBoundingClientRect();
    if (rect) {
      startPosRef.current = { x: e.clientX, y: e.clientY };
      startSizeRef.current = { width: rect.width, height: rect.height };
    }
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !dialogRef.current) return;

    const deltaX = e.clientX - startPosRef.current.x;
    const deltaY = e.clientY - startPosRef.current.y;
    
    let newWidth = startSizeRef.current.width;
    let newHeight = startSizeRef.current.height;

    if (resizeHandle.includes('right')) {
      newWidth = Math.max(minWidth, startSizeRef.current.width + deltaX);
    }
    if (resizeHandle.includes('left')) {
      newWidth = Math.max(minWidth, startSizeRef.current.width - deltaX);
    }
    if (resizeHandle.includes('bottom')) {
      newHeight = Math.max(minHeight, startSizeRef.current.height + deltaY);
    }
    if (resizeHandle.includes('top')) {
      newHeight = Math.max(minHeight, startSizeRef.current.height - deltaY);
    }

    // Convert to viewport units for responsive behavior
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    
    const widthPercent = Math.min(95, (newWidth / vw) * 100);
    const heightPercent = Math.min(95, (newHeight / vh) * 100);

    setSize({
      width: `${widthPercent}%`,
      height: `${heightPercent}%`
    });
  }, [isResizing, resizeHandle, minWidth, minHeight]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeHandle("");
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = getResizeCursor(resizeHandle);
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp, resizeHandle]);

  const getResizeCursor = (handle: string) => {
    if (handle.includes('top') && handle.includes('left')) return 'nw-resize';
    if (handle.includes('top') && handle.includes('right')) return 'ne-resize';
    if (handle.includes('bottom') && handle.includes('left')) return 'sw-resize';
    if (handle.includes('bottom') && handle.includes('right')) return 'se-resize';
    if (handle.includes('top') || handle.includes('bottom')) return 'ns-resize';
    if (handle.includes('left') || handle.includes('right')) return 'ew-resize';
    return 'default';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={dialogRef}
        className={cn(
          "sm:max-w-none max-h-none overflow-hidden",
          className
        )}
        style={{
          width: size.width,
          height: size.height,
          maxWidth: maxWidth,
          maxHeight: maxHeight,
          position: 'relative'
        }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {children}
        </div>

        {/* Resize handles */}
        <div
          className="absolute top-0 left-0 w-2 h-2 cursor-nw-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'top-left')}
        />
        <div
          className="absolute top-0 right-0 w-2 h-2 cursor-ne-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'top-right')}
        />
        <div
          className="absolute bottom-0 left-0 w-2 h-2 cursor-sw-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'bottom-left')}
        />
        <div
          className="absolute bottom-0 right-0 w-2 h-2 cursor-se-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'bottom-right')}
        />
        <div
          className="absolute top-0 left-2 right-2 h-1 cursor-ns-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'top')}
        />
        <div
          className="absolute bottom-0 left-2 right-2 h-1 cursor-ns-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'bottom')}
        />
        <div
          className="absolute left-0 top-2 bottom-2 w-1 cursor-ew-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'left')}
        />
        <div
          className="absolute right-0 top-2 bottom-2 w-1 cursor-ew-resize bg-transparent"
          onMouseDown={(e) => handleMouseDown(e, 'right')}
        />

        {/* Visual resize indicator in bottom-right corner */}
        <div className="absolute bottom-1 right-1 w-3 h-3 opacity-30">
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            className="text-gray-400"
          >
            <path
              d="M12 12L0 12L12 0Z"
              fill="currentColor"
            />
            <path
              d="M8 12L12 8L12 12Z"
              fill="currentColor"
            />
            <path
              d="M4 12L12 4L12 12Z"
              fill="currentColor"
            />
          </svg>
        </div>
      </DialogContent>
    </Dialog>
  );
}