import React from "react";

export default function DayTabs({ days, activeDay, onChange }) {
  return (
    <div className="dayTabs">
      {days.map((d) => (
        <button
          key={d.key}
          type="button"
          className={`chip ${activeDay === d.key ? "chipActive" : ""}`}
          onClick={() => onChange(d.key)}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
