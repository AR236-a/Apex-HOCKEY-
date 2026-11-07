import React, { useRef, useState } from 'react';

export interface VirtualControllerState {
  moveX: number;
  moveY: number;
  sprintHeld: boolean;
  shootHeld: boolean;
  shootJustReleased: boolean;
  passJustPressed: boolean;
  checkJustPressed: boolean;
  switchJustPressed: boolean;
  dekeJustPressed: boolean;
}

interface OnScreenControllerProps {
  controllerRef: React.MutableRefObject<VirtualControllerState>;
  teamCode: string;
  activeSkaterName: string;
  activeSkaterNumber: number;
  matchMode: 'pve' | 'pvp_local' | 'pvp_online';
  aiLevelLabel: string;
}

export const OnScreenController: React.FC<OnScreenControllerProps> = ({
  controllerRef,
  teamCode,
  activeSkaterName,
  activeSkaterNumber,
  matchMode,
  aiLevelLabel,
}) => {
  const stickZoneRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [activeDirLabel, setActiveDirLabel] = useState<string>('IDLE');
  const [isShootingUI, setIsShootingUI] = useState(false);
  const [isSprintingUI, setIsSprintingUI] = useState(false);

  const updateStickVector = (clientX: number, clientY: number) => {
    const el = stickZoneRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const maxRadius = rect.width * 0.36;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(dist, maxRadius);
    const nx = dist > 4 ? dx / dist : 0;
    const ny = dist > 4 ? dy / dist : 0;

    setKnobOffset({
      x: nx * clampedDist,
      y: ny * clampedDist,
    });

    controllerRef.current.moveX = nx;
    controllerRef.current.moveY = ny;

    if (dist <= 4) {
      setActiveDirLabel('IDLE');
    } else {
      const horiz = nx > 0.35 ? 'R' : nx < -0.35 ? 'L' : '';
      const vert = ny > 0.35 ? 'D' : ny < -0.35 ? 'U' : '';
      setActiveDirLabel(`${vert}${horiz}` || 'SKATE');
    }
  };

  const resetStick = () => {
    setKnobOffset({ x: 0, y: 0 });
    setActiveDirLabel('IDLE');
    controllerRef.current.moveX = 0;
    controllerRef.current.moveY = 0;
  };

  const setDpadDirection = (mx: number, my: number, label: string) => {
    controllerRef.current.moveX = mx;
    controllerRef.current.moveY = my;
    setKnobOffset({ x: mx * 26, y: my * 26 });
    setActiveDirLabel(label);
  };

  return (
    <div
      data-testid="onscreen-hockey-controller"
      className="w-full flex items-end justify-between gap-4 pointer-events-none select-none"
    >
      {/* LEFT PAD: Interactive Virtual Thumbstick + D-Pad Buttons */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-[#080F1E]/92 border border-slate-800 shadow-xl pointer-events-auto">
        {/* Draggable Thumbstick Circle */}
        <div
          ref={stickZoneRef}
          role="application"
          aria-label="Skating Directional Thumbstick"
          onPointerDown={e => {
            e.currentTarget.setPointerCapture(e.pointerId);
            updateStickVector(e.clientX, e.clientY);
          }}
          onPointerMove={e => {
            if (e.buttons > 0 || e.pressure > 0) {
              updateStickVector(e.clientX, e.clientY);
            }
          }}
          onPointerUp={resetStick}
          onPointerCancel={resetStick}
          className="relative w-28 h-28 rounded-full bg-slate-950 border-2 border-slate-700 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none"
        >
          {/* Crosshair guide lines */}
          <div className="absolute inset-x-3 h-px bg-slate-800 pointer-events-none" />
          <div className="absolute inset-y-3 w-px bg-slate-800 pointer-events-none" />

          {/* Directional D-Pad Click Buttons around perimeter for precise clicks */}
          <button
            type="button"
            aria-label="Skate Up"
            onPointerDown={e => {
              e.stopPropagation();
              setDpadDirection(0, -1, 'UP');
            }}
            onPointerUp={e => {
              e.stopPropagation();
              resetStick();
            }}
            onPointerLeave={resetStick}
            className="absolute top-1 left-1/2 -translate-x-1/2 w-8 h-6 rounded bg-slate-900/90 hover:bg-sky-500/30 text-[10px] font-bold text-slate-300 flex items-center justify-center"
          >
            ▲
          </button>
          <button
            type="button"
            aria-label="Skate Down"
            onPointerDown={e => {
              e.stopPropagation();
              setDpadDirection(0, 1, 'DOWN');
            }}
            onPointerUp={e => {
              e.stopPropagation();
              resetStick();
            }}
            onPointerLeave={resetStick}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-6 rounded bg-slate-900/90 hover:bg-sky-500/30 text-[10px] font-bold text-slate-300 flex items-center justify-center"
          >
            ▼
          </button>
          <button
            type="button"
            aria-label="Skate Left"
            onPointerDown={e => {
              e.stopPropagation();
              setDpadDirection(-1, 0, 'LEFT');
            }}
            onPointerUp={e => {
              e.stopPropagation();
              resetStick();
            }}
            onPointerLeave={resetStick}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-8 rounded bg-slate-900/90 hover:bg-sky-500/30 text-[10px] font-bold text-slate-300 flex items-center justify-center"
          >
            ◀
          </button>
          <button
            type="button"
            aria-label="Skate Right"
            onPointerDown={e => {
              e.stopPropagation();
              setDpadDirection(1, 0, 'RIGHT');
            }}
            onPointerUp={e => {
              e.stopPropagation();
              resetStick();
            }}
            onPointerLeave={resetStick}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-8 rounded bg-slate-900/90 hover:bg-sky-500/30 text-[10px] font-bold text-slate-300 flex items-center justify-center"
          >
            ▶
          </button>

          {/* Thumbstick Puck Knob */}
          <div
            style={{
              transform: `translate(${knobOffset.x.toFixed(1)}px, ${knobOffset.y.toFixed(1)}px)`,
            }}
            className="w-10 h-10 rounded-full bg-sky-500 border-2 border-white shadow-md flex items-center justify-center pointer-events-none"
          >
            <span className="text-[9px] font-extrabold font-mono-tabular text-slate-950">
              {activeDirLabel}
            </span>
          </div>
        </div>

        {/* Team Control Status Readout */}
        <div className="hidden sm:flex flex-col justify-between h-24 text-xs font-mono-tabular pr-1">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-sky-400">
              Controlling {teamCode} (Home)
            </div>
            <div className="text-sm font-bold text-white font-sans">
              #{activeSkaterNumber} {activeSkaterName}
            </div>
          </div>

          <div className="text-[11px] text-slate-400">
            {matchMode === 'pve'
              ? `Mode: Player vs AI (${aiLevelLabel})`
              : matchMode === 'pvp_local'
              ? 'Mode: 2P Local (P1 WASD · P2 Arrows)'
              : 'Mode: Online PvP'}
          </div>

          <div className="text-[10px] text-slate-500">
            Drag stick or use WASD / Arrows
          </div>
        </div>
      </div>

      {/* RIGHT PAD: Arcade Action Controller Buttons (Shoot, Pass, Check, Sprint, Switch) */}
      <div className="p-3 rounded-xl bg-[#080F1E]/92 border border-slate-800 shadow-xl pointer-events-auto flex items-center gap-2.5">
        <div className="grid grid-cols-3 gap-2">
          {/* SWITCH SKATER [Q] */}
          <button
            type="button"
            aria-label="Switch Skater"
            onPointerDown={e => {
              e.currentTarget.blur();
              controllerRef.current.switchJustPressed = true;
            }}
            className="w-20 h-12 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-sky-500 active:text-slate-950 border border-slate-700 text-slate-200 flex flex-col items-center justify-center transition-colors touch-none"
          >
            <span className="text-xs font-bold uppercase tracking-wider font-display">
              Switch
            </span>
            <span className="text-[10px] font-mono-tabular text-slate-400">[Q] Player</span>
          </button>

          {/* PASS PUCK [E] */}
          <button
            type="button"
            aria-label="Pass Puck"
            onPointerDown={e => {
              e.currentTarget.blur();
              controllerRef.current.passJustPressed = true;
            }}
            className="w-20 h-12 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-slate-950 font-bold flex flex-col items-center justify-center transition-transform touch-none"
          >
            <span className="text-xs font-extrabold uppercase tracking-wider font-display">
              Pass
            </span>
            <span className="text-[10px] font-mono-tabular text-emerald-950">[E] Tape</span>
          </button>

          {/* SLAPSHOT [SPACE] (Hold & Release to Charge) */}
          <button
            type="button"
            aria-label="Slapshot Shoot"
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setIsShootingUI(true);
              controllerRef.current.shootHeld = true;
            }}
            onPointerUp={() => {
              if (controllerRef.current.shootHeld) {
                controllerRef.current.shootHeld = false;
                controllerRef.current.shootJustReleased = true;
              }
              setIsShootingUI(false);
            }}
            onPointerCancel={() => {
              if (controllerRef.current.shootHeld) {
                controllerRef.current.shootHeld = false;
                controllerRef.current.shootJustReleased = true;
              }
              setIsShootingUI(false);
            }}
            className={`w-24 h-12 rounded-lg font-extrabold flex flex-col items-center justify-center transition-transform touch-none ${
              isShootingUI
                ? 'bg-amber-400 text-slate-950 scale-95'
                : 'bg-sky-400 hover:bg-sky-300 text-slate-950'
            }`}
          >
            <span className="text-sm font-extrabold uppercase tracking-wider font-display">
              {isShootingUI ? 'Release!' : 'Slapshot'}
            </span>
            <span className="text-[10px] font-mono-tabular text-slate-900">[Space] Hold</span>
          </button>

          {/* DEKE / SPIN [F] */}
          <button
            type="button"
            aria-label="Deke Move"
            onPointerDown={e => {
              e.currentTarget.blur();
              controllerRef.current.dekeJustPressed = true;
            }}
            className="w-20 h-12 rounded-lg bg-slate-900 hover:bg-slate-800 active:bg-sky-500 active:text-slate-950 border border-slate-700 text-slate-200 flex flex-col items-center justify-center transition-colors touch-none"
          >
            <span className="text-xs font-bold uppercase tracking-wider font-display">
              Deke
            </span>
            <span className="text-[10px] font-mono-tabular text-slate-400">[F] Burst</span>
          </button>

          {/* BODY CHECK [C] */}
          <button
            type="button"
            aria-label="Body Check"
            onPointerDown={e => {
              e.currentTarget.blur();
              controllerRef.current.checkJustPressed = true;
            }}
            className="w-20 h-12 rounded-lg bg-rose-600 hover:bg-rose-500 active:scale-95 text-white font-bold flex flex-col items-center justify-center transition-transform touch-none"
          >
            <span className="text-xs font-extrabold uppercase tracking-wider font-display">
              Check
            </span>
            <span className="text-[10px] font-mono-tabular text-rose-100">[C] Hit</span>
          </button>

          {/* SPRINT BOOST [SHIFT] */}
          <button
            type="button"
            aria-label="Sprint Boost"
            onPointerDown={e => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setIsSprintingUI(true);
              controllerRef.current.sprintHeld = true;
            }}
            onPointerUp={() => {
              setIsSprintingUI(false);
              controllerRef.current.sprintHeld = false;
            }}
            onPointerCancel={() => {
              setIsSprintingUI(false);
              controllerRef.current.sprintHeld = false;
            }}
            className={`w-24 h-12 rounded-lg font-bold flex flex-col items-center justify-center transition-colors touch-none ${
              isSprintingUI
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/40'
            }`}
          >
            <span className="text-xs font-extrabold uppercase tracking-wider font-display">
              Sprint
            </span>
            <span className="text-[10px] font-mono-tabular">[Shift] Hold</span>
          </button>
        </div>
      </div>
    </div>
  );
};
