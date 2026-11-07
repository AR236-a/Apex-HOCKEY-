import React, { useEffect, useRef, useState } from 'react';
import { HockeyTeam, JerseySkin } from '../data/teamsAndJerseys';
import {
  CORNER_RADIUS,
  CREASE_RADIUS,
  GOAL_LINE_X_LEFT,
  GOAL_LINE_X_RIGHT,
  GOAL_Y_BOTTOM,
  GOAL_Y_TOP,
  MatchHighlightSummary,
  RINK_HEIGHT,
  RINK_WIDTH,
} from '../game/physics';

interface MatchReplayModalProps {
  summary: MatchHighlightSummary;
  homeTeam: HockeyTeam;
  awayTeam: HockeyTeam;
  homeJersey: JerseySkin;
  onClose: () => void;
  onPlayAgain: () => void;
}

export const MatchReplayModal: React.FC<MatchReplayModalProps> = ({
  summary,
  homeTeam,
  awayTeam,
  homeJersey,
  onClose,
  onPlayAgain,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<0.5 | 1 | 2>(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeClip = summary.highlights[selectedIndex] || summary.highlights[0];
  const totalFrames = activeClip ? Math.max(1, activeClip.frames.length) : 1;

  // Advance frames at a smooth, screenshot-friendly cadence
  useEffect(() => {
    if (!isPlaying || !activeClip || activeClip.frames.length <= 1) return;
    const intervalMs = playbackSpeed === 2 ? 45 : playbackSpeed === 0.5 ? 160 : 85;
    const timer = window.setTimeout(() => {
      setFrameIndex(prev => (prev + 1) % activeClip.frames.length);
    }, intervalMs);
    return () => window.clearTimeout(timer);
  }, [isPlaying, frameIndex, activeClip, playbackSpeed]);

  // Draw the current replay frame onto the 2D broadcast replay canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeClip) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const frame =
      activeClip.frames[Math.min(frameIndex, activeClip.frames.length - 1)] ||
      activeClip.frames[0];
    if (!frame) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.save();
    ctx.fillStyle = '#060B16';
    ctx.fillRect(0, 0, w, h);

    const padX = 24;
    const padY = 24;
    const scale = Math.min((w - padX * 2) / RINK_WIDTH, (h - padY * 2) / RINK_HEIGHT);
    const ox = (w - RINK_WIDTH * scale) / 2;
    const oy = (h - RINK_HEIGHT * scale) / 2;

    ctx.translate(ox, oy);
    ctx.scale(scale, scale);

    // Draw ice surface
    drawRoundedRectPath(ctx, 0, 0, RINK_WIDTH, RINK_HEIGHT, CORNER_RADIUS);
    ctx.fillStyle = '#E2E8F0';
    ctx.fill();
    ctx.save();
    ctx.clip();

    // Goal lines & blue lines
    ctx.fillStyle = 'rgba(220, 38, 38, 0.55)';
    ctx.fillRect(GOAL_LINE_X_LEFT - 2, 0, 4, RINK_HEIGHT);
    ctx.fillRect(GOAL_LINE_X_RIGHT - 2, 0, 4, RINK_HEIGHT);

    ctx.fillStyle = 'rgba(37, 99, 235, 0.55)';
    ctx.fillRect(RINK_WIDTH * 0.34, 0, 7, RINK_HEIGHT);
    ctx.fillRect(RINK_WIDTH * 0.66 - 7, 0, 7, RINK_HEIGHT);

    ctx.fillStyle = 'rgba(220, 38, 38, 0.65)';
    ctx.fillRect(RINK_WIDTH / 2 - 4, 0, 8, RINK_HEIGHT);

    // Center circle
    ctx.strokeStyle = 'rgba(37, 99, 235, 0.55)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(RINK_WIDTH / 2, RINK_HEIGHT / 2, 78, 0, Math.PI * 2);
    ctx.stroke();

    // Goal creases
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.beginPath();
    ctx.arc(GOAL_LINE_X_LEFT, RINK_HEIGHT / 2, CREASE_RADIUS, -Math.PI / 2, Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(GOAL_LINE_X_RIGHT, RINK_HEIGHT / 2, CREASE_RADIUS, Math.PI / 2, -Math.PI / 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();

    // Rink boards border
    drawRoundedRectPath(ctx, 0, 0, RINK_WIDTH, RINK_HEIGHT, CORNER_RADIUS);
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#334155';
    ctx.stroke();

    // Highlight Event Target Reticle on the Ice
    const eventColor =
      activeClip.type === 'GOAL'
        ? '#FACC15'
        : activeClip.type === 'HEAVY_HIT'
        ? '#F43F5E'
        : activeClip.type === 'SAVE'
        ? '#10B981'
        : '#38BDF8';

    ctx.save();
    ctx.strokeStyle = eventColor;
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(activeClip.eventX, activeClip.eventY, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Draw trajectory trail across frames up to frameIndex
    if (frameIndex > 0) {
      ctx.save();
      ctx.strokeStyle = eventColor;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.65;
      ctx.beginPath();
      for (let i = Math.max(0, frameIndex - 8); i <= frameIndex; i++) {
        const pf = activeClip.frames[i];
        if (!pf) continue;
        if (i === Math.max(0, frameIndex - 8)) ctx.moveTo(pf.puckX, pf.puckY);
        else ctx.lineTo(pf.puckX, pf.puckY);
      }
      ctx.stroke();
      ctx.restore();
    }

    const useCustomJersey = homeJersey.teamId === homeTeam.id;
    const homePrimary = useCustomJersey ? homeJersey.primaryColor : homeTeam.primaryColor;
    const homeSecondary = useCustomJersey ? homeJersey.secondaryColor : homeTeam.secondaryColor;
    const homeTrim = useCustomJersey ? homeJersey.trimColor : homeTeam.trimColor;

    // Draw skaters
    for (const s of frame.skaters) {
      const isHome = s.team === 'HOME';
      const isActor = s.number === activeClip.actorNumber && s.team === activeClip.team;
      const primary = isHome ? homePrimary : awayTeam.primaryColor;
      const secondary = isHome ? homeSecondary : awayTeam.secondaryColor;
      const trim = isHome ? homeTrim : awayTeam.trimColor;

      if (isActor) {
        ctx.save();
        ctx.strokeStyle = eventColor;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(s.x, s.y, 26, 0, Math.PI * 2);
        ctx.stroke();

        // Spotlight label above featured highlight actor
        ctx.fillStyle = '#0F172A';
        ctx.fillRect(s.x - 38, s.y - 40, 76, 15);
        ctx.fillStyle = eventColor;
        ctx.font = '800 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`★ #${s.number}`, s.x, s.y - 32.5);
        ctx.restore();
      }

      // Skater body
      ctx.fillStyle = primary;
      ctx.strokeStyle = trim;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Secondary stripe
      ctx.fillStyle = secondary;
      ctx.fillRect(s.x - 13, s.y - 4, 26, 8);

      // Jersey number
      ctx.fillStyle = primary === '#FFFFFF' || secondary === '#FFFFFF' ? '#0F172A' : '#FFFFFF';
      ctx.font = '800 11px "Barlow Condensed", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(s.number), s.x, s.y + 1);
    }

    // Draw puck
    ctx.fillStyle = '#090D16';
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(frame.puckX, frame.puckY, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }, [activeClip, frameIndex, homeTeam, awayTeam, homeJersey]);

  const selectClip = (idx: number) => {
    setSelectedIndex(idx);
    setFrameIndex(0);
    setIsPlaying(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Match Highlight Replay Viewer"
      data-testid="match-replay-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#040710]/92 pointer-events-auto"
    >
      <div className="w-full max-w-6xl max-h-[90vh] bg-[#0B1221] border border-slate-800 rounded-xl shadow-2xl flex flex-col overflow-hidden">
        {/* Top Broadcast Replay Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 bg-[#080E1A] border-b border-slate-800">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-rose-600 text-white text-[11px] font-extrabold font-mono-tabular uppercase tracking-wider">
              ● INSTANT REPLAY
            </span>
            <div>
              <h2 className="text-xl font-extrabold font-display uppercase tracking-wide text-white">
                {summary.headline}
              </h2>
              <p className="text-xs text-slate-400">
                Generated from simulation telemetry · {summary.highlights.length} Highlight Moments
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onPlayAgain}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider bg-sky-500 hover:bg-sky-400 text-slate-950 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Play Rematch
            </button>
            <button
              type="button"
              data-testid="close-replay-btn"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Back to Match Summary
            </button>
          </div>
        </div>

        {/* Main Body: Left 2D Simulation Replay Player + Right Highlight Reel & 3 Stars */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT COLUMN (7 cols): Animated 2D Rink Replay Player & Scrubber */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-[#060B16]">
              {/* Broadcast Overlay Banner inside Replay Viewport */}
              {activeClip && (
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#080F1E]/95 border-b border-slate-800 text-xs font-mono-tabular">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-extrabold uppercase text-[10px] ${
                        activeClip.type === 'GOAL'
                          ? 'bg-amber-400 text-slate-950'
                          : activeClip.type === 'HEAVY_HIT'
                          ? 'bg-rose-500 text-white'
                          : activeClip.type === 'SAVE'
                          ? 'bg-emerald-400 text-slate-950'
                          : 'bg-sky-400 text-slate-950'
                      }`}
                    >
                      {activeClip.type.replace('_', ' ')}
                    </span>
                    <span className="font-bold text-white">{activeClip.headline}</span>
                  </div>
                  <div className="text-slate-300">
                    <span>{activeClip.clockLabel}</span>
                    <span aria-hidden="true"> · </span>
                    <span className="text-sky-400 font-bold">
                      {homeTeam.code} {activeClip.homeScoreAfter} – {activeClip.awayScoreAfter}{' '}
                      {awayTeam.code}
                    </span>
                  </div>
                </div>
              )}

              <canvas
                ref={canvasRef}
                width={720}
                height={360}
                data-testid="replay-rink-canvas"
                className="w-full h-auto block"
              />

              {/* Active Clip Caption Bar */}
              {activeClip && (
                <div className="px-4 py-2.5 bg-[#080F1E]/95 border-t border-slate-800 flex items-center justify-between gap-4">
                  <p className="text-xs text-slate-200">{activeClip.description}</p>
                  <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
                    Frame {frameIndex + 1} / {totalFrames}
                  </span>
                </div>
              )}
            </div>

            {/* Playback Transport Controls & Timeline Scrubber */}
            <div className="p-3.5 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3">
              {/* Scrubber Slider */}
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-mono-tabular text-slate-400">Timeline</span>
                <input
                  type="range"
                  aria-label="Replay Frame Scrubber"
                  min={0}
                  max={Math.max(0, totalFrames - 1)}
                  value={Math.min(frameIndex, Math.max(0, totalFrames - 1))}
                  onChange={e => {
                    setIsPlaying(false);
                    setFrameIndex(Number(e.target.value));
                  }}
                  className="flex-1 accent-sky-400 cursor-pointer"
                />
                <span className="text-[11px] font-mono-tabular text-sky-400">
                  Clip {selectedIndex + 1} of {summary.highlights.length}
                </span>
              </div>

              {/* Transport Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    data-testid="replay-play-pause"
                    onClick={() => setIsPlaying(p => !p)}
                    className="px-4 py-1.5 rounded-md bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    {isPlaying ? 'Pause Replay' : 'Play Replay'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      selectClip(
                        (selectedIndex - 1 + summary.highlights.length) %
                          summary.highlights.length
                      )
                    }
                    className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    ◀ Prev Highlight
                  </button>
                  <button
                    type="button"
                    data-testid="replay-next-clip"
                    onClick={() => selectClip((selectedIndex + 1) % summary.highlights.length)}
                    className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                  >
                    Next Highlight ▶
                  </button>
                </div>

                {/* Speed Selector */}
                <div className="flex items-center gap-1.5 font-mono-tabular">
                  <span className="text-[11px] text-slate-400 mr-1">Speed:</span>
                  {([0.5, 1, 2] as const).map(spd => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setPlaybackSpeed(spd)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                        playbackSpeed === spd
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN (5 cols): Generated Summary, Three Stars & Highlight Playlist */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            {/* Broadcast Telemetry Narrative & Three Stars */}
            <div className="p-4 rounded-xl bg-[#0F172A] border border-slate-800 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-sky-400">
                Match Telemetry Summary
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{summary.narrative}</p>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800">
                {summary.threeStars.map(star => (
                  <div
                    key={star.rank}
                    className="p-2 rounded-lg bg-slate-950 border border-slate-800/90 text-left"
                  >
                    <div className="text-[10px] font-bold uppercase text-amber-400">
                      ★ {star.rank === 1 ? '1st Star' : star.rank === 2 ? '2nd Star' : '3rd Star'}
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">
                      #{star.number} {star.name}
                    </div>
                    <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                      {star.statLine}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Interactive Highlight Reel Playlist */}
            <div className="flex-1 p-4 rounded-xl bg-[#0F172A] border border-slate-800 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  Highlight Reel Clips ({summary.highlights.length})
                </span>
                <span className="text-[11px] text-slate-400">Click any play to watch</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {summary.highlights.map((hl, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={hl.id}
                      type="button"
                      onClick={() => selectClip(idx)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-sky-500/15 border-sky-400'
                          : 'bg-slate-950/80 border-slate-800 hover:bg-slate-900'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold font-mono-tabular uppercase ${
                              hl.type === 'GOAL'
                                ? 'bg-amber-400 text-slate-950'
                                : hl.type === 'HEAVY_HIT'
                                ? 'bg-rose-500 text-white'
                                : hl.type === 'SAVE'
                                ? 'bg-emerald-400 text-slate-950'
                                : 'bg-sky-400 text-slate-950'
                            }`}
                          >
                            {hl.type.replace('_', ' ')}
                          </span>
                          <span className="text-xs font-bold text-white">{hl.headline}</span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{hl.description}</p>
                      </div>

                      <div className="text-right font-mono-tabular shrink-0">
                        <div className="text-[11px] font-semibold text-slate-300">
                          {hl.clockLabel}
                        </div>
                        <div className="text-[10px] text-sky-400">
                          {hl.homeScoreAfter} – {hl.awayScoreAfter}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
