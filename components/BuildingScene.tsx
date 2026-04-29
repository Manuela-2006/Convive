"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

type SceneState = {
  building?: THREE.Group;
  targetRotationY: number;
};

export default function BuildingScene() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<SceneState>({ targetRotationY: 0 });

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
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

    const loader = new GLTFLoader();
    // Ajuste para arrancar de frente en este modelo.
    const baseRotationY = Math.PI;

    loader.load(
      "/edificio/EdificioProyecto.glb",
      (gltf) => {
        const building = gltf.scene;

        const box = new THREE.Box3().setFromObject(building);
        const size = box.getSize(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const targetSize = 20;
        const scaleFactor = targetSize / maxDim;
        building.scale.setScalar(scaleFactor);

        const scaledBox = new THREE.Box3().setFromObject(building);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3());

        building.position.x = -scaledCenter.x;
        building.position.y = -scaledBox.min.y;
        building.position.z = -scaledCenter.z;

        const W = Math.max(scaledSize.x, scaledSize.z);
        const H = scaledSize.y;

        const fovH =
          2 *
          Math.atan(
            Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect
          );
        const distance = (W / 2) / Math.tan(fovH / 2) * 1.84;

        // Frontal real: camara por debajo de la cubierta para evitar ver la tapa superior.
        // Ajuste en X para centrar la linea frontal de azotea (evitar que arranque cargado a la derecha).
        const frontLineY = H * 0.02;
        const centerOffsetX = -W * 0.095;
        camera.position.set(centerOffsetX, frontLineY, distance);
        camera.lookAt(centerOffsetX, frontLineY, 0);
        camera.near = 0.1;
        camera.far = distance * 100;
        camera.updateProjectionMatrix();

        // Deja visible solo la franja alta del edificio.
        building.position.y -= H * 1.05;

        building.rotation.y = baseRotationY;
        sceneRef.current.targetRotationY = baseRotationY;

        building.traverse((node) => {
          if (node instanceof THREE.Mesh) {
            node.castShadow = true;
            node.receiveShadow = true;
          }
        });

        scene.add(building);
        sceneRef.current.building = building;
        handleScroll();
      },
      undefined,
      (error) => {
        console.error("Error loading building GLB:", error);
      }
    );

    const scrollRange = 3000;
    const startScrollY = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const downScroll = Math.max(0, currentScrollY - startScrollY);
      const turns = (downScroll / scrollRange) * (Math.PI * 2);
      sceneRef.current.targetRotationY = baseRotationY + turns;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    let raf = 0;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      const { building, targetRotationY } = sceneRef.current;
      if (building) {
        building.rotation.y += (targetRotationY - building.rotation.y) * 0.07;
      }
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      const c = mountRef.current;
      if (!c) return;
      camera.aspect = c.clientWidth / c.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(c.clientWidth, c.clientHeight);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      scene.traverse((node) => {
        if (node instanceof THREE.Mesh) {
          node.geometry.dispose();
          if (Array.isArray(node.material)) node.material.forEach((m) => m.dispose());
          else node.material.dispose();
        }
      });
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div className="landing-hero__building-scene" ref={mountRef} />;
}
