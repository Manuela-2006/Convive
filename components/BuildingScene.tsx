"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const KEYFRAMES = [
  { rotationY: Math.PI, cameraX: -0.8, cameraY: 22, lookAtY: 22 }, // S1 delantera
  { rotationY: Math.PI * 2, cameraX: 0, cameraY: 17, lookAtY: 17 }, // S2 trasera
  { rotationY: Math.PI * 3, cameraX: 0, cameraY: 12, lookAtY: 12 }, // S3 delantera
  { rotationY: Math.PI * 4, cameraX: 0, cameraY: 7, lookAtY: 7 }, // S4 trasera
  { rotationY: Math.PI * 5, cameraX: 0, cameraY: 3, lookAtY: 3 }, // S5 delantera
];

const SECTION_SELECTORS = [
  "#landing-section-one",
  "#landing-section-two",
  "#landing-section-three",
  "#landing-section-four",
  "#landing-section-five",
];

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function getValues(progress: number) {
  const count = KEYFRAMES.length - 1;
  const scaled = Math.max(0, Math.min(count, progress * count));
  const i = Math.min(Math.floor(scaled), count - 1);
  const t = scaled - i;
  const a = KEYFRAMES[i];
  const b = KEYFRAMES[Math.min(i + 1, count)];
  return {
    rotationY: lerp(a.rotationY, b.rotationY, t),
    cameraX: lerp(a.cameraX, b.cameraX, t),
    cameraY: lerp(a.cameraY, b.cameraY, t),
    lookAtY: lerp(a.lookAtY, b.lookAtY, t),
  };
}

type State = {
  pivot: THREE.Object3D | null;
  targetRotationY: number;
  targetCameraX: number;
  targetCameraY: number;
  targetLookAtY: number;
};

export default function BuildingScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<State>({
    pivot: null,
    targetRotationY: KEYFRAMES[0].rotationY,
    targetCameraX: KEYFRAMES[0].cameraX,
    targetCameraY: KEYFRAMES[0].cameraY,
    targetLookAtY: KEYFRAMES[0].lookAtY,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = null;

    // ── Camera ────────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );

    // ── Lights ────────────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0xffffff, 2));
    scene.add(new THREE.HemisphereLight(0xdce9ff, 0x8a7a6f, 1));
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5);
    sun.position.set(8, 15, 10);
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 1);
    fill.position.set(-8, 5, -5);
    scene.add(fill);

    // ── Load GLB ──────────────────────────────────────────────────────────────
    new GLTFLoader().load(
      "/edificio/EdificioProyecto.glb",
      (gltf) => {
        const building = gltf.scene;

        const box = new THREE.Box3().setFromObject(building);
        const size = box.getSize(new THREE.Vector3());
        building.scale.setScalar(20 / Math.max(size.x, size.y, size.z));

        const sb = new THREE.Box3().setFromObject(building);
        const sc = sb.getCenter(new THREE.Vector3());
        const ss = sb.getSize(new THREE.Vector3());
        building.position.set(-sc.x, -sb.min.y, -sc.z);

        const W = Math.max(ss.x, ss.z);
        const fovH =
          2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(30)) * camera.aspect
          );
        const dist = (W / 2) / Math.tan(fovH / 2) * 1.8;

        camera.position.set(KEYFRAMES[0].cameraX, KEYFRAMES[0].cameraY, dist);
        camera.lookAt(KEYFRAMES[0].cameraX, KEYFRAMES[0].lookAtY, 0);
        camera.far = dist * 100;
        camera.updateProjectionMatrix();

        const pivot = new THREE.Object3D();
        pivot.add(building);
        pivot.rotation.y = KEYFRAMES[0].rotationY;
        scene.add(pivot);
        stateRef.current.pivot = pivot;

        building.traverse((n) => {
          if (n instanceof THREE.Mesh) {
            n.castShadow = true;
            n.receiveShadow = true;
          }
        });
      },
      undefined,
      (e) => console.error("Error GLB:", e)
    );

    const onScroll = () => {
      const rawPoints = SECTION_SELECTORS.map((selector) => {
        const el = document.querySelector(selector) as HTMLElement | null;
        if (!el) return null;
        return el.getBoundingClientRect().top + window.scrollY;
      }).filter((v): v is number => v !== null);

      // Keep points strictly increasing even with overlapping sections/margins.
      const sectionPoints = rawPoints.reduce<number[]>((acc, p, i) => {
        if (i === 0) {
          acc.push(p);
        } else {
          acc.push(Math.max(p, acc[i - 1] + 1));
        }
        return acc;
      }, []);

      let progress = 0;
      const scrollPos = window.scrollY;

      if (sectionPoints.length >= 2) {
        if (scrollPos <= sectionPoints[0]) {
          progress = 0;
        } else if (scrollPos >= sectionPoints[sectionPoints.length - 1]) {
          progress = 1;
        } else {
          for (let i = 0; i < sectionPoints.length - 1; i++) {
            const a = sectionPoints[i];
            const b = sectionPoints[i + 1];
            if (scrollPos >= a && scrollPos <= b) {
              const t = (scrollPos - a) / Math.max(1, b - a);
              progress = (i + t) / (KEYFRAMES.length - 1);
              break;
            }
          }
        }
      } else {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        progress = window.scrollY / maxScroll;
      }

      progress = THREE.MathUtils.clamp(progress, 0, 1);
      const v = getValues(progress);
      stateRef.current.targetRotationY = v.rotationY;
      stateRef.current.targetCameraX = v.cameraX;
      stateRef.current.targetCameraY = v.cameraY;
      stateRef.current.targetLookAtY = v.lookAtY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    // ── Animation loop ────────────────────────────────────────────────────────
    const LERP = 0.14;
    let raf = 0;

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const s = stateRef.current;

      if (s.pivot) {
        s.pivot.rotation.y += (s.targetRotationY - s.pivot.rotation.y) * LERP;
      }
      camera.position.x += (s.targetCameraX - camera.position.x) * LERP;
      camera.position.y += (s.targetCameraY - camera.position.y) * LERP;
      camera.lookAt(camera.position.x, s.targetLookAtY, 0);

      renderer.render(scene, camera);
    };
    animate();

    // ── Resize ────────────────────────────────────────────────────────────────
    const onResize = () => {
      const c = mountRef.current;
      if (!c) return;
      camera.aspect = c.clientWidth / c.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(c.clientWidth, c.clientHeight);
      onScroll();
    };
    window.addEventListener("resize", onResize);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      scene.traverse((n) => {
        if (n instanceof THREE.Mesh) {
          n.geometry.dispose();
          if (Array.isArray(n.material)) n.material.forEach((m) => m.dispose());
          else n.material.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="landing-hero__building-scene" ref={mountRef} />;
}
