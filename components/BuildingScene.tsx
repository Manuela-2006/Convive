"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const KEYFRAMES = [
  { rotationY: Math.PI, cameraX: 0, cameraY: 22, lookAtY: 22 }, // S1 delantera
  { rotationY: Math.PI * 2, cameraX: 0, cameraY: 17, lookAtY: 17 }, // S2 trasera
  { rotationY: Math.PI * 3, cameraX: 0, cameraY: 12, lookAtY: 12 }, // S3 delantera
  { rotationY: Math.PI * 4, cameraX: 0, cameraY: 7, lookAtY: 7 }, // S4 trasera
  { rotationY: Math.PI * 5, cameraX: 0, cameraY: 3.5, lookAtY: 3.5 }, // S5 delantera
];
const LARGE_SCREEN_MIN_WIDTH = 1600;
const SECTION_FIVE_EXTRA_CAMERA_Y = 0.2;
const SECTION_IDS = [
  "landing-section-one",
  "landing-section-two",
  "landing-section-three",
  "landing-section-four",
  "landing-section-five",
] as const;

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
  modelWidth: number;
  cameraDistance: number;
  targetRotationY: number;
  targetCameraX: number;
  targetCameraY: number;
  targetLookAtY: number;
};

export default function BuildingScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<State>({
    pivot: null,
    modelWidth: 20,
    cameraDistance: 40,
    targetRotationY: KEYFRAMES[0].rotationY,
    targetCameraX: KEYFRAMES[0].cameraX,
    targetCameraY: KEYFRAMES[0].cameraY,
    targetLookAtY: KEYFRAMES[0].lookAtY,
  });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.zIndex = "0";
    renderer.domElement.style.pointerEvents = "none";
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null;

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      2000
    );

    scene.add(new THREE.AmbientLight(0xffffff, 2));
    scene.add(new THREE.HemisphereLight(0xdce9ff, 0x8a7a6f, 1));
    const sun = new THREE.DirectionalLight(0xfff5e0, 2.5);
    sun.position.set(8, 15, 10);
    sun.castShadow = true;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xc8d8ff, 1);
    fill.position.set(-8, 5, -5);
    scene.add(fill);

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
        stateRef.current.modelWidth = W;
        stateRef.current.cameraDistance = dist;

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

    let stabilizeTimer: number | null = null;

    const computeProgress = () => {
      const tops = SECTION_IDS.map((id) => {
        const el = document.getElementById(id);
        return el ? el.offsetTop : 0;
      });

      const y = window.scrollY;
      const segmentCount = KEYFRAMES.length - 1;
      let progress = 0;

      if (y <= tops[0]) {
        progress = 0;
      } else if (y >= tops[tops.length - 1]) {
        progress = 1;
      } else {
        for (let i = 0; i < tops.length - 1; i += 1) {
          const start = tops[i];
          const end = tops[i + 1];
          if (y >= start && y < end) {
            const localT = THREE.MathUtils.clamp(
              (y - start) / Math.max(1, end - start),
              0,
              1
            );
            progress = (i + localT) / segmentCount;
            break;
          }
        }
      }

      const v = getValues(progress);

      // Only on large screens: lift camera slightly in the last section (PB)
      // without changing laptop behavior or earlier sections.
      if (window.innerWidth >= LARGE_SCREEN_MIN_WIDTH) {
        const sectionFiveT = THREE.MathUtils.clamp((progress - 0.75) / 0.25, 0, 1);
        const extraY = SECTION_FIVE_EXTRA_CAMERA_Y * sectionFiveT;
        v.cameraY += extraY;
        v.lookAtY += extraY;
      }

      stateRef.current.targetRotationY = v.rotationY;
      stateRef.current.targetCameraX = v.cameraX;
      stateRef.current.targetCameraY = v.cameraY;
      stateRef.current.targetLookAtY = v.lookAtY;
    };

    const onScroll = () => computeProgress();

    const ro = new ResizeObserver(() => {
      if (stabilizeTimer) window.clearTimeout(stabilizeTimer);
      stabilizeTimer = window.setTimeout(() => {
        computeProgress();
      }, 50);
    });
    ro.observe(document.body);

    window.addEventListener("scroll", onScroll, { passive: true });
    computeProgress();

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
      camera.lookAt(0, s.targetLookAtY, 0);

      renderer.render(scene, camera);
    };
    animate();

    const onResize = () => {
      const c = mountRef.current;
      if (!c) return;
      camera.aspect = c.clientWidth / c.clientHeight;

      const fovH =
        2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(30)) * camera.aspect);
      const dist =
        (stateRef.current.modelWidth / 2) / Math.tan(fovH / 2) * 1.8;
      stateRef.current.cameraDistance = dist;
      camera.position.z = dist;
      camera.far = dist * 100;

      camera.updateProjectionMatrix();
      renderer.setSize(c.clientWidth, c.clientHeight);
      computeProgress();
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      if (stabilizeTimer) window.clearTimeout(stabilizeTimer);
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

  return (
    <div className="landing-hero__building-scene">
      <div className="landing-hero__building-canvas" ref={mountRef} />
      <div className="landing-hero__building-overlay-dark" aria-hidden="true" />
      <div className="landing-hero__building-overlay-glass" aria-hidden="true" />
    </div>
  );
}
