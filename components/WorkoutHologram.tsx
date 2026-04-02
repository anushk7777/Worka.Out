import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PersonalizedPlan } from '../types';

interface Props {
  workoutPlan: PersonalizedPlan;
}

const BODY_PARTS_DEFS = [
  { name: 'head', geo: () => new THREE.IcosahedronGeometry(1.4, 1), pos: [0, 10.5, 0], scale: [1, 1.2, 1] },
  { name: 'neck', geo: () => new THREE.CylinderGeometry(0.6, 0.8, 1.5, 8), pos: [0, 9, 0] },
  { name: 'chest', geo: () => new THREE.IcosahedronGeometry(2.8, 1), pos: [0, 6.5, 0.5], scale: [1.2, 1, 0.6] },
  { name: 'upper_back', geo: () => new THREE.IcosahedronGeometry(2.6, 1), pos: [0, 6.5, -0.8], scale: [1.2, 1, 0.4] },
  { name: 'lats', geo: () => new THREE.IcosahedronGeometry(2.4, 1), pos: [0, 4.5, -0.6], scale: [1.3, 1, 0.4] },
  { name: 'abs', geo: () => new THREE.IcosahedronGeometry(2.2, 1), pos: [0, 3.5, 0.4], scale: [1.1, 1.2, 0.6] },
  { name: 'pelvis', geo: () => new THREE.IcosahedronGeometry(2.4, 1), pos: [0, 1, 0], scale: [1.2, 0.8, 0.6] },
  { name: 'shoulder_l', geo: () => new THREE.IcosahedronGeometry(1.3, 1), pos: [-3.4, 7.5, 0] },
  { name: 'shoulder_r', geo: () => new THREE.IcosahedronGeometry(1.3, 1), pos: [3.4, 7.5, 0] },
  { name: 'bicep_l', geo: () => new THREE.CylinderGeometry(0.9, 0.7, 3, 8), pos: [-4.0, 4.5, 0], rot: [0, 0, 0.15] },
  { name: 'bicep_r', geo: () => new THREE.CylinderGeometry(0.9, 0.7, 3, 8), pos: [4.0, 4.5, 0], rot: [0, 0, -0.15] },
  { name: 'forearm_l', geo: () => new THREE.CylinderGeometry(0.7, 0.5, 2.8, 8), pos: [-4.4, 1.5, 0.2], rot: [-0.1, 0, 0.1] },
  { name: 'forearm_r', geo: () => new THREE.CylinderGeometry(0.7, 0.5, 2.8, 8), pos: [4.4, 1.5, 0.2], rot: [-0.1, 0, -0.1] },
  { name: 'quad_l', geo: () => new THREE.CylinderGeometry(1.4, 1.0, 4.5, 8), pos: [-1.4, -2.5, 0], rot: [0, 0, -0.05] },
  { name: 'quad_r', geo: () => new THREE.CylinderGeometry(1.4, 1.0, 4.5, 8), pos: [1.4, -2.5, 0], rot: [0, 0, 0.05] },
  { name: 'calf_l', geo: () => new THREE.CylinderGeometry(1.0, 0.6, 4.0, 8), pos: [-1.4, -7.5, -0.2] },
  { name: 'calf_r', geo: () => new THREE.CylinderGeometry(1.0, 0.6, 4.0, 8), pos: [1.4, -7.5, -0.2] },
];

const MUSCLE_MAP: Record<string, string[]> = {
  'chest': ['chest'],
  'back': ['upper_back', 'lats'], 
  'arms': ['bicep_l', 'bicep_r', 'forearm_l', 'forearm_r', 'shoulder_l', 'shoulder_r'],
  'shoulders': ['shoulder_l', 'shoulder_r'],
  'legs': ['quad_l', 'quad_r', 'calf_l', 'calf_r', 'pelvis'],
  'core': ['abs', 'pelvis'],
  'cardio': ['head', 'chest', 'abs', 'quad_l', 'quad_r'],
  'full_body': ['head', 'neck', 'chest', 'upper_back', 'lats', 'abs', 'pelvis', 'shoulder_l', 'shoulder_r', 'bicep_l', 'bicep_r', 'forearm_l', 'forearm_r', 'quad_l', 'quad_r', 'calf_l', 'calf_r']
};

export default function WorkoutHologram({ workoutPlan }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const groupRef = useRef<THREE.Group | null>(null);
  const reqRef = useRef<number>(0);
  const meshesRef = useRef<Record<string, THREE.Mesh>>({});

  const [activeDayIndex, setActiveDayIndex] = useState(0);

  const currentDay = workoutPlan.workout[activeDayIndex];
  
  // Helper to map focus string to a known muscle group
  const getTargetMuscle = (focus: string) => {
    const f = focus.toLowerCase();
    if (f.includes('chest')) return 'chest';
    if (f.includes('back')) return 'back';
    if (f.includes('leg') || f.includes('glute') || f.includes('quad') || f.includes('ham')) return 'legs';
    if (f.includes('arm') || f.includes('bi') || f.includes('tri')) return 'arms';
    if (f.includes('shoulder') || f.includes('delt')) return 'shoulders';
    if (f.includes('core') || f.includes('abs')) return 'core';
    if (f.includes('cardio') || f.includes('hiit')) return 'cardio';
    return 'full_body';
  };

  const targetMuscle = currentDay ? getTargetMuscle(currentDay.focus) : 'full_body';
  const intensity = 0.8; // High intensity for workout days

  const pointerDownPos = useRef({ x: 0, y: 0 });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    pointerDownPos.current = { x: event.clientX, y: event.clientY };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const dx = event.clientX - pointerDownPos.current.x;
    const dy = event.clientY - pointerDownPos.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // If moved more than 5 pixels, it's a drag, not a click
    if (distance > 5) return;

    if (!mountRef.current || !cameraRef.current || !groupRef.current) return;
    
    const rect = mountRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(groupRef.current.children);

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object as THREE.Mesh;
      let clickedPartName = '';
      for (const [name, mesh] of Object.entries(meshesRef.current)) {
        if (mesh === clickedMesh) {
          clickedPartName = name;
          break;
        }
      }

      if (clickedPartName) {
        let clickedMuscleGroup = 'full_body';
        // Prioritize specific muscle groups over full_body
        for (const [groupName, parts] of Object.entries(MUSCLE_MAP)) {
          if (parts.includes(clickedPartName) && groupName !== 'full_body' && groupName !== 'cardio') {
            clickedMuscleGroup = groupName;
            break;
          }
        }

        const dayIndex = workoutPlan.workout.findIndex(day => {
            const dayFocus = getTargetMuscle(day.focus);
            return dayFocus === clickedMuscleGroup || (clickedMuscleGroup === 'core' && dayFocus === 'back'); // Sometimes core is grouped with back
        });

        if (dayIndex !== -1) {
          setActiveDayIndex(dayIndex);
        }
      }
    }
  };

  // Performance Optimization: Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );
    if (mountRef.current) observer.observe(mountRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mountRef.current) return;

    // 1. Setup Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // 2. Setup Camera
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100);
    camera.position.set(0, 2, 35);
    cameraRef.current = camera;

    // 3. Setup Renderer (Optimized)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // Cap pixel ratio for performance
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;
    controlsRef.current = controls;

    // 4. Lighting (Cinematic Studio Setup)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x3b82f6, 0xff0000, 0.6); // Blue and Red
    hemiLight.position.set(0, 20, 0);
    scene.add(hemiLight);

    const blueLight = new THREE.PointLight(0x3b82f6, 400, 50); // Blue
    blueLight.position.set(-10, 10, -5);
    scene.add(blueLight);

    const redLight = new THREE.PointLight(0xff0000, 400, 50); // Red
    redLight.position.set(10, 10, -5);
    scene.add(redLight);

    const frontFill = new THREE.PointLight(0xffffff, 150, 50);
    frontFill.position.set(0, 5, 15);
    scene.add(frontFill);
    
    const backLight = new THREE.PointLight(0xffffff, 200, 50);
    backLight.position.set(0, 10, -15);
    scene.add(backLight);

    // 5. Materials (Premium Glass/Carbon Look)
    const baseMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0a1930, // Midnight blue
      metalness: 0.8,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transmission: 0.5, // Glass-like transmission
      thickness: 1.0, // Subsurface scattering effect
      ior: 1.5,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      flatShading: true,
    });

    // 6. Build Anatomy Group
    const group = new THREE.Group();
    group.position.y = 0;
    scene.add(group);
    groupRef.current = group;

    const geometries: THREE.BufferGeometry[] = [];

    BODY_PARTS_DEFS.forEach(part => {
      const geo = part.geo();
      geometries.push(geo);
      const mesh = new THREE.Mesh(geo, baseMaterial.clone());
      mesh.position.set(part.pos[0], part.pos[1], part.pos[2]);
      if (part.scale) mesh.scale.set(part.scale[0], part.scale[1], part.scale[2]);
      if (part.rot) mesh.rotation.set(part.rot[0], part.rot[1], part.rot[2]);
      
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      group.add(mesh);
      meshesRef.current[part.name] = mesh;
    });

    // 7. Handle Resize
    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return;
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      // Dispose geometries and materials
      geometries.forEach(geo => geo.dispose());
      Object.values(meshesRef.current).forEach((mesh: any) => {
        if (mesh.material instanceof THREE.Material) mesh.material.dispose();
      });
      renderer.dispose();
    };
  }, []);

  // Animation Loop (Only runs when visible)
  useEffect(() => {
    if (!isVisible || !rendererRef.current || !sceneRef.current || !cameraRef.current || !groupRef.current) return;

    let time = 0;
    const animate = () => {
      time += 0.01;
      
      // Gentle floating
      if (groupRef.current) {
        groupRef.current.position.y = Math.sin(time) * 0.5;
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Breathing effect on chest/abs
      if (meshesRef.current['chest']) {
        meshesRef.current['chest'].scale.z = 0.6 + Math.sin(time * 2) * 0.05;
        meshesRef.current['chest'].scale.x = 1.2 + Math.sin(time * 2) * 0.02;
      }

      rendererRef.current!.render(sceneRef.current!, cameraRef.current!);
      reqRef.current = requestAnimationFrame(animate);
    };

    reqRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [isVisible]);

  // Update Materials based on target muscle
  useEffect(() => {
    if (!meshesRef.current) return;

    const normalizedTarget = targetMuscle.toLowerCase().replace('-', '_');
    // Find matching muscle group, default to full_body if not found
    let activeParts = MUSCLE_MAP['full_body'];
    
    for (const key in MUSCLE_MAP) {
      if (normalizedTarget.includes(key)) {
        activeParts = MUSCLE_MAP[key];
        break;
      }
    }

    Object.entries(meshesRef.current).forEach(([name, mesh]: [string, any]) => {
      const mat = mesh.material as THREE.MeshPhysicalMaterial;
      const isActive = activeParts.includes(name);
      
      // Smoothly transition colors would be ideal, but for performance we snap
      if (isActive) {
        mat.color.setHex(0xff0033); // Bright red
        mat.emissive.setHex(0xff0000); // Pure red emissive
        mat.emissiveIntensity = 0.8 + (intensity * 2.0); // Pulse intensity
        mat.metalness = 0.4;
        mat.roughness = 0.1;
        mat.transmission = 0.9;
        mat.thickness = 2.0;
      } else {
        mat.color.setHex(0x0a1930); // Midnight blue
        mat.emissive.setHex(0x000a1a); // Very subtle blue emissive
        mat.emissiveIntensity = 0.2;
        mat.metalness = 0.7;
        mat.roughness = 0.15;
        mat.transmission = 0.8;
        mat.thickness = 1.5;
      }
      mat.needsUpdate = true;
    });
  }, [targetMuscle, intensity]);

  return (
    <div className="relative w-full rounded-[32px] overflow-hidden bg-[#020617] border border-blue-900/30 shadow-[0_0_40px_rgba(30,58,138,0.2)] group flex flex-col md:flex-row min-h-[500px]">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent opacity-60 pointer-events-none"></div>
      
      {/* 3D Canvas Container */}
      <div className="relative w-full md:w-1/2 h-[300px] md:h-auto">
        <div ref={mountRef} className="w-full h-full absolute inset-0 z-10 cursor-pointer" onPointerDown={handlePointerDown} onPointerUp={handlePointerUp}></div>
        
        {/* Overlay UI */}
        <div className="absolute bottom-6 left-6 z-20 pointer-events-none">
          <div className="bg-[#0f172a]/80 backdrop-blur-md border border-blue-500/20 rounded-2xl p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            <p className="text-[10px] text-red-500 font-black uppercase tracking-widest mb-1">Target Zone</p>
            <p className="text-white font-bold capitalize text-lg">{targetMuscle.replace('_', ' ')}</p>
            <div className="flex gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`h-1 w-4 rounded-full ${i < Math.ceil(intensity * 5) ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' : 'bg-white/10'}`}></div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Workout Details */}
      <div className="relative z-20 w-full md:w-1/2 p-6 flex flex-col bg-gradient-to-l from-[#020617]/90 to-transparent">
        <div className="flex overflow-x-auto gap-2 pb-4 mb-4 hide-scrollbar">
          {workoutPlan.workout.map((day, idx) => (
            <button
              key={idx}
              onClick={() => setActiveDayIndex(idx)}
              className={`whitespace-nowrap px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeDayIndex === idx ? 'bg-red-600 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]' : 'bg-blue-900/20 text-blue-200 hover:bg-blue-800/40 hover:text-white'}`}
            >
              {day.day}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
          <h3 className="text-xl font-black text-white mb-4">{currentDay.focus}</h3>
          {currentDay.exercises.map((ex, idx) => (
            <div key={idx} className="bg-blue-950/30 border border-blue-900/40 p-4 rounded-2xl hover:bg-blue-900/50 transition-colors group/ex">
              <div className="flex justify-between items-start mb-2">
                <h4 className="text-blue-50 font-bold text-sm">{ex.name}</h4>
                <div className="bg-red-500/10 text-red-400 text-[10px] font-black px-2 py-1 rounded-lg border border-red-500/20">
                  {ex.sets} × {ex.reps}
                </div>
              </div>
              {ex.notes && (
                <p className="text-xs text-blue-200/60 mt-2 leading-relaxed opacity-80 group-hover/ex:opacity-100 transition-opacity">
                  <i className="fas fa-info-circle mr-1 text-red-400/70"></i>
                  {ex.notes}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* High-Tech Scanning Line */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-30 animate-scan pointer-events-none"></div>
    </div>
  );
}
