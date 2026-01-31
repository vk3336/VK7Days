import React from "react";

export default function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  const handleOverlayClick = (e) => {
    console.log("Modal: Overlay clicked"); // Debug log
    onClose();
  };

  const handleModalClick = (e) => {
    console.log("Modal: Modal content clicked"); // Debug log
    e.stopPropagation();
  };

  return (
    <div className="modalOverlay" onMouseDown={handleOverlayClick} role="presentation">
      <div className="modal" onMouseDown={handleModalClick}>
        <div className="modalHeader">
          <div className="modalTitle">{title}</div>
          <button className="iconBtn" type="button" onClick={onClose}>✕</button>
        </div>
        <div className="modalBody">{children}</div>
      </div>
    </div>
  );
}
