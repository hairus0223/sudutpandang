import React, { useRef } from "react";
import { PASSPORT_TARGET } from "../lib/passportPose.js";
import { usePassportPose } from "../hooks/usePassportPose.js";

function poseStroke(aligned, match) {
  if (aligned) return "rgba(52, 211, 153, 0.95)";
  if ((match || 0) >= 58) return "rgba(251, 191, 36, 0.9)";
  return "rgba(248, 113, 113, 0.88)";
}

function PassportFigure({ liveHead, aligned, match }) {
  const tx = PASSPORT_TARGET.headCx * 300;
  const ty = PASSPORT_TARGET.headCy * 400;
  const trx = (PASSPORT_TARGET.headW / 2) * 300;
  const tryR = (PASSPORT_TARGET.headH / 2) * 400;
  const eyeY = PASSPORT_TARGET.eyeY * 400;
  const neckTop = ty + tryR - 4;
  const stroke = poseStroke(aligned, match);
  const shoulder = `M ${tx - 26} ${neckTop}
    C ${tx - 24} ${neckTop + 26}, ${tx - 56} ${neckTop + 50}, ${tx - 118} ${neckTop + 66}
    C ${tx - 150} ${neckTop + 82}, 12 358, 8 400
    L 292 400
    C 288 358, ${tx + 150} ${neckTop + 82}, ${tx + 118} ${neckTop + 66}
    C ${tx + 56} ${neckTop + 50}, ${tx + 24} ${neckTop + 26}, ${tx + 26} ${neckTop} Z`;

  return (
    <svg viewBox="0 0 300 400" className="pas-photo-guide">
      <defs>
        <mask id="pasBustHole">
          <rect width="300" height="400" fill="white" />
          <ellipse cx={tx} cy={ty} rx={trx} ry={tryR} fill="black" />
          <path d={shoulder} fill="black" />
        </mask>
      </defs>

      <rect
        width="300"
        height="400"
        fill="rgba(0,0,0,0.42)"
        mask="url(#pasBustHole)"
      />

      <ellipse
        cx={tx}
        cy={ty}
        rx={trx}
        ry={tryR}
        fill="none"
        stroke={stroke}
        strokeWidth="1.35"
      />
      <path d={shoulder} fill="none" stroke={stroke} strokeWidth="1.2" />

      <line
        x1={tx - trx + 14}
        y1={eyeY}
        x2={tx + trx - 14}
        y2={eyeY}
        stroke="rgba(250, 204, 21, 0.75)"
        strokeWidth="1.1"
        strokeDasharray="4 5"
      />

      {liveHead ? (
        <ellipse
          cx={liveHead.cx * 300}
          cy={liveHead.cy * 400}
          rx={(liveHead.w / 2) * 300}
          ry={(liveHead.h / 2) * 400}
          fill="none"
          stroke="rgba(255,255,255,0.55)"
          strokeWidth="1"
          strokeDasharray="4 5"
        />
      ) : null}
    </svg>
  );
}

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
  const near = !aligned && (pose.match || 0) >= 58;
  const frame = aligned ? "rgba(52, 211, 153, 0.85)" : color || "rgba(255,255,255,0.35)";

  return (
    <div className="pas-photo-frame">
      <div
        ref={overlayRef}
        className={`pas-photo-inner${aligned ? " is-ok" : near ? " is-near" : " is-wait"}`}
        style={{ borderColor: frame }}
      >
        <PassportFigure liveHead={pose.head} aligned={aligned} match={pose.match} />
        <div className="pas-photo-meter" aria-hidden="true">
          <div
            className={`pas-photo-meter-fill${aligned ? " is-ok" : near ? " is-near" : ""}`}
            style={{ width: `${pose.match || 0}%` }}
          />
        </div>
        <div
          className={`pas-photo-status${aligned ? " is-ok" : near ? " is-near" : " is-wait"}`}
        >
          {pose.hint}
        </div>
      </div>
    </div>
  );
}
