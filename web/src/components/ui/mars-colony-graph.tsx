'use client';
import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export const MODULE_META: Record<string, { label: string; icon: string; svc: string }> = {
  command:   { label: 'Command Center',     icon: '🖥',  svc: 'frontend'     },
  oxygen:    { label: 'Oxygen System',      icon: '💨',  svc: 'payment'      },
  comms:     { label: 'Earth Comms',        icon: '📡',  svc: 'notification' },
  resources: { label: 'Resource Allocator', icon: '⚙️', svc: 'order'        },
  storage:   { label: 'Storage Bay',        icon: '🏗',  svc: 'inventory'    },
};

const MOD_POSITIONS: Record<string, [number, number, number]> = {
  command:   [ 0,    1.7,  0   ],
  oxygen:    [-2.0,  0.3,  0.5 ],
  comms:     [ 2.0,  0.3,  0.5 ],
  resources: [-1.2, -1.5, -0.3 ],
  storage:   [ 1.2, -1.5, -0.3 ],
};

const EDGES: [string, string][] = [
  ['command','oxygen'],['command','comms'],['command','resources'],['command','storage'],
  ['oxygen','resources'],['comms','storage'],['resources','storage'],
];

const SEV: Record<string, number> = { NORMAL: 0x00ff88, WARNING: 0xff8c00, CRITICAL: 0xff2222 };

interface Props {
  anomalyScores: Record<string, { severity: string; score: number }>;
  rootCause?: { service: string } | null;
  onModuleClick?: (mod: string) => void;
}

export default function MarsColonyGraph({ anomalyScores, rootCause, onModuleClick }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const live = useRef({ anomalyScores, rootCause, onModuleClick });
  useEffect(() => { live.current = { anomalyScores, rootCause, onModuleClick }; });

  const sev = (mod: string) => live.current.anomalyScores[MODULE_META[mod]?.svc]?.severity || 'NORMAL';
  const isRoot = (mod: string) => live.current.rootCause?.service === MODULE_META[mod]?.svc;

  useEffect(() => {
    const mount = mountRef.current; if (!mount) return;
    const W = mount.clientWidth, H = mount.clientHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(48, W / H, 0.1, 200);
    camera.position.set(0, 0.8, 6.5);
    camera.lookAt(0, 0.3, 0);

    // ── Stars ──────────────────────────────────────────────────────────
    const starPos = new Float32Array(3000 * 3);
    for (let i = 0; i < 9000; i++) starPos[i] = (Math.random() - 0.5) * 140;
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.07, transparent: true, opacity: 0.75 })));

    // ── Mars ──────────────────────────────────────────────────────────
    const mars = new THREE.Mesh(
      new THREE.SphereGeometry(2.8, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xb5380c, roughness: 0.9, emissive: 0x3d1005, emissiveIntensity: 0.2 })
    );
    mars.position.set(5, -3.5, -12);
    scene.add(mars);

    // ── Lights ────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x050d1a, 1.0));
    const sun = new THREE.DirectionalLight(0xfff5d0, 1.8); sun.position.set(8, 6, 4); scene.add(sun);
    const cyanGlow = new THREE.PointLight(0x00e5ff, 1.8, 12); cyanGlow.position.set(0, 0, 1); scene.add(cyanGlow);
    const redAlert = new THREE.PointLight(0xff1a00, 0, 14); redAlert.position.set(0, 0, 2); scene.add(redAlert);

    // ── Colony group ─────────────────────────────────────────────────
    const colony = new THREE.Group();
    scene.add(colony);

    // ── Central AI Core ──────────────────────────────────────────────
    const coreInner = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.28, 2),
      new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 0.9, roughness: 0.05, metalness: 0.9 })
    );
    colony.add(coreInner);
    const coreOuter = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.48, 1),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, wireframe: true, transparent: true, opacity: 0.18 })
    );
    colony.add(coreOuter);
    // Core glow
    const coreGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.68, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.06, side: THREE.BackSide, depthWrite: false })
    );
    colony.add(coreGlow);

    // ── Colony orbit ring ─────────────────────────────────────────────
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.95, 0.022, 8, 128),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.22 })
    );
    ring.rotation.x = Math.PI / 2;
    colony.add(ring);
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.4, 0.012, 6, 128),
      new THREE.MeshBasicMaterial({ color: 0x004466, transparent: true, opacity: 0.35 })
    );
    ring2.rotation.x = Math.PI * 0.42;
    colony.add(ring2);

    // ── Drone swarm ───────────────────────────────────────────────────
    const DRONES = 18;
    const droneAngles = Array.from({ length: DRONES }, (_, i) => (i / DRONES) * Math.PI * 2);
    const droneMeshes: THREE.Mesh[] = droneAngles.map(a => {
      const m = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.04, 0),
        new THREE.MeshBasicMaterial({ color: 0x00ffaa, transparent: true, opacity: 0.8 })
      );
      m.position.set(Math.cos(a) * 2.1, Math.sin(a * 0.3) * 0.18, Math.sin(a) * 2.1);
      m.userData.angle = a;
      colony.add(m);
      return m;
    });

    // ── Module nodes ──────────────────────────────────────────────────
    const nodeMeshes = new Map<string, THREE.Mesh>();
    const glowSpheres = new Map<string, THREE.Mesh>();
    const sweepRings = new Map<string, THREE.Mesh>();
    const rootRings  = new Map<string, THREE.Mesh>();
    const bParticles = new Map<string, { pts: THREE.Points; vel: Float32Array; origin: THREE.Vector3 }>();
    const labels     = new Map<string, THREE.Sprite>();

    function sprite(text: string, col = '#94a3b8'): THREE.Sprite {
      const c = document.createElement('canvas'); c.width = 340; c.height = 72;
      const cx = c.getContext('2d')!;
      cx.font = 'bold 22px monospace'; cx.fillStyle = col;
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.fillText(text.toUpperCase(), 170, 36);
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      s.scale.set(1.1, 0.24, 1);
      return s;
    }

    Object.keys(MODULE_META).forEach(mod => {
      const [x, y, z] = MOD_POSITIONS[mod];
      const pos = new THREE.Vector3(x, y, z);
      const col = SEV[sev(mod)] ?? SEV.NORMAL;

      // Gem node (octahedron)
      const geo = new THREE.OctahedronGeometry(0.22, 0);
      const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, roughness: 0.1, metalness: 0.85 });
      const mesh = new THREE.Mesh(geo, mat); mesh.position.copy(pos); mesh.userData.mod = mod;
      colony.add(mesh); nodeMeshes.set(mod, mesh);

      // Inner spinning gem
      const inner = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.1, 0),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.6 })
      );
      inner.position.copy(pos); inner.userData.inner = true; colony.add(inner);

      // Glow halo
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 12, 12),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.07, side: THREE.BackSide, depthWrite: false })
      );
      glow.position.copy(pos); colony.add(glow); glowSpheres.set(mod, glow);

      // Base sweep ring (rotates around node)
      const sweep = new THREE.Mesh(
        new THREE.TorusGeometry(0.36, 0.018, 6, 64),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.55 })
      );
      sweep.position.copy(pos); colony.add(sweep); sweepRings.set(mod, sweep);

      // Root cause ring (hidden until root cause)
      const rootRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.025, 8, 64),
        new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0 })
      );
      rootRing.position.copy(pos); colony.add(rootRing); rootRings.set(mod, rootRing);

      // Label
      const lbl = sprite(MODULE_META[mod].label);
      lbl.position.set(x, y - 0.58, z); colony.add(lbl); labels.set(mod, lbl);

      // Breach particles
      const N = 80; const pPos = new Float32Array(N * 3); const pVel = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const th = Math.random() * Math.PI * 2, ph = Math.random() * Math.PI;
        pPos[i*3]=x+Math.sin(ph)*Math.cos(th)*0.3; pPos[i*3+1]=y+Math.sin(ph)*Math.sin(th)*0.3; pPos[i*3+2]=z+Math.cos(ph)*0.3;
        pVel[i*3]=(Math.random()-.5)*0.025; pVel[i*3+1]=(Math.random()-.5)*0.025; pVel[i*3+2]=(Math.random()-.5)*0.025;
      }
      const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pts = new THREE.Points(pGeo, new THREE.PointsMaterial({ color: 0xff2200, size: 0.065, transparent: true, opacity: 0 }));
      colony.add(pts); bParticles.set(mod, { pts, vel: pVel, origin: pos });
    });

    // ── Arms from core to each module ────────────────────────────────
    Object.keys(MODULE_META).forEach(mod => {
      const [mx, my, mz] = MOD_POSITIONS[mod];
      const dir = new THREE.Vector3(mx, my, mz); const len = dir.length(); const mid = dir.clone().multiplyScalar(0.5);
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.01, 0.01, len, 4),
        new THREE.MeshBasicMaterial({ color: 0x003a55, transparent: true, opacity: 0.5 })
      );
      arm.position.copy(mid);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      colony.add(arm);
    });

    // ── Edge beams ────────────────────────────────────────────────────
    const edgeMeshes: Array<{ cyl: THREE.Mesh; a: string; b: string }> = [];
    const beamParticles: Array<{ mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; speed: number }> = [];

    EDGES.forEach(([a, b]) => {
      const [ax,ay,az]=MOD_POSITIONS[a], [bx,by,bz]=MOD_POSITIONS[b];
      const from=new THREE.Vector3(ax,ay,az), to=new THREE.Vector3(bx,by,bz);
      const dir=new THREE.Vector3().subVectors(to,from); const len=dir.length();
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, len, 5),
        new THREE.MeshBasicMaterial({ color: 0x003322, transparent: true, opacity: 0.25 })
      );
      cyl.position.copy(from.clone().add(to).multiplyScalar(.5));
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), dir.clone().normalize());
      cyl.userData = {a,b};
      colony.add(cyl); edgeMeshes.push({ cyl, a, b });
      // Beam particle
      const pm = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 6), new THREE.MeshBasicMaterial({ color: 0x00ff88 }));
      pm.position.copy(from); colony.add(pm); beamParticles.push({ mesh: pm, from, to, t: Math.random(), speed: 0.3+Math.random()*0.25 });
    });

    // ── Drag orbit ────────────────────────────────────────────────────
    let isDrag = false, prevX = 0, prevY = 0;
    const target = { x: 0.15, y: 0 }, cur = { x: 0.15, y: 0 };
    let autoSpin = true;
    const el = renderer.domElement;
    const dn = (e: MouseEvent) => { isDrag=true; autoSpin=false; prevX=e.clientX; prevY=e.clientY; el.style.cursor='grabbing'; };
    const up = () => { isDrag=false; el.style.cursor='grab'; };
    const mv = (e: MouseEvent) => { if(!isDrag) return; target.y+=(e.clientX-prevX)*0.009; target.x+=(e.clientY-prevY)*0.005; target.x=Math.max(-.55,Math.min(.55,target.x)); prevX=e.clientX; prevY=e.clientY; };
    el.addEventListener('mousedown',dn); window.addEventListener('mouseup',up); window.addEventListener('mousemove',mv);
    // Touch
    const tdn=(e:TouchEvent)=>{isDrag=true;autoSpin=false;prevX=e.touches[0].clientX;prevY=e.touches[0].clientY;};
    const tmv=(e:TouchEvent)=>{if(!isDrag)return;target.y+=(e.touches[0].clientX-prevX)*0.009;target.x+=(e.touches[0].clientY-prevY)*0.005;prevX=e.touches[0].clientX;prevY=e.touches[0].clientY;};
    el.addEventListener('touchstart',tdn,{passive:true}); el.addEventListener('touchmove',tmv,{passive:true});

    // ── Raycaster ─────────────────────────────────────────────────────
    const ray = new THREE.Raycaster(), mp = new THREE.Vector2();
    el.addEventListener('click', (e: MouseEvent) => {
      const r = mount.getBoundingClientRect();
      mp.x=((e.clientX-r.left)/r.width)*2-1; mp.y=-((e.clientY-r.top)/r.height)*2+1;
      ray.setFromCamera(mp, camera);
      const hits = ray.intersectObjects([...nodeMeshes.values()]);
      if (hits.length) live.current.onModuleClick?.(hits[0].object.userData.mod);
    });

    // ── Animation loop ────────────────────────────────────────────────
    let raf: number;
    const clock = new THREE.Clock();

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      if (autoSpin) target.y += 0.003;
      cur.x += (target.x - cur.x) * 0.07; cur.y += (target.y - cur.y) * 0.07;
      colony.rotation.x = cur.x; colony.rotation.y = cur.y;

      mars.rotation.y = t * 0.035;
      coreInner.rotation.y = t * 0.9; coreInner.rotation.x = t * 0.4;
      coreOuter.rotation.y = -t * 0.3; coreOuter.rotation.z = t * 0.2;
      ring.rotation.z = t * 0.06; ring2.rotation.y = t * 0.04;

      // Drones orbit
      droneMeshes.forEach((d, i) => {
        const a = droneAngles[i] + t * (0.35 + i * 0.012);
        const r2 = 2.1 + Math.sin(t * 0.5 + i) * 0.08;
        d.position.set(Math.cos(a)*r2, Math.sin(a*0.3 + i)*0.25, Math.sin(a)*r2);
        d.rotation.y = t * 2;
      });

      const hasCrit = Object.values(live.current.anomalyScores).some(s => s.severity === 'CRITICAL');
      redAlert.intensity = hasCrit ? 2.0 + Math.sin(t * 7) * 0.8 : 0;
      cyanGlow.intensity = hasCrit ? 0.6 : 1.8;

      // Update modules
      Object.keys(MODULE_META).forEach(mod => {
        const s = sev(mod), col = SEV[s] ?? SEV.NORMAL;
        const mesh = nodeMeshes.get(mod)!;
        const glow = glowSpheres.get(mod)!;
        const sweep = sweepRings.get(mod)!;
        const rootR = rootRings.get(mod)!;
        const bp = bParticles.get(mod)!;
        const [bx,by,bz] = MOD_POSITIONS[mod];
        const bob = Math.sin(t * 0.7 + bx) * 0.065;

        mesh.position.y = by + bob; mesh.rotation.y += 0.011; mesh.rotation.x += 0.007;
        // inner gem (find by userData)
        colony.children.forEach(c => {
          if ((c as THREE.Mesh).userData?.inner && !(c as THREE.Mesh).userData?.mod) {
            // skip — handled per-mod below
          }
        });
        glow.position.y = mesh.position.y;
        sweep.position.y = mesh.position.y;
        sweep.rotation.y = t * 0.9 + bx;
        sweep.rotation.x = t * 0.5 + bz;
        rootR.position.y = mesh.position.y;

        const mm = mesh.material as THREE.MeshStandardMaterial;
        mm.color.setHex(col); mm.emissive.setHex(col);
        mm.emissiveIntensity = s === 'CRITICAL' ? 0.8+Math.sin(t*9)*0.2 : s === 'WARNING' ? 0.4+Math.sin(t*3)*0.1 : 0.25;
        (glow.material as THREE.MeshBasicMaterial).color.setHex(col);
        (glow.material as THREE.MeshBasicMaterial).opacity = s === 'CRITICAL' ? 0.14+Math.sin(t*7)*0.05 : 0.07;
        (sweep.material as THREE.MeshBasicMaterial).color.setHex(col);
        (sweep.material as THREE.MeshBasicMaterial).opacity = s === 'CRITICAL' ? 0.9 : s === 'WARNING' ? 0.65 : 0.4;

        // Root ring
        const rc = isRoot(mod);
        (rootR.material as THREE.MeshBasicMaterial).opacity = rc ? 0.7+Math.sin(t*5)*0.25 : 0;
        if (rc) rootR.scale.setScalar(1+Math.sin(t*4)*0.12);

        // Breach particles
        const pMat = bp.pts.material as THREE.PointsMaterial;
        if (s === 'CRITICAL') {
          pMat.opacity = Math.min(pMat.opacity + 0.05, 0.9);
          const pos = bp.pts.geometry.attributes.position.array as Float32Array;
          for (let i = 0; i < 80; i++) {
            pos[i*3]+=bp.vel[i*3]; pos[i*3+1]+=bp.vel[i*3+1]; pos[i*3+2]+=bp.vel[i*3+2];
            const dx=pos[i*3]-bx, dy=pos[i*3+1]-by, dz=pos[i*3+2]-bz;
            if (Math.sqrt(dx*dx+dy*dy+dz*dz) > 1.5) {
              const th=Math.random()*Math.PI*2, ph=Math.random()*Math.PI;
              pos[i*3]=bx+Math.sin(ph)*Math.cos(th)*0.3; pos[i*3+1]=by+Math.sin(ph)*Math.sin(th)*0.3; pos[i*3+2]=bz+Math.cos(ph)*0.3;
            }
          }
          bp.pts.geometry.attributes.position.needsUpdate = true;
        } else {
          pMat.opacity = Math.max(pMat.opacity - 0.07, 0);
        }
      });

      // Edge beams
      edgeMeshes.forEach(({ cyl, a, b }) => {
        const sA = sev(a), sB = sev(b);
        const active = sA !== 'NORMAL' || sB !== 'NORMAL';
        const col = active ? (SEV[sA] ?? SEV[sB]) : 0x003322;
        (cyl.material as THREE.MeshBasicMaterial).color.setHex(col);
        (cyl.material as THREE.MeshBasicMaterial).opacity = active ? 0.6 : 0.22;
      });

      // Beam particles
      beamParticles.forEach(p => {
        p.t = (p.t + p.speed * 0.016) % 1;
        p.mesh.position.lerpVectors(p.from, p.to, p.t);
      });

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const nW=mount.clientWidth, nH=mount.clientHeight;
      camera.aspect = nW/nH; camera.updateProjectionMatrix(); renderer.setSize(nW, nH);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('mousemove', mv);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []); // eslint-disable-line

  return <div ref={mountRef} className="w-full h-full" style={{ cursor: 'grab' }} />;
}
