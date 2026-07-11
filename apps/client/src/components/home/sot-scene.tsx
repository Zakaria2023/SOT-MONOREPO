"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import { FontLoader } from "three/examples/jsm/loaders/FontLoader.js";

type OrbitNode = {
  mesh: THREE.Mesh;
  line: THREE.Line;
  radiusX: number;
  radiusY: number;
  speed: number;
  phase: number;
  tilt: number;
};

const NODE_COLORS = [0x22d3ee, 0x8b7bff, 0x7e8dff, 0x34e29b, 0x22d3ee, 0xb77cff];

// Real WebGL scene: extruded "SOT" in dark chrome, cyan/violet point lights,
// and six glowing nodes orbiting on elliptical paths wired back to the centre.
export const SotScene = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100,
    );
    camera.position.set(0, 0, 9);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x223055, 0.6));
    const cyanLight = new THREE.PointLight(0x22d3ee, 120, 40);
    cyanLight.position.set(-6, 3, 6);
    scene.add(cyanLight);
    const violetLight = new THREE.PointLight(0x8b7bff, 120, 40);
    violetLight.position.set(6, -2, 5);
    scene.add(violetLight);
    const keyLight = new THREE.DirectionalLight(0xffffff, 0.5);
    keyLight.position.set(0, 5, 8);
    scene.add(keyLight);

    const textGroup = new THREE.Group();
    scene.add(textGroup);
    const nodeGroup = new THREE.Group();
    scene.add(nodeGroup);

    const nodeGeometry = new THREE.SphereGeometry(0.12, 16, 16);
    const nodes: OrbitNode[] = [];
    for (let i = 0; i < 6; i++) {
      const color = NODE_COLORS[i] ?? 0x22d3ee;
      const mesh = new THREE.Mesh(
        nodeGeometry,
        new THREE.MeshBasicMaterial({ color }),
      );
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 16, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18 }),
      );
      mesh.add(glow);
      nodeGroup.add(mesh);

      const lineGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(),
        new THREE.Vector3(),
      ]);
      const line = new THREE.Line(
        lineGeometry,
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.22 }),
      );
      nodeGroup.add(line);

      nodes.push({
        mesh,
        line,
        radiusX: 3 + Math.random() * 1.4,
        radiusY: 1.5 + Math.random() * 1.2,
        speed: 0.25 + Math.random() * 0.35,
        phase: (i / 6) * Math.PI * 2,
        tilt: (Math.random() - 0.5) * 0.9,
      });
    }

    let disposed = false;
    const fontLoader = new FontLoader();
    fontLoader.load("/fonts/helvetiker_bold.typeface.json", (font) => {
      if (disposed) {
        return;
      }
      const geometry = new TextGeometry("SOT", {
        font,
        size: 2.3,
        depth: 0.6,
        curveSegments: 8,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.04,
        bevelSegments: 4,
      });
      geometry.center();
      const material = new THREE.MeshPhysicalMaterial({
        color: 0x0b1220,
        metalness: 0.92,
        roughness: 0.22,
        clearcoat: 1,
        clearcoatRoughness: 0.3,
        emissive: 0x0a1a34,
        emissiveIntensity: 0.45,
      });
      textGroup.add(new THREE.Mesh(geometry, material));
    });

    const pointer = { x: 0, y: 0 };
    const onPointerMove = (event: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointer.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    window.addEventListener("mousemove", onPointerMove);

    const clock = new THREE.Clock();
    let frame = 0;
    const render = () => {
      const time = clock.getElapsedTime();

      // Sway left/right only — never spin round to the mirrored back face.
      textGroup.rotation.y = Math.sin(time * 0.5) * 0.5 + pointer.x * 0.45;
      textGroup.rotation.x = pointer.y * 0.2;
      textGroup.position.y = Math.sin(time * 0.8) * 0.15;

      for (const node of nodes) {
        const angle = time * node.speed + node.phase;
        const x = Math.cos(angle) * node.radiusX;
        const y = Math.sin(angle) * node.radiusY + node.tilt;
        const z = Math.sin(angle) * node.radiusX * 0.4;
        node.mesh.position.set(x, y, z);
        const position = node.line.geometry.getAttribute(
          "position",
        ) as THREE.BufferAttribute;
        position.setXYZ(0, 0, 0, 0);
        position.setXYZ(1, x, y, z);
        position.needsUpdate = true;
      }
      nodeGroup.rotation.y = time * 0.05 + pointer.x * 0.2;

      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      nodeGeometry.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="h-full w-full" />;
};
