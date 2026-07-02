import React, { useState, useEffect, CSSProperties } from 'react'

export interface CybercoreBackgroundProps {
  /** Number of animated light beams */
  beamCount?: number
}

const DEFAULT_BEAM_COUNT = 70

const CybercoreBackground: React.FC<CybercoreBackgroundProps> = ({
  beamCount = DEFAULT_BEAM_COUNT,
}) => {
  const [beams, setBeams] = useState<
    Array<{ id: number; type: 'primary' | 'secondary'; style: CSSProperties }>
  >([])

  useEffect(() => {
    const generated = Array.from({ length: beamCount }).map((_, i) => {
      const riseDur = Math.random() * 4 + 4   // 4–8s rise
      const fadeDur = riseDur                // sync fade
      const type: 'primary' | 'secondary' = Math.random() < 0.15 ? 'secondary' : 'primary'
      return {
        id: i,
        type,
        style: {
          left: `${Math.random() * 100}%`,
          width: `${Math.floor(Math.random() * 3) + 1}px`,
          animation: `rise ${riseDur}s linear infinite ${Math.random() * 6}s, fade ${fadeDur}s ease-in-out infinite ${Math.random() * 6}s`,
        },
      }
    })
    setBeams(generated)
  }, [beamCount])

  return (
    <div
      className="scene fixed inset-0 -z-10 w-full h-full overflow-hidden pointer-events-none"
      role="img"
      aria-label="Animated cybercore grid background"
    >
      <div className="floor absolute bottom-0 left-0 w-full h-[60%]" />
      <div className="main-column absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-full bg-[#8b5cf6] mix-blend-screen opacity-20" style={{ animation: 'mainGlow 4s alternate infinite' }} />
      <div className="light-stream-container absolute inset-0">
        {beams.map((beam) => (
          <div
            key={beam.id}
            className={`light-beam ${beam.type} absolute bottom-0 bg-[#a855f7] opacity-0`}
            style={{
              ...beam.style,
              boxShadow: beam.type === 'primary' 
                ? '0 0 10px rgba(168,85,247,0.8), 0 0 20px rgba(139,92,246,0.6)' 
                : '0 0 15px rgba(192,132,252,0.8)'
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default CybercoreBackground
