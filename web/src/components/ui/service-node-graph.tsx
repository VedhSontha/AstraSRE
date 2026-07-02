'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const SERVICES = ['payment', 'order', 'inventory', 'frontend', 'notification'];

// Pentagon positions (normalized -1 to 1)
const ANGLES = SERVICES.map((_, i) => (i * 2 * Math.PI) / SERVICES.length - Math.PI / 2);

const EDGES: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4],
  [1, 3], [1, 4], [2, 1], [2, 3],
];

const SEV_HEX: Record<string, number> = {
  NORMAL:   0x10b981,
  WARNING:  0xf59e0b,
  CRITICAL: 0xef4444,
};

interface Props {
  anomalyScores?: Record<string, { severity: string; score: number }>;
  rootCause?: { service: string } | null;
  onNodeClick?: (svc: string) => void;
}

export default function ServiceNodeGraph({ anomalyScores = {}, rootCause, onNodeClick }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef({ anomalyScores, rootCause, onNodeClick });
  propsRef.current = { anomalyScores, rootCause, onNodeClick };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    // ── Scene, Camera, Renderer ───────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // ── Lights ────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pLight = new THREE.PointLight(0x6366f1, 2, 20);
    pLight.position.set(0, 3, 3);
    scene.add(pLight);

    // ── Node meshes ───────────────────────────────────────────────────
    const RADIUS = 1.6;
    const nodeMeshes: THREE.Mesh[] = [];
    const glowMeshes: THREE.Mesh[] = [];
    const ringMeshes: (THREE.Mesh | null)[] = [];
    const labels: THREE.Sprite[] = [];

    // Sprite label helper
    function makeLabel(text: string, color: string): THREE.Sprite {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 64);
      ctx.fillStyle = color;
      ctx.font = 'bold 28px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, 128, 32);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(0.7, 0.18, 1);
      return sprite;
    }

    SERVICES.forEach((svc, i) => {
      const angle = ANGLES[i];
      const x = Math.cos(angle) * RADIUS;
      const y = Math.sin(angle) * RADIUS;

      const sev = propsRef.current.anomalyScores[svc]?.severity || 'NORMAL';
      const col = SEV_HEX[sev] ?? SEV_HEX.NORMAL;

      // Main sphere
      const geo = new THREE.SphereGeometry(0.22, 32, 32);
      const mat = new THREE.MeshStandardMaterial({
        color: col, emissive: col,
        emissiveIntensity: sev === 'CRITICAL' ? 0.7 : sev === 'WARNING' ? 0.35 : 0.15,
        roughness: 0.2, metalness: 0.7,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, 0);
      mesh.userData = { index: i, svc };
      scene.add(mesh);
      nodeMeshes.push(mesh);

      // Glow sphere
      const glowGeo = new THREE.SphereGeometry(0.38, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: col, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.BackSide,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      glow.position.set(x, y, 0);
      scene.add(glow);
      glowMeshes.push(glow);

      // Root cause ring
      if (rootCause?.service === svc) {
        const ringGeo = new THREE.TorusGeometry(0.42, 0.03, 8, 64);
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.8 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(x, y, 0);
        scene.add(ring);
        ringMeshes.push(ring);
      } else {
        ringMeshes.push(null);
      }

      // Label
      const label = makeLabel(svc, '#94a3b8');
      label.position.set(x, y - 0.52, 0);
      scene.add(label);
      labels.push(label);
    });

    // ── Edge lines ────────────────────────────────────────────────────
    const edgeLines: THREE.Line[] = [];
    const particleMeshes: { mesh: THREE.Mesh; from: THREE.Vector3; to: THREE.Vector3; t: number; speed: number }[] = [];

    EDGES.forEach(([ai, bi]) => {
      const ax = Math.cos(ANGLES[ai]) * RADIUS;
      const ay = Math.sin(ANGLES[ai]) * RADIUS;
      const bx = Math.cos(ANGLES[bi]) * RADIUS;
      const by = Math.sin(ANGLES[bi]) * RADIUS;

      const sevA = propsRef.current.anomalyScores[SERVICES[ai]]?.severity || 'NORMAL';
      const sevB = propsRef.current.anomalyScores[SERVICES[bi]]?.severity || 'NORMAL';
      const active = sevA !== 'NORMAL' || sevB !== 'NORMAL';
      const edgeCol = active ? (SEV_HEX[sevA] ?? SEV_HEX[sevB]) : 0x1e293b;

      const points = [new THREE.Vector3(ax, ay, 0), new THREE.Vector3(bx, by, 0)];
      const lineMat = new THREE.LineBasicMaterial({
        color: edgeCol, transparent: true, opacity: active ? 0.5 : 0.15,
      });
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMat);
      scene.add(line);
      edgeLines.push(line);

      // Particle along active edges
      if (active) {
        const pGeo = new THREE.SphereGeometry(0.05, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({ color: edgeCol });
        const p = new THREE.Mesh(pGeo, pMat);
        scene.add(p);
        particleMeshes.push({
          mesh: p,
          from: new THREE.Vector3(ax, ay, 0),
          to: new THREE.Vector3(bx, by, 0),
          t: Math.random(),
          speed: 0.4 + Math.random() * 0.3,
        });
      }
    });

    // ── Raycaster for click ───────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onClick = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(nodeMeshes);
      if (hits.length > 0 && propsRef.current.onNodeClick) {
        propsRef.current.onNodeClick(hits[0].object.userData.svc);
      }
    };
    mount.addEventListener('click', onClick);

    // ── Animation loop ────────────────────────────────────────────────
    let frame: number;
    const clock = new THREE.Clock();
    let camAngle = 0;

    const animate = () => {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const delta = clock.getDelta ? 0.016 : 0.016;

      // Gentle camera orbit
      camAngle += 0.004;
      camera.position.x = Math.sin(camAngle) * 0.5;
      camera.position.y = Math.sin(camAngle * 0.4) * 0.2 + 0.3;
      camera.lookAt(0, 0, 0);

      // Animate nodes
      nodeMeshes.forEach((mesh, i) => {
        const sev = propsRef.current.anomalyScores[SERVICES[i]]?.severity || 'NORMAL';
        const baseX = Math.cos(ANGLES[i]) * RADIUS;
        const baseY = Math.sin(ANGLES[i]) * RADIUS;
        mesh.position.y = baseY + Math.sin(t * 0.8 + ANGLES[i]) * 0.06;
        mesh.rotation.y = t * 0.3;

        const mat = mesh.material as THREE.MeshStandardMaterial;
        const newCol = SEV_HEX[sev] ?? SEV_HEX.NORMAL;
        mat.color.setHex(newCol);
        mat.emissive.setHex(newCol);
        mat.emissiveIntensity = sev === 'CRITICAL'
          ? 0.6 + Math.sin(t * 6) * 0.2
          : sev === 'WARNING' ? 0.3 + Math.sin(t * 3) * 0.1 : 0.15;

        // Sync glow
        glowMeshes[i].position.y = mesh.position.y;
        (glowMeshes[i].material as THREE.MeshBasicMaterial).color.setHex(newCol);

        // Sync labels
        labels[i].position.y = mesh.position.y - 0.52;

        // Sync rings
        const ring = ringMeshes[i];
        if (ring) {
          ring.position.y = mesh.position.y;
          const pulse = 1 + Math.sin(t * 4) * 0.12;
          ring.scale.setScalar(pulse);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 4) * 0.25;
        }
      });

      // Animate particles
      particleMeshes.forEach(p => {
        p.t = (p.t + p.speed * 0.016) % 1;
        p.mesh.position.lerpVectors(p.from, p.to, p.t);
      });

      // Pulse ambient light when critical
      const hasCrit = Object.values(propsRef.current.anomalyScores).some(s => s.severity === 'CRITICAL');
      pLight.intensity = hasCrit ? 2 + Math.sin(t * 5) * 0.5 : 2;
      pLight.color.setHex(hasCrit ? 0xef4444 : 0x6366f1);

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────
    const onResize = () => {
      const nw = mount.clientWidth;
      const nh = mount.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', onResize);

    // ── Cleanup ───────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      mount.removeEventListener('click', onClick);
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update props without re-mounting
  useEffect(() => {
    propsRef.current = { anomalyScores, rootCause, onNodeClick };
  });

  return (
    <div ref={mountRef} className="w-full h-full" style={{ cursor: 'crosshair' }} />
  );
}
