import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipForward, Volume2, Trophy, RefreshCw, AudioLines, MonitorPlay } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// --- Configuration ---
const GRID_SIZE = 20;
const INITIAL_SPEED = 120; // ms per tick

type Point = { x: number; y: number };

const TRACKS = [
  { id: 1, title: 'Neon Overdrive (AI Gen)', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3' },
  { id: 2, title: 'Cybernetic Echo (AI Gen)', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3' },
  { id: 3, title: 'Deep Grid (AI Gen)', src: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-16.mp3' }
];

export default function App() {
  // --- Audio Player State ---
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Game State ---
  const [snake, setSnake] = useState<Point[]>([{ x: 10, y: 10 }]);
  const [direction, setDirection] = useState<Point>({ x: 0, y: -1 });
  const [nextDirection, setNextDirection] = useState<Point>({ x: 0, y: -1 });
  const [food, setFood] = useState<Point>({ x: 5, y: 5 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);
  
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  // --- Responsive Sizing State ---
  const containerRef = useRef<HTMLDivElement>(null);
  const [canvasSize, setCanvasSize] = useState(400);

  // --- Resize Observer ---
  useEffect(() => {
    if (!containerRef.current) return;
    let timeoutId: number;
    
    // Resize with debouncing to prevent excessive repaints and bugs
    const observer = new ResizeObserver((entries) => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          // Keep it square based on the smaller dimension
          const maxAllowedSize = Math.min(width, height, 800);
          setCanvasSize(Math.max(200, maxAllowedSize)); // minimum 200px
        }
      }, 50);
    });

    observer.observe(containerRef.current);
    return () => {
      observer.disconnect();
      window.clearTimeout(timeoutId);
    };
  }, []);

  // --- Audio Player Controls ---
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(TRACKS[currentTrackIndex].src);
      audioRef.current.loop = false;
      audioRef.current.addEventListener('ended', handleSkip);
    } else {
      audioRef.current.src = TRACKS[currentTrackIndex].src;
    }
    audioRef.current.volume = volume;

    if (isPlaying) {
      audioRef.current.play().catch((e) => console.error("Audio play error:", e));
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('ended', handleSkip);
      }
    };
  }, [currentTrackIndex]);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch((e) => console.error("Audio play error:", e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  
  const handleSkip = useCallback(() => {
    setCurrentTrackIndex((prev) => (prev + 1) % TRACKS.length);
    setIsPlaying(true);
  }, []);

  // --- Snake Game Logic ---
  const startGame = () => {
    setSnake([{ x: 10, y: 10 }]);
    setDirection({ x: 0, y: -1 });
    setNextDirection({ x: 0, y: -1 });
    setFood(getRandomFoodPosition([{ x: 10, y: 10 }]));
    setScore(0);
    setGameOver(false);
    setGameStarted(true);
    lastUpdateRef.current = performance.now();
  };

  const getRandomFoodPosition = (currentSnake: Point[]): Point => {
    let newFood: Point;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE)
      };
      const isOnSnake = currentSnake.some(
        segment => segment.x === newFood.x && segment.y === newFood.y
      );
      if (!isOnSnake) break;
    }
    return newFood;
  };

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Prevent default scrolling for arrow keys
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'w', 'a', 's', 'd'].includes(e.key)) {
      e.preventDefault();
    }

    if (e.key === ' ' && (gameOver || !gameStarted)) {
      startGame();
      return;
    }

    if (gameOver && gameStarted) return; // Allow restart via Space only

    setNextDirection((prevDir) => {
      switch (e.key.toLowerCase()) {
        case 'arrowup':
        case 'w':
          return prevDir.y !== 1 ? { x: 0, y: -1 } : prevDir;
        case 'arrowdown':
        case 's':
          return prevDir.y !== -1 ? { x: 0, y: 1 } : prevDir;
        case 'arrowleft':
        case 'a':
          return prevDir.x !== 1 ? { x: -1, y: 0 } : prevDir;
        case 'arrowright':
        case 'd':
          return prevDir.x !== -1 ? { x: 1, y: 0 } : prevDir;
        default:
          return prevDir;
      }
    });
  }, [gameOver, gameStarted]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const updateGame = useCallback((time: number) => {
    if (gameOver) return;

    const deltaTime = time - lastUpdateRef.current;
    const currentSpeed = Math.max(50, INITIAL_SPEED - score * 2); // Speed up as score increases

    if (deltaTime > currentSpeed) {
      setSnake((prevSnake) => {
        setDirection(nextDirection);
        const head = prevSnake[0];
        const newHead = {
          x: head.x + nextDirection.x,
          y: head.y + nextDirection.y
        };

        // Check collision with walls
        if (
          newHead.x < 0 ||
          newHead.x >= GRID_SIZE ||
          newHead.y < 0 ||
          newHead.y >= GRID_SIZE
        ) {
          setGameOver(true);
          return prevSnake;
        }

        // Check collision with self
        if (prevSnake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
          setGameOver(true);
          return prevSnake;
        }

        const newSnake = [newHead, ...prevSnake];

        // Check food collision
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore(s => s + 10);
          setFood(getRandomFoodPosition(newSnake));
        } else {
          newSnake.pop(); // Remove tail if no food eaten
        }

        return newSnake;
      });

      lastUpdateRef.current = time;
    }

    requestRef.current = requestAnimationFrame(updateGame);
  }, [gameOver, nextDirection, food, score]);

  useEffect(() => {
    if (!gameOver && gameStarted) {
      requestRef.current = requestAnimationFrame(updateGame);
    }
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [gameOver, gameStarted, updateGame]);

  // --- Rendering ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const TILE_SIZE = canvasSize / GRID_SIZE;

    // Clear canvas
    ctx.fillStyle = '#111'; // Very dark grey, softer than pure black
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Draw Grid (Subtle)
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvasSize; i += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(Math.floor(i), 0);
      ctx.lineTo(Math.floor(i), canvasSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, Math.floor(i));
      ctx.lineTo(canvasSize, Math.floor(i));
      ctx.stroke();
    }

    if (!gameStarted) {
      ctx.fillStyle = '#0F0';
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PRESS SPACE TO START', canvasSize / 2, canvasSize / 2);
      return;
    }

    // Draw Food
    ctx.fillStyle = '#F0F';
    ctx.beginPath();
    ctx.rect(
      food.x * TILE_SIZE + 2,
      food.y * TILE_SIZE + 2,
      TILE_SIZE - 4,
      TILE_SIZE - 4
    );
    ctx.fill();

    // Draw Snake
    snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#0F0' : '#0a0';
      
      // Slight padding for neon grid feel
      ctx.fillRect(
        segment.x * TILE_SIZE + 1,
        segment.y * TILE_SIZE + 1,
        TILE_SIZE - 2,
        TILE_SIZE - 2
      );
      
      // Optional inner line for details
      if (index === 0) {
        ctx.fillStyle = '#FFF';
        ctx.fillRect(
          segment.x * TILE_SIZE + TILE_SIZE / 2 - 2,
          segment.y * TILE_SIZE + TILE_SIZE / 2 - 2,
          4,
          4
        );
      }
    });

  }, [snake, food, gameStarted, canvasSize]);

  return (
    <div id="app-root" className="min-h-screen bg-black text-[#0F0] font-mono selection:bg-[#0F0] selection:text-black overflow-x-hidden flex flex-col pt-4 md:pt-12 px-4 md:px-8 pb-8 tracking-tight">
      
      {/* Central Viewport Layout */}
      <div id="main-layout" className="flex flex-col xl:flex-row gap-8 max-w-7xl mx-auto w-full flex-1">
        
        {/* Game Stage Column */}
        <div id="game-stage" className="flex flex-col flex-1 min-w-0 w-full h-full">
          {/* Hardware Header */}
          <header id="app-header" className="flex items-center justify-between border-b-2 border-[#0F0] pb-4 mb-6 shrink-0">
            <div className="flex items-center gap-4">
              <MonitorPlay className="w-8 h-8 text-[#0F0]" aria-hidden="true" />
              <h1 className="text-2xl font-bold uppercase tracking-widest text-[#0F0]">
                Terminal_V2
              </h1>
            </div>
            
            <div id="score-display" className="bg-[#0F0] text-black px-4 py-2 font-bold uppercase tracking-widest flex items-center gap-3">
              <Trophy className="w-4 h-4" aria-hidden="true" />
              <span>SCORE {score.toString().padStart(4, '0')}</span>
            </div>
          </header>

          {/* Scalable Container for Canvas */}
          <div 
            id="game-board-container" 
            ref={containerRef}
            className="flex-1 w-full bg-[#050505] p-2 md:p-6 border-2 border-[#222] shadow-[0_0_50px_rgba(0,255,0,0.05)] relative flex flex-col items-center justify-center min-h-[400px]"
          >
            <div className="relative group mx-auto">
              {/* Actual Game Canvas */}
              <canvas
                id="interactive-canvas"
                ref={canvasRef}
                width={canvasSize}
                height={canvasSize}
                className="bg-[#111] block relative z-0 border-2 border-[#0F0] shadow-[0_0_20px_rgba(0,255,0,0.2)]"
                style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
              />

              {/* Game Over Screen (Framer Motion) */}
              <AnimatePresence>
                {gameOver && gameStarted && (
                  <motion.div
                    id="game-over-overlay"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm border-2 border-[#F0F]"
                  >
                    <h2 className="text-4xl font-black text-[#F0F] mb-2 uppercase tracking-widest">Sys_Halt</h2>
                    <p className="text-[#0F0] mb-8 font-bold">End Score : {score}</p>
                    <button
                      id="restart-button"
                      onClick={startGame}
                      className="flex items-center gap-2 px-8 py-4 bg-transparent border-2 border-[#0F0] text-[#0F0] font-bold uppercase tracking-widest hover:bg-[#0F0] hover:text-black transition-colors focus:ring-4 focus:ring-[#0F0]/50 outline-none"
                    >
                      <RefreshCw className="w-5 h-5" aria-hidden="true" />
                      Re_Initialize
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <div className="w-full max-w-[800px] flex justify-between mt-6 text-sm text-[#0F0]/70 uppercase tracking-widest px-4 border-t border-[#222] pt-4">
              <span id="input-helper">Input: W-A-S-D / Arrows</span>
              <span id="sys-status">Status: {gameStarted && !gameOver ? "ACTIVE" : "STANDBY"}</span>
            </div>
          </div>
        </div>

        {/* Music Player Aside */}
        <aside id="audio-panel" className="w-full xl:w-96 flex flex-col gap-6 shrink-0 mt-8 xl:mt-0 xl:pt-[88px]">
          
          <div id="player-controls" className="border-2 border-[#0F0] bg-[#050505] p-6 shadow-[4px_4px_0_#0F0] transition-all">
            <h3 className="text-sm font-bold tracking-widest uppercase text-[#0F0] border-b-2 border-[#0F0] pb-2 mb-6 flex justify-between items-center">
              <span>Deck 01</span>
              <AudioLines className="w-4 h-4" aria-hidden="true" />
            </h3>

            {/* Currently Playing Info */}
            <div id="now-playing-info" className="mb-8">
              <div className="text-xs uppercase text-[#0F0]/60 mb-2 font-bold tracking-widest">
                Now_Playing
              </div>
              <motion.div 
                key={currentTrackIndex}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-xl font-bold truncate tracking-tight bg-[#0F0] text-black px-3 py-2"
              >
                {TRACKS[currentTrackIndex].title}
              </motion.div>
            </div>

            {/* Main Controls */}
            <div className="flex items-center gap-4 mb-8">
              <button
                id="play-pause-btn"
                onClick={handlePlayPause}
                className="flex items-center justify-center w-14 h-14 bg-[#0F0] text-black hover:bg-[#FFF] hover:text-black transition-colors outline-none focus-visible:ring-4 ring-[#0F0]/50"
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="w-6 h-6 fill-current" aria-hidden="true" /> : <Play className="w-6 h-6 fill-current ml-1" aria-hidden="true" />}
              </button>
              
              <button
                id="skip-fw-btn"
                onClick={handleSkip}
                className="flex items-center justify-center w-14 h-14 border-2 border-[#0F0] text-[#0F0] hover:bg-[#0F0]/10 transition-colors outline-none focus-visible:ring-4 ring-[#0F0]/50"
                aria-label="Skip Track"
              >
                <SkipForward className="w-5 h-5 fill-current" aria-hidden="true" />
              </button>
            </div>

            {/* Volume Control */}
            <div id="volume-control-group" className="border-t-2 border-[#222] pt-6 flex items-center gap-4">
              <Volume2 className="w-5 h-5 text-[#0F0]" aria-hidden="true" />
              <input
                id="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                aria-label="Volume"
                className="flex-1 h-3 appearance-none bg-[#000] border-2 border-[#0F0] rounded-none cursor-pointer outline-none focus-visible:ring-2 ring-white"
                style={{
                  background: `linear-gradient(to right, #0F0 0%, #0F0 ${volume * 100}%, #000 ${volume * 100}%, #000 100%)`
                }}
              />
            </div>
          </div>
          
          {/* Track List */}
          <div id="track-library" className="border-2 border-[#222] bg-[#050505] p-6 flex flex-col min-h-[300px]">
            <h3 className="text-sm font-bold tracking-widest uppercase text-[#0F0] border-b-2 border-[#222] pb-2 mb-4">
              Library
            </h3>
            
            <div className="flex flex-col gap-3 overflow-y-auto">
              {TRACKS.map((track, i) => {
                const isSelected = currentTrackIndex === i;
                return (
                  <button
                    key={track.id}
                    onClick={() => {
                      setCurrentTrackIndex(i);
                      setIsPlaying(true);
                    }}
                    id={`track-item-${track.id}`}
                    className={`text-left p-3 border-l-4 transition-colors font-mono text-sm flex justify-between items-center outline-none
                      ${isSelected 
                        ? 'border-[#0F0] bg-[#0F0]/10 text-[#0F0]' 
                        : 'border-[#222] text-[#0F0]/50 hover:border-[#0F0]/50 hover:text-[#0F0]'}`}
                  >
                    <span className="truncate pr-4">{String(i + 1).padStart(2, '0')} . {track.title}</span>
                    {isSelected && isPlaying && (
                      <motion.div
                        animate={{ opacity: [1, 0, 1] }}
                        transition={{ repeat: Infinity, duration: 1 }}
                        className="w-2 h-2 bg-[#0F0]"
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        /* Brutalist brutal form-range rules */
        input[type=range] {
          -webkit-appearance: none;
          width: 100%;
          background: transparent;
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 16px;
          width: 8px;
          background: #0F0;
          cursor: pointer;
          border: none;
        }
        input[type=range]:focus {
          outline: none;
        }
        input[type=range]::-webkit-slider-runnable-track {
          width: 100%;
          height: 100%;
          cursor: pointer;
          background: transparent;
          border: none;
        }
      `}} />
    </div>
  );
}

