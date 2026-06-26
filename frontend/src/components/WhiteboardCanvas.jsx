import { useCallback, useState } from "react";
import { Tldraw, DefaultToolbar, DefaultStylePanel } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import socket from "../socket";

const CustomToolbar = () => {
  const [showStyles, setShowStyles] = useState(false);

  return (
    <div 
      className="custom-whiteboard-toolbar"
      style={{ 
        display: "flex", 
        alignItems: "center", 
        gap: "12px", 
        pointerEvents: "all",
        background: "var(--bg-dark)",
        padding: "6px 12px",
        borderRadius: "16px",
        border: "1px solid var(--border)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        position: "relative"
      }}
    >
      <DefaultToolbar />
      
      <div style={{ width: "1px", height: "24px", background: "var(--border)" }} />

      <button
        onClick={() => setShowStyles(!showStyles)}
        style={{
          background: showStyles ? "var(--primary)" : "transparent",
          color: showStyles ? "white" : "var(--text-main)",
          border: "1px solid " + (showStyles ? "var(--primary)" : "var(--border)"),
          padding: "8px 16px",
          borderRadius: "10px",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "14px",
          transition: "all 0.2s ease",
          display: "flex",
          alignItems: "center",
          gap: "6px"
        }}
      >
        🎨 Styles
      </button>

      {showStyles && (
        <>
          <div 
            onClick={() => setShowStyles(false)} 
            style={{ position: 'fixed', inset: 0, zIndex: 99998, cursor: 'default' }} 
          />
          <div 
            className="custom-style-popover"
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginTop: "12px",
              background: "var(--bg-darker)",
              padding: "16px",
              borderRadius: "16px",
              border: "1px solid var(--border)",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.6)",
              zIndex: 99999,
            }}
          >
            <DefaultStylePanel />
          </div>
        </>
      )}
    </div>
  );
};

function WhiteboardCanvas({ meetingId }) {
  const handleMount = useCallback((editor) => {
    socket.emit("join-whiteboard", meetingId);

    // Listen for local changes and emit to peers
    const cleanup = editor.store.listen(
      (update) => {
        if (update.source === "user") {
          socket.emit("draw", {
            meetingId,
            changes: update.changes,
          });
        }
      },
      { source: "user", scope: "document" } // Only sync document changes (shapes, layers, etc.)
    );

    // Listen for remote changes
    const onRemoteDraw = (data) => {
      if (data.changes) {
        editor.store.mergeRemoteChanges(() => {
          const { added, updated, removed } = data.changes;
          
          if (added && Object.keys(added).length > 0) {
            editor.store.put(Object.values(added));
          }
          if (updated && Object.keys(updated).length > 0) {
            // Updated records are in the format { [id]: [oldRecord, newRecord] }
            const updatedRecords = Object.values(updated).map((arr) => arr[1]);
            editor.store.put(updatedRecords);
          }
          if (removed && Object.keys(removed).length > 0) {
            editor.store.remove(Object.values(removed).map((r) => r.id));
          }
        });
      }
    };

    // The old canvas used this to clear everything. 
    // We can support it by deleting all shapes on the current page.
    const onClearBoard = () => {
      const allShapeIds = Array.from(editor.getCurrentPageShapeIds());
      if (allShapeIds.length > 0) {
        editor.store.mergeRemoteChanges(() => {
          editor.deleteShapes(allShapeIds);
        });
      }
    };

    socket.on("draw", onRemoteDraw);
    socket.on("clear-board", onClearBoard);

    return () => {
      cleanup();
      socket.off("draw", onRemoteDraw);
      socket.off("clear-board", onClearBoard);
    };
  }, [meetingId]);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Tldraw 
        onMount={handleMount} 
        components={{
          TopPanel: () => (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', pointerEvents: 'none', marginTop: '16px' }}>
              <CustomToolbar />
            </div>
          ),
          Toolbar: () => null,
          StylePanel: () => null,
          PageMenu: () => null,
          NavigationPanel: () => null,
        }}
      />
    </div>
  );
}

export default WhiteboardCanvas;
