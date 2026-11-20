import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { TelemetryPayload, WorldConfig, Waypoint } from '../../types';
import { ArtificialHorizon } from '../HUD/ArtificialHorizon';
import { Eye, Compass, Move3d, Crosshair, PlusCircle } from 'lucide-react';

interface Props {
  telemetry: TelemetryPayload | null;
  world: WorldConfig | null;
  onAddWaypoint?: (x: number, y: number, z: number) => void;
}

type CameraMode = 'CHASE' | 'FREE' | 'FPV' | 'TOPDOWN';

export const ROVScene: React.FC<Props> = ({ telemetry, world, onAddWaypoint }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>('CHASE');
  const [hudVisible, setHudVisible] = useState<boolean>(true);

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const rovGroupRef = useRef<THREE.Group | null>(null);
  const propellersRef = useRef<THREE.Mesh[]>([]);
  const sonarLinesRef = useRef<THREE.Line[]>([]);
  const breadcrumbsRef = useRef<THREE.Line | null>(null);
  const breadcrumbsPointsRef = useRef<THREE.Vector3[]>([]);
  const waypointsGroupRef = useRef<THREE.Group | null>(null);
  const obstaclesGroupRef = useRef<THREE.Group | null>(null);

  // Mouse interaction state for free camera
  const mouseState = useRef({
    isDragging: false,
    prevX: 0,
    prevY: 0,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    radius: 12.0,
    target: new THREE.Vector3(0, -2, 0)
  });

  // Coordinate Conversion Helper:
  // Robotics World Frame: X: East, Y: North, Z: Depth (downwards > 0)
  // Three.js Frame: X: East (x), Y: Height (-z), Z: North (y)
  const toThreeCoords = useCallback((rx: number, ry: number, rz: number): THREE.Vector3 => {
    return new THREE.Vector3(rx, -rz, ry);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040e1d);
    scene.fog = new THREE.FogExp2(0x06152b, 0.022);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 200);
    camera.position.set(0, 5, 12);
    cameraRef.current = camera;

    // 3. Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Underwater Lighting
    const ambientLight = new THREE.AmbientLight(0x0b2545, 1.4);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
    sunLight.position.set(20, 40, 20);
    scene.add(sunLight);

    // Deep water back-fill
    const fillLight = new THREE.DirectionalLight(0x0284c7, 0.8);
    fillLight.position.set(-20, -30, -20);
    scene.add(fillLight);

    // 5. Ocean Surface Plane (Y = 0)
    const surfaceGeo = new THREE.PlaneGeometry(120, 120, 24, 24);
    const surfaceMat = new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.25,
      wireframe: true,
      side: THREE.DoubleSide
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.rotation.x = Math.PI / 2;
    surfaceMesh.position.y = 0;
    scene.add(surfaceMesh);

    // 6. Seabed Sand Plane with Grid (Y = -35)
    const seabedGeo = new THREE.PlaneGeometry(100, 100, 32, 32);
    const seabedMat = new THREE.MeshStandardMaterial({
      color: 0x0f2b48,
      roughness: 0.9,
      metalness: 0.1
    });
    const seabedMesh = new THREE.Mesh(seabedGeo, seabedMat);
    seabedMesh.rotation.x = -Math.PI / 2;
    seabedMesh.position.y = -35;
    scene.add(seabedMesh);

    // Grid on seabed for spatial orientation
    const grid = new THREE.GridHelper(90, 45, 0x00e5ff, 0x1a3a60);
    grid.position.y = -34.9;
    scene.add(grid);

    // 7. ROV 3D Vehicle Model Assembly
    const rovGroup = new THREE.Group();
    rovGroupRef.current = rovGroup;

    // A. Main Pressure Hull (Chassis)
    const hullGeo = new THREE.CylinderGeometry(0.35, 0.35, 1.2, 16);
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.7,
      roughness: 0.3
    });
    const hull = new THREE.Mesh(hullGeo, hullMat);
    hull.rotation.x = Math.PI / 2;
    rovGroup.add(hull);

    // B. High-Visibility Buoyancy Foam Blocks (Top Port & Starboard)
    const foamGeo = new THREE.BoxGeometry(0.25, 0.18, 1.1);
    const foamMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.4,
      metalness: 0.1
    });
    const foamRight = new THREE.Mesh(foamGeo, foamMat);
    foamRight.position.set(0.28, 0.22, 0);
    rovGroup.add(foamRight);

    const foamLeft = new THREE.Mesh(foamGeo, foamMat);
    foamLeft.position.set(-0.28, 0.22, 0);
    rovGroup.add(foamLeft);

    // C. Acrylic Front Camera Dome
    const domeGeo = new THREE.SphereGeometry(0.32, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.65,
      roughness: 0.1,
      metalness: 0.1,
      transmission: 0.8
    });
    const dome = new THREE.Mesh(domeGeo, domeMat);
    dome.rotation.x = -Math.PI / 2;
    dome.position.set(0, 0, 0.6);
    rovGroup.add(dome);

    // D. Dual LED Spotlights
    const ledMat = new THREE.MeshBasicMaterial({ color: 0xecfeff });
    const spotGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.15, 12);
    spotGeo.rotateX(Math.PI / 2);

    const lightR = new THREE.Mesh(spotGeo, ledMat);
    lightR.position.set(0.32, -0.05, 0.55);
    rovGroup.add(lightR);

    const lightL = new THREE.Mesh(spotGeo, ledMat);
    lightL.position.set(-0.32, -0.05, 0.55);
    rovGroup.add(lightL);

    // Forward SpotLight (Real dynamic lighting cone)
    const rovSpot = new THREE.SpotLight(0x00e5ff, 3.5, 25, Math.PI / 5, 0.5);
    rovSpot.position.set(0, 0, 0.6);
    rovSpot.target.position.set(0, 0, 8);
    rovGroup.add(rovSpot);
    rovGroup.add(rovSpot.target);

    // E. 6 Thruster Housings & Propellers
    const thrusterProps: THREE.Mesh[] = [];
    const thrusterMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const propMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, metalness: 0.5 });

    const createThruster = (x: number, y: number, z: number, rotY: number, rotX: number = 0) => {
      const ductGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.22, 12, 1, true);
      const duct = new THREE.Mesh(ductGeo, thrusterMat);
      duct.position.set(x, y, z);
      duct.rotation.y = rotY;
      duct.rotation.x = rotX;

      const propGeo = new THREE.BoxGeometry(0.2, 0.02, 0.04);
      const prop = new THREE.Mesh(propGeo, propMat);
      duct.add(prop);
      thrusterProps.push(prop);
      rovGroup.add(duct);
    };

    // Horizontal Vectored Thrusters at 45 degrees
    createThruster(0.38, 0.0, 0.35, -Math.PI / 4, Math.PI / 2);  // T1: Front Starboard
    createThruster(-0.38, 0.0, 0.35, Math.PI / 4, Math.PI / 2);   // T2: Front Port
    createThruster(0.38, 0.0, -0.35, Math.PI / 4, Math.PI / 2);   // T3: Aft Starboard
    createThruster(-0.38, 0.0, -0.35, -Math.PI / 4, Math.PI / 2); // T4: Aft Port

    // Vertical Thrusters (Heave)
    createThruster(0.25, 0.0, 0.0, 0, 0);  // T5: Vert Starboard
    createThruster(-0.25, 0.0, 0.0, 0, 0); // T6: Vert Port

    propellersRef.current = thrusterProps;

    // F. Manipulator Robotic Arm
    const armMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.6 });
    const armBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.3), armMat);
    armBase.position.set(0, -0.25, 0.5);
    armBase.rotation.x = Math.PI / 6;
    rovGroup.add(armBase);

    scene.add(rovGroup);

    // 8. Sonar Beam Ray Visualizers (7 beams)
    const sonarLines: THREE.Line[] = [];
    for (let i = 0; i < 7; i++) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0.6),
        new THREE.Vector3(0, 0, 8)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: 0x00e5ff,
        transparent: true,
        opacity: 0.65,
        linewidth: 2
      });
      const line = new THREE.Line(lineGeo, lineMat);
      sonarLines.push(line);
      rovGroup.add(line);
    }
    sonarLinesRef.current = sonarLines;

    // 9. Trajectory Breadcrumbs Line
    const trailGeo = new THREE.BufferGeometry();
    const trailMat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.5
    });
    const trail = new THREE.Line(trailGeo, trailMat);
    scene.add(trail);
    breadcrumbsRef.current = trail;

    // 10. Groups for Obstacles & Waypoints
    const obsGroup = new THREE.Group();
    scene.add(obsGroup);
    obstaclesGroupRef.current = obsGroup;

    const wpGroup = new THREE.Group();
    scene.add(wpGroup);
    waypointsGroupRef.current = wpGroup;

    // Resize handler
    const handleResize = () => {
      if (!containerRef.current || !renderer || !camera) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Mouse Controls for Free Camera mode
    const dom = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => {
      mouseState.current.isDragging = true;
      mouseState.current.prevX = e.clientX;
      mouseState.current.prevY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!mouseState.current.isDragging) return;
      const dx = e.clientX - mouseState.current.prevX;
      const dy = e.clientY - mouseState.current.prevY;
      mouseState.current.prevX = e.clientX;
      mouseState.current.prevY = e.clientY;

      mouseState.current.theta -= dx * 0.008;
      mouseState.current.phi = Math.max(0.1, Math.min(Math.PI - 0.1, mouseState.current.phi - dy * 0.008));
    };

    const onMouseUp = () => {
      mouseState.current.isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      mouseState.current.radius = Math.max(2.5, Math.min(60.0, mouseState.current.radius + e.deltaY * 0.02));
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel);

    // Animation Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);

      // Rotate thrusters for dynamic animation
      thrusterProps.forEach((p, idx) => {
        p.rotation.y += 0.2 + (idx % 2 === 0 ? 0.05 : -0.05);
      });

      // Camera view update
      if (camera && rovGroup) {
        const rovPos = rovGroup.position;
        const rovYaw = rovGroup.rotation.y;

        if (cameraMode === 'CHASE') {
          // Smooth chase camera behind ROV
          const chaseDist = 5.5;
          const chaseHeight = 2.0;
          const targetCamX = rovPos.x - Math.sin(rovYaw) * chaseDist;
          const targetCamZ = rovPos.z - Math.cos(rovYaw) * chaseDist;
          const targetCamY = rovPos.y + chaseHeight;

          camera.position.lerp(new THREE.Vector3(targetCamX, targetCamY, targetCamZ), 0.08);
          camera.lookAt(rovPos.x, rovPos.y + 0.2, rovPos.z);
        } else if (cameraMode === 'FPV') {
          // Cockpit camera positioned inside acrylic dome looking forward
          camera.position.set(rovPos.x, rovPos.y + 0.05, rovPos.z);
          const lookX = rovPos.x + Math.sin(rovYaw) * 10;
          const lookZ = rovPos.z + Math.cos(rovYaw) * 10;
          camera.lookAt(lookX, rovPos.y + 0.05, lookZ);
        } else if (cameraMode === 'TOPDOWN') {
          // Tactical 2D/3D Map View
          camera.position.lerp(new THREE.Vector3(rovPos.x, rovPos.y + 24.0, rovPos.z + 0.1), 0.1);
          camera.lookAt(rovPos.x, rovPos.y, rovPos.z);
        } else {
          // Free Orbit Controls
          const st = mouseState.current;
          const cx = rovPos.x + st.radius * Math.sin(st.phi) * Math.sin(st.theta);
          const cy = rovPos.y + st.radius * Math.cos(st.phi);
          const cz = rovPos.z + st.radius * Math.sin(st.phi) * Math.cos(st.theta);
          camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.15);
          camera.lookAt(rovPos.x, rovPos.y, rovPos.z);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      if (renderer.domElement && containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [cameraMode, toThreeCoords]);

  // Update Obstacles when world config loads
  useEffect(() => {
    if (!world || !obstaclesGroupRef.current) return;
    const group = obstaclesGroupRef.current;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    world.obstacles.forEach((obs) => {
      const pos = toThreeCoords(obs.x, obs.y, obs.z);
      // Create pillar obstacle
      const geo = new THREE.CylinderGeometry(obs.radius, obs.radius * 1.1, obs.height, 16);
      const mat = new THREE.MeshStandardMaterial({
        color: obs.color || 0x475569,
        roughness: 0.8,
        metalness: 0.2
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);

      // Warning beacon ring around obstacle base
      const ringGeo = new THREE.RingGeometry(obs.radius, obs.radius + 0.35, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(pos.x, -34.8, pos.z);

      group.add(mesh);
      group.add(ring);
    });
  }, [world, toThreeCoords]);

  // Update Waypoints Visualization
  useEffect(() => {
    if (!telemetry?.navigation?.waypoints || !waypointsGroupRef.current) return;
    const group = waypointsGroupRef.current;
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }

    const waypoints = telemetry.navigation.waypoints;
    const points: THREE.Vector3[] = [];

    waypoints.forEach((wp, idx) => {
      const pos = toThreeCoords(wp.x, wp.y, wp.z);
      points.push(pos);

      // Glowing waypoint beacon beacon sphere
      const sphereGeo = new THREE.SphereGeometry(0.35, 12, 12);
      const isReached = wp.reached;
      const isCurrent = idx === telemetry.navigation.current_wp_index;

      const sphereMat = new THREE.MeshStandardMaterial({
        color: isReached ? 0x10b981 : (isCurrent ? 0x00e5ff : 0xf59e0b),
        emissive: isReached ? 0x059669 : (isCurrent ? 0x00e5ff : 0xd97706),
        emissiveIntensity: 0.6,
        roughness: 0.3
      });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.copy(pos);
      group.add(sphere);

      // Vertical guide beam connecting waypoint to surface
      const beamGeo = new THREE.CylinderGeometry(0.04, 0.04, 35, 8);
      const beamMat = new THREE.MeshBasicMaterial({
        color: isCurrent ? 0x00e5ff : 0x0284c7,
        transparent: true,
        opacity: isCurrent ? 0.45 : 0.2
      });
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(pos.x, -17.5, pos.z);
      group.add(beam);
    });

    // Connecting path line between waypoints
    if (points.length >= 2) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
      const lineMat = new THREE.LineDashedMaterial({
        color: 0x00e5ff,
        dashSize: 0.6,
        gapSize: 0.3,
        transparent: true,
        opacity: 0.7
      });
      const line = new THREE.Line(lineGeo, lineMat);
      line.computeLineDistances();
      group.add(line);
    }
  }, [telemetry?.navigation, toThreeCoords]);

  // Update Dynamic ROV State, Sonar Rays, and Breadcrumbs on Telemetry Frame
  useEffect(() => {
    if (!telemetry || !rovGroupRef.current) return;
    const pos = telemetry.position;
    const ori = telemetry.orientation;
    const sonar = telemetry.sensors.sonar;

    // Convert coordinates: X: East, Y: North, Z: Depth (downwards)
    const threePos = toThreeCoords(pos.x, pos.y, pos.z);
    rovGroupRef.current.position.copy(threePos);

    // Orientation: Three.js Euler (Y: Yaw, X: Pitch, Z: Roll)
    // Note: Heading is clockwise from North in navigation, Three.js Y rotation is counter-clockwise
    const yawRad = THREE.MathUtils.degToRad(ori.yaw_deg);
    const pitchRad = THREE.MathUtils.degToRad(ori.pitch_deg);
    const rollRad = THREE.MathUtils.degToRad(ori.roll_deg);

    rovGroupRef.current.rotation.set(pitchRad, yawRad, rollRad, 'YXZ');

    // Update Sonar Rays
    if (sonar && sonar.beams && sonarLinesRef.current.length > 0) {
      sonar.beams.forEach((beam, idx) => {
        if (idx < sonarLinesRef.current.length) {
          const line = sonarLinesRef.current[idx];
          const dist = Math.min(beam.distance_m, 25.0);
          const angleRad = THREE.MathUtils.degToRad(beam.relative_angle_deg);

          // Ray endpoint relative to ROV body
          const targetX = Math.sin(angleRad) * dist;
          const targetZ = Math.cos(angleRad) * dist;

          const positions = line.geometry.attributes.position.array as Float32Array;
          // Point 1 (emitter)
          positions[0] = 0;
          positions[1] = 0;
          positions[2] = 0.6;
          // Point 2 (hit)
          positions[3] = targetX;
          positions[4] = 0;
          positions[5] = targetZ;
          line.geometry.attributes.position.needsUpdate = true;

          // Color based on beam proximity
          const mat = line.material as THREE.LineBasicMaterial;
          if (dist < 1.6) {
            mat.color.setHex(0xef4444); // Critical red
            mat.opacity = 0.95;
          } else if (dist < 3.5) {
            mat.color.setHex(0xeab308); // Warning yellow
            mat.opacity = 0.75;
          } else {
            mat.color.setHex(0x00e5ff); // Clear cyan
            mat.opacity = 0.45;
          }
        }
      });
    }

    // Update Breadcrumbs (every ~500ms or when moved > 0.5m)
    const pts = breadcrumbsPointsRef.current;
    if (pts.length === 0 || pts[pts.length - 1].distanceTo(threePos) > 0.4) {
      pts.push(threePos.clone());
      if (pts.length > 150) pts.shift();

      if (breadcrumbsRef.current) {
        breadcrumbsRef.current.geometry.setFromPoints(pts);
      }
    }
  }, [telemetry, toThreeCoords]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden border border-cyan-500/20 bg-navy-950 shadow-2xl">
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Artificial Horizon HUD Overlay */}
      {hudVisible && telemetry && (
        <ArtificialHorizon
          orientation={telemetry.orientation}
          depth={telemetry.position.z}
          velocity={telemetry.velocity}
        />
      )}

      {/* Camera & Overlay Controls Bar */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-navy-950/85 p-1 rounded-lg border border-cyan-500/30 backdrop-blur-md z-10 text-xs">
        <button
          onClick={() => setCameraMode('CHASE')}
          className={`px-2.5 py-1 rounded flex items-center gap-1 font-medium transition-all ${
            cameraMode === 'CHASE' ? 'bg-cyan-500 text-navy-950 font-bold shadow-md' : 'text-slate-300 hover:text-cyan-300'
          }`}
          title="Smooth Chase Camera"
        >
          <Move3d className="w-3.5 h-3.5" />
          Chase
        </button>

        <button
          onClick={() => setCameraMode('FREE')}
          className={`px-2.5 py-1 rounded flex items-center gap-1 font-medium transition-all ${
            cameraMode === 'FREE' ? 'bg-cyan-500 text-navy-950 font-bold shadow-md' : 'text-slate-300 hover:text-cyan-300'
          }`}
          title="Orbit / Free Navigation (Drag to rotate, scroll to zoom)"
        >
          <Eye className="w-3.5 h-3.5" />
          Orbit
        </button>

        <button
          onClick={() => setCameraMode('FPV')}
          className={`px-2.5 py-1 rounded flex items-center gap-1 font-medium transition-all ${
            cameraMode === 'FPV' ? 'bg-cyan-500 text-navy-950 font-bold shadow-md' : 'text-slate-300 hover:text-cyan-300'
          }`}
          title="First-Person Submersible Camera View"
        >
          <Crosshair className="w-3.5 h-3.5" />
          FPV
        </button>

        <button
          onClick={() => setCameraMode('TOPDOWN')}
          className={`px-2.5 py-1 rounded flex items-center gap-1 font-medium transition-all ${
            cameraMode === 'TOPDOWN' ? 'bg-cyan-500 text-navy-950 font-bold shadow-md' : 'text-slate-300 hover:text-cyan-300'
          }`}
          title="Top-Down Tactical Sonar View"
        >
          <Compass className="w-3.5 h-3.5" />
          Map
        </button>

        <div className="h-4 w-px bg-cyan-500/30 mx-0.5" />

        <button
          onClick={() => setHudVisible(!hudVisible)}
          className={`px-2 py-1 rounded transition-colors ${
            hudVisible ? 'text-cyan-400 hover:text-cyan-300' : 'text-slate-500 hover:text-slate-300'
          }`}
          title="Toggle Avionics / Flight HUD"
        >
          HUD
        </button>
      </div>

      {/* Threat Level Sonar Alert Badge */}
      {telemetry?.sensors?.sonar?.threat_level && telemetry.sensors.sonar.threat_level !== 'CLEAR' && (
        <div
          className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg border font-mono text-xs font-bold flex items-center gap-2 backdrop-blur-md animate-pulse ${
            telemetry.sensors.sonar.threat_level === 'CRITICAL'
              ? 'bg-red-950/80 border-red-500 text-red-300 shadow-[0_0_15px_rgba(239,68,68,0.5)]'
              : 'bg-yellow-950/80 border-yellow-500 text-yellow-300'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-current" />
          PROXIMITY ALERT: {telemetry.sensors.sonar.threat_level} ({telemetry.sensors.sonar.min_distance_m}m)
        </div>
      )}
    </div>
  );
};
