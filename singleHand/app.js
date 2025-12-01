// ===== FILAMENT PICK-AND-PLACE BUNDLING SYSTEM =====
// Complete 3D simulation: TOP → CENTER ARM → LEFT/RIGHT WRAPPING → TRAYS

// MACHINE CONFIGURATION
const MACHINE_CONFIG = {
  // TOP STATION - Placing Point
  topStation: {
    x: 0, y: 0, z: -7,
    platformWidth: 3,
    platformDepth: 2,
    platformHeight: 0.3,
    color: '#555555'
  },
  
  // CENTER - Robotic Arm Base
  centerBase: {
    x: 0, y: 0, z: 0,
    radius: 1.2,
    height: 0.5,
    color: '#4444FF',
    armLength: 5,
    armWidth: 0.4,
    armHeight: 0.3,
    armColor: '#FF6B6B'
  },
  
  // LEFT WRAPPING MACHINE
  leftMachine: {
    x: -6, y: 0, z: 0,
    bodyWidth: 2.5,
    bodyHeight: 3,
    bodyDepth: 2,
    bodyColor: '#00AA00',
    diskRadius: 1,
    diskHeight: 0.3,
    diskColor: '#FFA500'
  },
  
  // RIGHT WRAPPING MACHINE
  rightMachine: {
    x: 6, y: 0, z: 0,
    bodyWidth: 2.5,
    bodyHeight: 3,
    bodyDepth: 2,
    bodyColor: '#00AA00',
    diskRadius: 1,
    diskHeight: 0.3,
    diskColor: '#FFA500'
  },
  
  // LEFT OUTPUT TRAY
  leftTray: {
    x: -6, y: 0.2, z: 4,
    width: 3,
    depth: 3,
    height: 0.4,
    color: '#8B4513',
    rows: 2,
    cols: 4
  },
  
  // RIGHT OUTPUT TRAY
  rightTray: {
    x: 6, y: 0.2, z: 4,
    width: 3,
    depth: 3,
    height: 0.4,
    color: '#8B4513',
    rows: 2,
    cols: 4
  },
  
  // RAW BUNDLE
  rawBundle: {
    radius: 0.35,
    height: 0.8,
    color: '#F5DEB3'
  },
  
  // WRAPPED BUNDLE
  wrappedBundle: {
    radius: 0.35,
    height: 0.8,
    bodyColor: '#CD853F',
    bandColor: '#FFFFFF'
  }
};

// ANIMATION TIMELINE (8.0 second cycle)
const CYCLE_DURATION = 8.0;
const PHASES = [
  { name: 'spawn', start: 0.0, end: 0.5, label: '📦 Bundle loaded at TOP station' },
  { name: 'pick', start: 0.5, end: 1.5, label: '🦾 Picking bundle from TOP' },
  { name: 'transport_to_wrapper', start: 1.5, end: 3.0, label: '🔄 Transporting to wrapping station' },
  { name: 'insert_wrapper', start: 3.0, end: 3.5, label: '📥 Inserting into wrapping machine' },
  { name: 'wrapping', start: 3.5, end: 5.5, label: '🎁 WRAPPING in progress...' },
  { name: 'exit_wrapper', start: 5.5, end: 6.0, label: '✅ Bundle wrapped successfully' },
  { name: 'transport_to_tray', start: 6.0, end: 7.0, label: '🔄 Transporting to output tray' },
  { name: 'place_in_tray', start: 7.0, end: 7.5, label: '📍 Placed in output tray' },
  { name: 'reset', start: 7.5, end: 8.0, label: '🔄 Ready for next bundle' }
];

// ===== GLOBAL STATE =====
let renderer, scene, camera, controls;
let clock = new THREE.Clock();
let speed = 1.0;
let isPaused = false;
let cycleTime = 0;
let cycleCount = 0;
let selectedStation = 'left'; // 'left', 'right', or 'both'

// ===== MACHINE COMPONENTS =====
let machine = {
  // Stations
  topPlatform: null,
  rawBundles: [],
  centerBase: null,
  centerPivot: null,
  robotArm: null,
  gripper: null,
  gripperJaws: [],
  
  // Machines
  leftMachineBody: null,
  leftMachineDisk: null,
  rightMachineBody: null,
  rightMachineDisk: null,
  
  // Trays
  leftTray: null,
  rightTray: null,
  leftBundles: [],
  rightBundles: [],
  
  // Active bundle being processed
  currentBundle: null,
  currentBundleIsWrapped: false
};

// UI Elements
const cycleText = document.getElementById('cycleText');
const cycleTimer = document.getElementById('cycleTimer');
const cycleCounter = document.getElementById('cycleCount');
const currentStationDisplay = document.getElementById('currentStation');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');
const playPauseBtn = document.getElementById('playPause');
const resetBtn = document.getElementById('resetBtn');
const stationSelect = document.getElementById('stationSelect');
const machineCanvas = document.getElementById('machine-canvas');



// ===== INITIALIZATION =====
function init() {
  // Setup renderer
  renderer = new THREE.WebGLRenderer({ canvas: machineCanvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(machineCanvas.clientWidth, machineCanvas.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor('#1a1a1a');

  // Setup scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#1a1a1a');
  scene.fog = new THREE.Fog('#1a1a1a', 10, 40);

  // Setup camera - isometric view showing all stations
  camera = new THREE.PerspectiveCamera(50, machineCanvas.clientWidth / machineCanvas.clientHeight, 0.1, 100);
  camera.position.set(15, 12, 15);
  camera.lookAt(0, 2, 0);
  
  // Setup orbit controls
  controls = new THREE.OrbitControls(camera, machineCanvas);
  controls.target.set(0, 2, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 8;
  controls.maxDistance = 30;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.update();

  setupLights();
  buildMachine();
  setUIListeners();
  animate();
}

function setupLights() {
  // Ambient light
  const ambient = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambient);
  
  // Main directional light with shadows
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
  dirLight.position.set(12, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 2048;
  dirLight.shadow.mapSize.height = 2048;
  dirLight.shadow.camera.left = -20;
  dirLight.shadow.camera.right = 20;
  dirLight.shadow.camera.top = 20;
  dirLight.shadow.camera.bottom = -20;
  dirLight.shadow.camera.near = 0.5;
  dirLight.shadow.camera.far = 50;
  scene.add(dirLight);
  
  // Spot light from top
  const spotLight = new THREE.SpotLight(0xffffff, 0.6);
  spotLight.position.set(0, 15, 0);
  spotLight.angle = Math.PI / 4;
  spotLight.penumbra = 0.3;
  scene.add(spotLight);
  
  // Hemisphere light
  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
  scene.add(hemiLight);
}

// ===== BUILD MACHINE COMPONENTS =====
function buildMachine() {
  buildFloorGrid();
  buildTopStation();
  buildCenterRobot();
  buildLeftMachine();
  buildRightMachine();
  buildLeftTray();
  buildRightTray();
  spawnRawBundles();
}

function buildFloorGrid() {
  const gridHelper = new THREE.GridHelper(20, 20, 0x444444, 0x222222);
  scene.add(gridHelper);
}

function buildTopStation() {
  const cfg = MACHINE_CONFIG.topStation;
  const platformGeo = new THREE.BoxGeometry(cfg.platformWidth, cfg.platformHeight, cfg.platformDepth);
  const platformMat = new THREE.MeshStandardMaterial({ 
    color: cfg.color, 
    metalness: 0.6, 
    roughness: 0.4 
  });
  machine.topPlatform = new THREE.Mesh(platformGeo, platformMat);
  machine.topPlatform.position.set(cfg.x, cfg.platformHeight / 2, cfg.z);
  machine.topPlatform.receiveShadow = true;
  machine.topPlatform.castShadow = true;
  scene.add(machine.topPlatform);
}

function buildCenterRobot() {
  const cfg = MACHINE_CONFIG.centerBase;
  
  // Center base platform
  const baseGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.height, 32);
  const baseMat = new THREE.MeshStandardMaterial({ 
    color: cfg.color, 
    metalness: 0.8, 
    roughness: 0.2 
  });
  machine.centerBase = new THREE.Mesh(baseGeo, baseMat);
  machine.centerBase.position.set(cfg.x, cfg.height / 2, cfg.z);
  machine.centerBase.castShadow = true;
  scene.add(machine.centerBase);
  
  // Rotating pivot
  machine.centerPivot = new THREE.Group();
  machine.centerPivot.position.set(0, cfg.height, 0);
  scene.add(machine.centerPivot);
  
  // Robot arm
  const armGeo = new THREE.BoxGeometry(cfg.armWidth, cfg.armHeight, cfg.armLength);
  const armMat = new THREE.MeshStandardMaterial({ 
    color: cfg.armColor, 
    metalness: 0.6, 
    roughness: 0.3 
  });
  machine.robotArm = new THREE.Mesh(armGeo, armMat);
  machine.robotArm.position.set(0, 0.2, -cfg.armLength / 2);
  machine.robotArm.castShadow = true;
  machine.centerPivot.add(machine.robotArm);
  
  // Gripper base
  const gripperGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5);
  const gripperMat = new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.7, roughness: 0.3 });
  machine.gripper = new THREE.Mesh(gripperGeo, gripperMat);
  machine.gripper.position.set(0, 0.2, -cfg.armLength + 0.25);
  machine.gripper.castShadow = true;
  machine.centerPivot.add(machine.gripper);
  
  // Gripper jaws
  const jawGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
  const jawMat = new THREE.MeshStandardMaterial({ color: '#666666', metalness: 0.8, roughness: 0.2 });
  const jaw1 = new THREE.Mesh(jawGeo, jawMat);
  jaw1.position.set(-0.25, 0, -cfg.armLength + 0.4);
  jaw1.castShadow = true;
  machine.centerPivot.add(jaw1);
  
  const jaw2 = new THREE.Mesh(jawGeo, jawMat);
  jaw2.position.set(0.25, 0, -cfg.armLength + 0.4);
  jaw2.castShadow = true;
  machine.centerPivot.add(jaw2);
  
  machine.gripperJaws = [jaw1, jaw2];
}

function buildLeftMachine() {
  const cfg = MACHINE_CONFIG.leftMachine;
  
  // Machine body
  const bodyGeo = new THREE.BoxGeometry(cfg.bodyWidth, cfg.bodyHeight, cfg.bodyDepth);
  const bodyMat = new THREE.MeshStandardMaterial({ 
    color: cfg.bodyColor, 
    metalness: 0.6, 
    roughness: 0.4,
    transparent: true,
    opacity: 0.8
  });
  machine.leftMachineBody = new THREE.Mesh(bodyGeo, bodyMat);
  machine.leftMachineBody.position.set(cfg.x, cfg.bodyHeight / 2, cfg.z);
  machine.leftMachineBody.castShadow = true;
  scene.add(machine.leftMachineBody);
  
  // Labeling disk on top
  const diskGeo = new THREE.CylinderGeometry(cfg.diskRadius, cfg.diskRadius, cfg.diskHeight, 32);
  const diskMat = new THREE.MeshStandardMaterial({ 
    color: cfg.diskColor, 
    metalness: 0.7, 
    roughness: 0.3 
  });
  machine.leftMachineDisk = new THREE.Mesh(diskGeo, diskMat);
  machine.leftMachineDisk.position.set(cfg.x, cfg.bodyHeight + cfg.diskHeight / 2, cfg.z);
  machine.leftMachineDisk.castShadow = true;
  scene.add(machine.leftMachineDisk);
}

function buildRightMachine() {
  const cfg = MACHINE_CONFIG.rightMachine;
  
  // Machine body
  const bodyGeo = new THREE.BoxGeometry(cfg.bodyWidth, cfg.bodyHeight, cfg.bodyDepth);
  const bodyMat = new THREE.MeshStandardMaterial({ 
    color: cfg.bodyColor, 
    metalness: 0.6, 
    roughness: 0.4,
    transparent: true,
    opacity: 0.8
  });
  machine.rightMachineBody = new THREE.Mesh(bodyGeo, bodyMat);
  machine.rightMachineBody.position.set(cfg.x, cfg.bodyHeight / 2, cfg.z);
  machine.rightMachineBody.castShadow = true;
  scene.add(machine.rightMachineBody);
  
  // Labeling disk on top
  const diskGeo = new THREE.CylinderGeometry(cfg.diskRadius, cfg.diskRadius, cfg.diskHeight, 32);
  const diskMat = new THREE.MeshStandardMaterial({ 
    color: cfg.diskColor, 
    metalness: 0.7, 
    roughness: 0.3 
  });
  machine.rightMachineDisk = new THREE.Mesh(diskGeo, diskMat);
  machine.rightMachineDisk.position.set(cfg.x, cfg.bodyHeight + cfg.diskHeight / 2, cfg.z);
  machine.rightMachineDisk.castShadow = true;
  scene.add(machine.rightMachineDisk);
}

function buildLeftTray() {
  const cfg = MACHINE_CONFIG.leftTray;
  const trayGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
  const trayMat = new THREE.MeshStandardMaterial({ 
    color: cfg.color, 
    metalness: 0.5, 
    roughness: 0.6 
  });
  machine.leftTray = new THREE.Mesh(trayGeo, trayMat);
  machine.leftTray.position.set(cfg.x, cfg.y, cfg.z);
  machine.leftTray.receiveShadow = true;
  scene.add(machine.leftTray);
}

function buildRightTray() {
  const cfg = MACHINE_CONFIG.rightTray;
  const trayGeo = new THREE.BoxGeometry(cfg.width, cfg.height, cfg.depth);
  const trayMat = new THREE.MeshStandardMaterial({ 
    color: cfg.color, 
    metalness: 0.5, 
    roughness: 0.6 
  });
  machine.rightTray = new THREE.Mesh(trayGeo, trayMat);
  machine.rightTray.position.set(cfg.x, cfg.y, cfg.z);
  machine.rightTray.receiveShadow = true;
  scene.add(machine.rightTray);
}

function spawnRawBundles() {
  const cfg = MACHINE_CONFIG.topStation;
  const positions = [
    { x: -0.6, z: -0.4 },
    { x: 0.6, z: -0.4 },
    { x: -0.6, z: 0.4 },
    { x: 0.6, z: 0.4 }
  ];
  
  positions.forEach(pos => {
    const bundle = createRawBundle();
    bundle.position.set(cfg.x + pos.x, cfg.platformHeight + 0.4, cfg.z + pos.z);
    scene.add(bundle);
    machine.rawBundles.push(bundle);
  });
}



// ===== CREATE RAW BUNDLE =====
function createRawBundle() {
  const cfg = MACHINE_CONFIG.rawBundle;
  const bundleGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.height, 16);
  const bundleMat = new THREE.MeshStandardMaterial({ 
    color: cfg.color, 
    roughness: 0.8 
  });
  const bundle = new THREE.Mesh(bundleGeo, bundleMat);
  bundle.castShadow = true;
  return bundle;
}

// ===== CREATE WRAPPED BUNDLE =====
function createWrappedBundle() {
  const cfg = MACHINE_CONFIG.wrappedBundle;
  const bundle = new THREE.Group();
  
  // Filament cylinder
  const filGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.height, 32);
  const filMat = new THREE.MeshStandardMaterial({ 
    color: cfg.bodyColor,
    roughness: 0.8
  });
  const filCylinder = new THREE.Mesh(filGeo, filMat);
  filCylinder.castShadow = true;
  bundle.add(filCylinder);
  
  // White tape band wrap
  const bandGeo = new THREE.TorusGeometry(cfg.radius + 0.03, 0.04, 12, 32);
  const bandMat = new THREE.MeshStandardMaterial({ 
    color: cfg.bandColor,
    roughness: 0.7,
    metalness: 0.1
  });
  const band = new THREE.Mesh(bandGeo, bandMat);
  band.rotation.x = Math.PI / 2;
  bundle.add(band);
  
  bundle.castShadow = true;
  return bundle;
}

// ===== EVENT LISTENERS =====
function setUIListeners() {
  playPauseBtn.addEventListener('click', () => {
    isPaused = !isPaused;
    playPauseBtn.textContent = isPaused ? 'Play' : 'Pause';
  });
  
  speedSlider.addEventListener('input', (e) => {
    speed = parseFloat(e.target.value);
    speedValue.textContent = speed.toFixed(1) + 'x';
  });
  
  stationSelect.addEventListener('change', (e) => {
    selectedStation = e.target.value;
  });
  
  resetBtn.addEventListener('click', () => {
    cycleTime = 0;
    cycleCount = 0;
    cycleCounter.textContent = '0';
    
    // Remove all wrapped bundles
    machine.leftBundles.forEach(b => scene.remove(b));
    machine.rightBundles.forEach(b => scene.remove(b));
    machine.leftBundles = [];
    machine.rightBundles = [];
    
    // Remove current bundle if exists
    if (machine.currentBundle) {
      scene.remove(machine.currentBundle);
      machine.currentBundle = null;
    }
  });
}



// ===== ANIMATION LOOP =====
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  controls.update();
  
  if (!isPaused) {
    cycleTime += delta * speed;
    
    // Loop the cycle
    const loopTime = cycleTime % CYCLE_DURATION;
    
    // Update timer
    cycleTimer.textContent = loopTime.toFixed(1) + 's';
    
    // Update cycle counter
    const newCycleCount = Math.floor(cycleTime / CYCLE_DURATION);
    if (newCycleCount !== cycleCount) {
      cycleCount = newCycleCount;
      cycleCounter.textContent = cycleCount;
    }
    
    // Find current phase
    let currentPhase = null;
    for (let phase of PHASES) {
      if (loopTime >= phase.start && loopTime < phase.end) {
        currentPhase = phase;
        break;
      }
    }
    
    if (currentPhase) {
      cycleText.textContent = currentPhase.label;
      const progress = (loopTime - currentPhase.start) / (currentPhase.end - currentPhase.start);
      updateMachineAnimation(currentPhase.name, progress, loopTime);
    }
  }
  
  renderer.render(scene, camera);
}



// ===== DETERMINE TARGET STATION =====
function getTargetStation(cycleNum) {
  if (selectedStation === 'left') return 'left';
  if (selectedStation === 'right') return 'right';
  // Alternate between left and right
  return (cycleNum % 2 === 0) ? 'left' : 'right';
}

// ===== MACHINE ANIMATION UPDATE =====
function updateMachineAnimation(phaseName, progress, loopTime) {
  const t = easeInOutCubic(progress);
  const currentCycle = Math.floor(cycleTime / CYCLE_DURATION);
  const targetStation = getTargetStation(currentCycle);
  const isLeft = targetStation === 'left';
  
  // Update station display
  currentStationDisplay.textContent = targetStation.toUpperCase();
  
  const topCfg = MACHINE_CONFIG.topStation;
  const machineCfg = isLeft ? MACHINE_CONFIG.leftMachine : MACHINE_CONFIG.rightMachine;
  const trayCfg = isLeft ? MACHINE_CONFIG.leftTray : MACHINE_CONFIG.rightTray;
  const disk = isLeft ? machine.leftMachineDisk : machine.rightMachineDisk;
  
  switch(phaseName) {
    case 'spawn':
      // Phase 1: Spawn new bundle at TOP
      if (!machine.currentBundle && progress < 0.1) {
        machine.currentBundle = createRawBundle();
        machine.currentBundle.position.set(topCfg.x, topCfg.platformHeight + 0.4, topCfg.z);
        scene.add(machine.currentBundle);
        machine.currentBundleIsWrapped = false;
      }
      
      // Reset arm to neutral
      machine.centerPivot.rotation.y = 0;
      
      // Open gripper jaws
      machine.gripperJaws[0].position.x = -0.35;
      machine.gripperJaws[1].position.x = 0.35;
      break;
      
    case 'pick':
      // Phase 2: Arm rotates to TOP and picks bundle
      const pickAngle = t * 0; // Arm points to TOP (z-negative)
      machine.centerPivot.rotation.y = pickAngle;
      
      // Close gripper jaws
      const jawDist = 0.35 - t * 0.1;
      machine.gripperJaws[0].position.x = -jawDist;
      machine.gripperJaws[1].position.x = jawDist;
      
      // Attach bundle to gripper at end
      if (machine.currentBundle && t > 0.5) {
        machine.centerPivot.attach(machine.currentBundle);
        machine.currentBundle.position.set(0, 0.2, -4.75);
      }
      break;
      
    case 'transport_to_wrapper':
      // Phase 3: Rotate arm to LEFT or RIGHT machine
      const targetAngle = isLeft ? Math.PI / 2 : -Math.PI / 2;
      machine.centerPivot.rotation.y = t * targetAngle;
      
      // Keep gripper closed
      machine.gripperJaws[0].position.x = -0.25;
      machine.gripperJaws[1].position.x = 0.25;
      break;
      
    case 'insert_wrapper':
      // Phase 4: Insert bundle into wrapping machine
      const insertAngle = isLeft ? Math.PI / 2 : -Math.PI / 2;
      machine.centerPivot.rotation.y = insertAngle;
      
      // Open gripper jaws to release
      const releaseJaw = 0.25 + t * 0.1;
      machine.gripperJaws[0].position.x = -releaseJaw;
      machine.gripperJaws[1].position.x = releaseJaw;
      
      // Detach bundle and position in machine
      if (machine.currentBundle && t > 0.5 && machine.currentBundle.parent !== scene) {
        scene.attach(machine.currentBundle);
        machine.currentBundle.position.set(machineCfg.x, 1.5, machineCfg.z);
      }
      break;
      
    case 'wrapping':
      // Phase 5: Rotate disk, wrap bundle
      disk.rotation.y += 0.1;
      
      // Keep bundle in machine
      if (machine.currentBundle) {
        machine.currentBundle.position.set(machineCfg.x, 1.5, machineCfg.z);
      }
      
      // At end, convert to wrapped bundle
      if (t > 0.9 && !machine.currentBundleIsWrapped && machine.currentBundle) {
        scene.remove(machine.currentBundle);
        machine.currentBundle = createWrappedBundle();
        machine.currentBundle.position.set(machineCfg.x, 1.5, machineCfg.z);
        scene.add(machine.currentBundle);
        machine.currentBundleIsWrapped = true;
      }
      break;
      
    case 'exit_wrapper':
      // Phase 6: Arm picks up wrapped bundle
      const exitAngle = isLeft ? Math.PI / 2 : -Math.PI / 2;
      machine.centerPivot.rotation.y = exitAngle;
      
      // Close gripper
      const grabJaw = 0.35 - t * 0.1;
      machine.gripperJaws[0].position.x = -grabJaw;
      machine.gripperJaws[1].position.x = grabJaw;
      
      // Attach wrapped bundle
      if (machine.currentBundle && t > 0.5) {
        machine.centerPivot.attach(machine.currentBundle);
        machine.currentBundle.position.set(0, 0.2, -4.75);
      }
      break;
      
    case 'transport_to_tray':
      // Phase 7: Rotate to output tray
      const trayAngle = isLeft ? (Math.PI / 2 + Math.PI / 4) : (-Math.PI / 2 - Math.PI / 4);
      const startAngle = isLeft ? Math.PI / 2 : -Math.PI / 2;
      machine.centerPivot.rotation.y = startAngle + t * (trayAngle - startAngle);
      
      // Keep gripper closed
      machine.gripperJaws[0].position.x = -0.25;
      machine.gripperJaws[1].position.x = 0.25;
      break;
      
    case 'place_in_tray':
      // Phase 8: Place bundle in tray
      const placeAngle = isLeft ? (Math.PI / 2 + Math.PI / 4) : (-Math.PI / 2 - Math.PI / 4);
      machine.centerPivot.rotation.y = placeAngle;
      
      // Open gripper
      const dropJaw = 0.25 + t * 0.15;
      machine.gripperJaws[0].position.x = -dropJaw;
      machine.gripperJaws[1].position.x = dropJaw;
      
      // Place in tray
      if (machine.currentBundle && t > 0.5) {
        scene.attach(machine.currentBundle);
        
        const trayBundles = isLeft ? machine.leftBundles : machine.rightBundles;
        const slotIndex = trayBundles.length;
        const row = Math.floor(slotIndex / 4);
        const col = slotIndex % 4;
        
        machine.currentBundle.position.set(
          trayCfg.x + (col * 0.7 - 1.05),
          trayCfg.y + 0.6,
          trayCfg.z + (row * 0.7 - 0.35)
        );
        
        if (isLeft) {
          machine.leftBundles.push(machine.currentBundle);
        } else {
          machine.rightBundles.push(machine.currentBundle);
        }
        
        machine.currentBundle = null;
        machine.currentBundleIsWrapped = false;
      }
      break;
      
    case 'reset':
      // Phase 9: Reset arm to neutral
      const finalAngle = isLeft ? (Math.PI / 2 + Math.PI / 4) : (-Math.PI / 2 - Math.PI / 4);
      machine.centerPivot.rotation.y = finalAngle - t * finalAngle;
      
      // Open gripper
      machine.gripperJaws[0].position.x = -0.35;
      machine.gripperJaws[1].position.x = 0.35;
      
      // Cleanup old bundles if too many
      if (machine.leftBundles.length > 8) {
        const removed = machine.leftBundles.shift();
        scene.remove(removed);
      }
      if (machine.rightBundles.length > 8) {
        const removed = machine.rightBundles.shift();
        scene.remove(removed);
      }
      break;
  }
}

// Easing functions
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ===== RESPONSIVE HANDLING =====
window.addEventListener('resize', onWindowResize);

function onWindowResize() {
  const width = machineCanvas.clientWidth;
  const height = machineCanvas.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  
  renderer.setSize(width, height);
}

// ===== START APPLICATION =====
init();
