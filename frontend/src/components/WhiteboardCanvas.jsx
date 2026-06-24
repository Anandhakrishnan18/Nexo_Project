import { useEffect, useRef, useState } from "react";
import socket from "../socket";

function WhiteboardCanvas({ meetingId }) {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(5);
  const [isEraser, setIsEraser] = useState(false);

  // Normalization resolution
  const INTERNAL_WIDTH = 800;
  const INTERNAL_HEIGHT = 500;

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = INTERNAL_WIDTH;
    canvas.height = INTERNAL_HEIGHT;

    const context = canvas.getContext("2d");
    context.lineCap = "round";
    context.lineJoin = "round";
    contextRef.current = context;

    // Join the whiteboard room
    socket.emit("join-whiteboard", meetingId);

    // Listen to draw strokes from peers
    socket.on("draw", (data) => {
      drawSegment(
        data.x0,
        data.y0,
        data.x1,
        data.y1,
        data.color,
        data.lineWidth
      );
    });

    // Listen to clear event from peers
    socket.on("clear-board", () => {
      clearLocalCanvas();
    });

    return () => {
      socket.off("draw");
      socket.off("clear-board");
    };
  }, [meetingId]);

  const drawSegment = (x0, y0, x1, y1, strokeColor, strokeWidth) => {
    const ctx = contextRef.current;
    if (!ctx) return;

    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
    ctx.closePath();
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    // Scale coords to match the internal fixed dimensions (INTERNAL_WIDTH x INTERNAL_HEIGHT)
    const clientX = e.clientX || (e.touches && e.touches[0].clientX);
    const clientY = e.clientY || (e.touches && e.touches[0].clientY);

    const x = ((clientX - rect.left) / rect.width) * INTERNAL_WIDTH;
    const y = ((clientY - rect.top) / rect.height) * INTERNAL_HEIGHT;

    return { x, y };
  };

  // Ref tracking coordinates during active drawing loop
  const drawingState = useRef({ lastX: 0, lastY: 0 });

  const startDrawing = (e) => {
    // Prevent scrolling on mobile touches
    if (e.cancelable) e.preventDefault();

    const { x, y } = getCanvasCoords(e);
    drawingState.current = { lastX: x, lastY: y };
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();

    const { x, y } = getCanvasCoords(e);
    const { lastX, lastY } = drawingState.current;

    const strokeColor = isEraser ? "#ffffff" : color;
    
    // Draw locally
    drawSegment(lastX, lastY, x, y, strokeColor, lineWidth);

    // Sync to other users
    socket.emit("draw", {
      meetingId,
      x0: lastX,
      y0: lastY,
      x1: x,
      y1: y,
      color: strokeColor,
      lineWidth,
    });

    drawingState.current = { lastX: x, lastY: y };
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearLocalCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = contextRef.current;
    if (ctx && canvas) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const clearBoard = () => {
    clearLocalCanvas();
    socket.emit("clear-board", meetingId);
  };

  const colors = [
    { value: "#000000", label: "Black" },
    { value: "#ef4444", label: "Red" },
    { value: "#3b82f6", label: "Blue" },
    { value: "#10b981", label: "Green" },
    { value: "#f59e0b", label: "Orange" },
  ];

  return (
    <div className="whiteboard-wrapper" style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
      <div
        className="whiteboard-toolbar"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px",
          padding: "10px 15px",
          background: "#f1f5f9",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Colors */}
          {colors.map((c) => (
            <button
              key={c.value}
              onClick={() => {
                setColor(c.value);
                setIsEraser(false);
              }}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                background: c.value,
                border: color === c.value && !isEraser ? "3px solid #3b82f6" : "1px solid #94a3b8",
                cursor: "pointer",
                padding: 0,
                transform: color === c.value && !isEraser ? "scale(1.1)" : "none",
                transition: "transform 0.1s ease",
              }}
              title={c.label}
            />
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
          {/* Brush Size */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>Size:</span>
            <input
              type="range"
              min="2"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              style={{ cursor: "pointer", width: "80px" }}
            />
            <span style={{ fontSize: "12px", color: "#64748b", width: "15px" }}>{lineWidth}px</span>
          </div>

          {/* Toggle Eraser */}
          <button
            onClick={() => setIsEraser(!isEraser)}
            style={{
              background: isEraser ? "#3b82f6" : "white",
              color: isEraser ? "white" : "#475569",
              border: "1px solid #cbd5e1",
              padding: "6px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            🧹 {isEraser ? "Eraser On" : "Use Eraser"}
          </button>

          {/* Clear Board */}
          <button
            onClick={clearBoard}
            style={{
              background: "#ef4444",
              color: "white",
              border: "none",
              padding: "6px 12px",
              borderRadius: "8px",
              cursor: "pointer",
              fontWeight: "600",
              fontSize: "13px",
            }}
          >
            🗑️ Clear Board
          </button>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #cbd5e1",
          borderRadius: "16px",
          overflow: "hidden",
          background: "white",
          aspectRatio: "16/10",
          boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.05)",
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            cursor: isEraser ? "cell" : "crosshair",
            background: "#ffffff",
          }}
        />
      </div>
    </div>
  );
}

export default WhiteboardCanvas;
