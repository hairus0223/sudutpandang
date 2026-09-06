import React, { useRef } from "react";
import { PASSPORT_BUST_PATH } from "../lib/passportPose.js";
import { usePassportPose } from "../hooks/usePassportPose.js";

/**
 * @param {object} props
 * @param {string | null | undefined} props.color
 * @param {boolean} [props.visible]
 * @param {React.RefObject<HTMLVideoElement> | null} [props.videoRef]
 */
export function PassportGuideOverlay({ color, visible = true, videoRef = null }) {
  const overlayRef = useRef(null);
  const pose = usePassportPose(videoRef, overlayRef, visible && Boolean(videoRef));

  if (!visible) return null;
  const aligned = pose.ok;
  const stroke = aligned ? "#22c55e" : "#ef4444";
  const frameStroke = aligned ? "#22c55e" : color || "#438CCB";

  return (
    <div className="pas-photo-frame" aria-hidden="true">
      <div
        ref={overlayRef}
        className={`pas-photo-inner${aligned ? " pas-photo-inner--ok" : " pas-photo-inner--wait"}`}
        style={{ borderColor: frameStroke }}
      >
        <svg viewBox="0 0 300 400" className="pas-photo-guide">
          <path
            d={`M0 0 H300 V400 H0 Z ${PASSPORT_BUST_PATH}`}
            fillRule="evenodd"
            fill="rgba(0,0,0,0.48)"
          />
          <path
            d={PASSPORT_BUST_PATH}
            fill="none"
            stroke={stroke}
            strokeWidth="4.5"
            strokeLinejoin="round"
          />
          <line
            x1="48"
            y1="138"
            x2="252"
            y2="138"
            stroke={aligned ? "rgba(34,197,94,0.9)" : "rgba(232,200,114,0.92)"}
            strokeWidth="2.2"
            strokeDasharray="6 5"
          />
        </svg>
        <div
          className={`pas-photo-status${aligned ? " pas-photo-status--ok" : " pas-photo-status--wait"}`}
        >
          <span className="pas-photo-status-dot" />
          {pose.hint}
        </div>
      </div>
    </div>
  );
}
