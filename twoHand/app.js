// ===== DUAL-ARM FILAMENT BUNDLING SYSTEM =====
// Complete 3D simulation: TOP → LEFT & RIGHT ARMS → WRAPPING STATIONS → TRAYS

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
  
  // CENTER - Robotic Arms Base
  centerBase: {
    x: 0, y: 0, z: 0,
    radius: 1.5,
    height: 0.6,
    color: '#4444FF'
  },
  
  // LEFT ARM
  leftArm: {
    pivotX: -2.5, pivotY: 0.8, pivotZ: 0,
    segment1Length: 2.5,
    segment2Length: 2.2,
    armWidth: 0.35,
    armHeight: 0.3,
    color: '#FF6B6B',
    color2: '#FF8E72'
  },
  
  // RIGHT ARM
  rightArm: {
    pivotX: 2.5, pivotY: 0.8, pivotZ: 0,
    segment1Length: 2.5,
    segment2Length: 2.2,
    armWidth: 0.35,
    armHeight: 0.3,
    color: '#4ECDC4',
    color2: '#45B7AA'
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

// ANIMATION TIMELINE (12.0 second cycle - dual arms)
const CYCLE_DURATION = 12.0;
const PHASES = [
  { name: 'spawn', start: 0.0, end: 1.0, label: '📦 Bundles loaded at TOP station' },
  { name: 'simultaneous_pick', start: 1.0, end: 2.5, label: '🦾 Both arms picking from TOP' },
  { name: 'simultaneous_transport', start: 2.5, end: 4.5, label: '🔄 Transporting to wrapping stations' },
  { name: 'insert_wrappers', start: 4.5, end: 5.0, label: '📥 Inserting into wrapping machines' },
  { name: 'wrapping_process', start: 5.0, end: 7.5, label: '🎁 WRAPPING IN PROGRESS (LEFT & RIGHT)...' },
  { name: 'exit_wrappers', start: 7.5, end: 8.0, label: '✅ Bundles wrapped successfully' },
  { name: 'simultaneous_to_trays', start: 8.0, end: 9.5, label: '🔄 Transporting to output trays' },
  { name: 'place_in_trays', start: 9.5, end: 10.5, label: '📍 Placed in output trays' },
  { name: 'reset', start: 10.5, end: 12.0, label: '🔄 Ready for next batch' }
];

// ===== GLOBAL STATE =====
let renderer, scene, camera, controls;
let clock = new THREE.Clock();
let speed = 1.0;
let isPaused = false;
let cycleTime = 0;
let cycleCount = 0;
let leftCount = 0;
let rightCount = 0;
let glowEnabled = true;

// ===== MACHINE COMPONENTS =====
let machine = {
  // Stations
  topPlatform: null,
  rawBundles: [],
  centerBase: null,
  indicatorLight: null,
  
  // LEFT ARM
  leftArmPivot: null,
  leftArmSegment1: null,
  leftArmSegment2: null,
  leftGripper: null,
  leftGripperJaws: [],
  leftArmGlow: null,
  
  // RIGHT ARM
  rightArmPivot: null,
  rightArmSegment1: null,
  rightArmSegment2: null,
  rightGripper: null,
  rightGripperJaws: [],
  rightArmGlow: null,
  
  // Machines
  leftMachineBody: null,
  leftMachineDisk: null,
  leftMachineGlow: null,
  rightMachineBody: null,
  rightMachineDisk: null,
  rightMachineGlow: null,
  
  // Trays
  leftTray: null,
  rightTray: null,
  leftBundles: [],
  rightBundles: [],
  
  // Active bundles being processed (one per arm)
  leftBundle: null,
  rightBundle: null,
  leftBundleWrapped: false,
  rightBundleWrapped: false,
  
  // Labels
  labels: []
};

// UI Elements
const cycleText = document.getElementById('cycleText');
const cycleTimer = document.getElementById('cycleTimer');
const cycleCounter = document.getElementById('cycleCount');
const leftCounter = document.getElementById('leftCount');
const rightCounter = document.getElementById('rightCount');
const toggleGlowBtn = document.getElementById('toggleGlow');
const speedSlider = document.getElementById('speed');
const speedValue = document.getElementById('speed-value');
const playPauseBtn = document.getElementById('playPause');
const resetBtn = document.getElementById('resetBtn');

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
  
  createLabel('PLACING POINT', cfg.x, cfg.platformHeight + 0.8, cfg.z, '#FFD700', 0.28);
}

function createLabel(text, x, y, z, color, size) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.font = 'bold 48px Arial';
  context.fillStyle = color;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(size * 8, size * 2, 1);
  scene.add(sprite);
  
  machine.labels.push(sprite);
}

function buildCenterRobot() {
  const baseCfg = MACHINE_CONFIG.centerBase;
  
  // Center base platform
  const baseGeo = new THREE.CylinderGeometry(baseCfg.radius, baseCfg.radius, baseCfg.height, 32);
  const baseMat = new THREE.MeshStandardMaterial({ 
    color: baseCfg.color, 
    metalness: 0.8, 
    roughness: 0.2 
  });
  machine.centerBase = new THREE.Mesh(baseGeo, baseMat);
  machine.centerBase.position.set(baseCfg.x, baseCfg.height / 2, baseCfg.z);
  machine.centerBase.castShadow = true;
  scene.add(machine.centerBase);
  
  // Pulsing indicator light
  const lightGeo = new THREE.SphereGeometry(0.2, 16, 16);
  const lightMat = new THREE.MeshStandardMaterial({ 
    color: '#00FF00', 
    emissive: '#00FF00',
    emissiveIntensity: 1 
  });
  machine.indicatorLight = new THREE.Mesh(lightGeo, lightMat);
  machine.indicatorLight.position.set(0, baseCfg.height + 0.3, 0);
  scene.add(machine.indicatorLight);
  
  buildLeftArm();
  buildRightArm();
  
  createLabel('CENTER CONTROL', 0, baseCfg.height + 0.8, 0, '#FFFFFF', 0.25);
}

function buildLeftArm() {
  const cfg = MACHINE_CONFIG.leftArm;
  
  // LEFT ARM pivot
  machine.leftArmPivot = new THREE.Group();
  machine.leftArmPivot.position.set(cfg.pivotX, cfg.pivotY, cfg.pivotZ);
  scene.add(machine.leftArmPivot);
  
  // Segment 1 (base segment)
  const seg1Geo = new THREE.BoxGeometry(cfg.armWidth, cfg.armHeight, cfg.segment1Length);
  const seg1Mat = new THREE.MeshStandardMaterial({ 
    color: cfg.color, 
    metalness: 0.6, 
    roughness: 0.3 
  });
  machine.leftArmSegment1 = new THREE.Mesh(seg1Geo, seg1Mat);
  machine.leftArmSegment1.position.set(0, 0, -cfg.segment1Length / 2);
  machine.leftArmSegment1.castShadow = true;
  machine.leftArmPivot.add(machine.leftArmSegment1);
  
  // Segment 2 (forearm)
  const seg2Geo = new THREE.BoxGeometry(cfg.armWidth * 0.9, cfg.armHeight * 0.85, cfg.segment2Length);
  const seg2Mat = new THREE.MeshStandardMaterial({ 
    color: cfg.color2, 
    metalness: 0.6, 
    roughness: 0.3 
  });
  machine.leftArmSegment2 = new THREE.Mesh(seg2Geo, seg2Mat);
  machine.leftArmSegment2.position.set(0, 0, -cfg.segment1Length - cfg.segment2Length / 2);
  machine.leftArmSegment2.castShadow = true;
  machine.leftArmPivot.add(machine.leftArmSegment2);
  
  // Gripper
  const gripperGeo = new THREE.BoxGeometry(0.75, 0.2, 0.5);
  const gripperMat = new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.7, roughness: 0.3 });
  machine.leftGripper = new THREE.Mesh(gripperGeo, gripperMat);
  machine.leftGripper.position.set(0, 0, -cfg.segment1Length - cfg.segment2Length - 0.25);
  machine.leftGripper.castShadow = true;
  machine.leftArmPivot.add(machine.leftGripper);
  
  // Gripper jaws
  const jawGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
  const jawMat = new THREE.MeshStandardMaterial({ color: '#666666', metalness: 0.8, roughness: 0.2 });
  const jaw1 = new THREE.Mesh(jawGeo, jawMat);
  jaw1.position.set(-0.25, 0, -cfg.segment1Length - cfg.segment2Length - 0.4);
  jaw1.castShadow = true;
  machine.leftArmPivot.add(jaw1);
  
  const jaw2 = new THREE.Mesh(jawGeo, jawMat);
  jaw2.position.set(0.25, 0, -cfg.segment1Length - cfg.segment2Length - 0.4);
  jaw2.castShadow = true;
  machine.leftArmPivot.add(jaw2);
  
  machine.leftGripperJaws = [jaw1, jaw2];
  
  // Glow effect
  const glowGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ 
    color: cfg.color, 
    transparent: true, 
    opacity: 0 
  });
  machine.leftArmGlow = new THREE.Mesh(glowGeo, glowMat);
  machine.leftArmGlow.position.copy(machine.leftGripper.position);
  machine.leftArmPivot.add(machine.leftArmGlow);
  
  createLabel('LEFT ARM', cfg.pivotX, cfg.pivotY + 0.6, cfg.pivotZ - 1, '#FF6B6B', 0.22);
}

function buildRightArm() {
  const cfg = MACHINE_CONFIG.rightArm;
  
  // RIGHT ARM pivot
  machine.rightArmPivot = new THREE.Group();
  machine.rightArmPivot.position.set(cfg.pivotX, cfg.pivotY, cfg.pivotZ);
  scene.add(machine.rightArmPivot);
  
  // Segment 1
  const seg1Geo = new THREE.BoxGeometry(cfg.armWidth, cfg.armHeight, cfg.segment1Length);
  const seg1Mat = new THREE.MeshStandardMaterial({ 
    color: cfg.color, 
    metalness: 0.6, 
    roughness: 0.3 
  });
  machine.rightArmSegment1 = new THREE.Mesh(seg1Geo, seg1Mat);
  machine.rightArmSegment1.position.set(0, 0, -cfg.segment1Length / 2);
  machine.rightArmSegment1.castShadow = true;
  machine.rightArmPivot.add(machine.rightArmSegment1);
  
  // Segment 2
  const seg2Geo = new THREE.BoxGeometry(cfg.armWidth * 0.9, cfg.armHeight * 0.85, cfg.segment2Length);
  const seg2Mat = new THREE.MeshStandardMaterial({ 
    color: cfg.color2, 
    metalness: 0.6, 
    roughness: 0.3 
  });
  machine.rightArmSegment2 = new THREE.Mesh(seg2Geo, seg2Mat);
  machine.rightArmSegment2.position.set(0, 0, -cfg.segment1Length - cfg.segment2Length / 2);
  machine.rightArmSegment2.castShadow = true;
  machine.rightArmPivot.add(machine.rightArmSegment2);
  
  // Gripper
  const gripperGeo = new THREE.BoxGeometry(0.75, 0.2, 0.5);
  const gripperMat = new THREE.MeshStandardMaterial({ color: '#888888', metalness: 0.7, roughness: 0.3 });
  machine.rightGripper = new THREE.Mesh(gripperGeo, gripperMat);
  machine.rightGripper.position.set(0, 0, -cfg.segment1Length - cfg.segment2Length - 0.25);
  machine.rightGripper.castShadow = true;
  machine.rightArmPivot.add(machine.rightGripper);
  
  // Gripper jaws
  const jawGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
  const jawMat = new THREE.MeshStandardMaterial({ color: '#666666', metalness: 0.8, roughness: 0.2 });
  const jaw1 = new THREE.Mesh(jawGeo, jawMat);
  jaw1.position.set(-0.25, 0, -cfg.segment1Length - cfg.segment2Length - 0.4);
  jaw1.castShadow = true;
  machine.rightArmPivot.add(jaw1);
  
  const jaw2 = new THREE.Mesh(jawGeo, jawMat);
  jaw2.position.set(0.25, 0, -cfg.segment1Length - cfg.segment2Length - 0.4);
  jaw2.castShadow = true;
  machine.rightArmPivot.add(jaw2);
  
  machine.rightGripperJaws = [jaw1, jaw2];
  
  // Glow effect
  const glowGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ 
    color: cfg.color, 
    transparent: true, 
    opacity: 0 
  });
  machine.rightArmGlow = new THREE.Mesh(glowGeo, glowMat);
  machine.rightArmGlow.position.copy(machine.rightGripper.position);
  machine.rightArmPivot.add(machine.rightArmGlow);
  
  createLabel('RIGHT ARM', cfg.pivotX, cfg.pivotY + 0.6, cfg.pivotZ - 1, '#4ECDC4', 0.22);
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
    opacity: 0.85
  });
  machine.leftMachineBody = new THREE.Mesh(bodyGeo, bodyMat);
  machine.leftMachineBody.position.set(cfg.x, cfg.bodyHeight / 2, cfg.z);
  machine.leftMachineBody.castShadow = true;
  scene.add(machine.leftMachineBody);
  
  // Rotating disk on top
  const diskGeo = new THREE.CylinderGeometry(cfg.diskRadius, cfg.diskRadius, cfg.diskHeight, 32);
  const diskMat = new THREE.MeshStandardMaterial({ 
    color: cfg.diskColor, 
    metalness: 0.7, 
    roughness: 0.3,
    emissive: cfg.diskColor,
    emissiveIntensity: 0.2
  });
  machine.leftMachineDisk = new THREE.Mesh(diskGeo, diskMat);
  machine.leftMachineDisk.position.set(cfg.x, cfg.bodyHeight + cfg.diskHeight / 2, cfg.z);
  machine.leftMachineDisk.castShadow = true;
  scene.add(machine.leftMachineDisk);
  
  // Glow effect
  const glowGeo = new THREE.SphereGeometry(1.2, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ 
    color: '#FFD700', 
    transparent: true, 
    opacity: 0 
  });
  machine.leftMachineGlow = new THREE.Mesh(glowGeo, glowMat);
  machine.leftMachineGlow.position.set(cfg.x, cfg.bodyHeight / 2, cfg.z);
  scene.add(machine.leftMachineGlow);
  
  createLabel('LEFT WRAPPING STATION', cfg.x, cfg.bodyHeight + 0.8, cfg.z, '#FFD700', 0.28);
  createLabel('INPUT SLOT', cfg.x - 0.8, 1.5, cfg.z - 1.2, '#FF4444', 0.15);
  createLabel('WRAPPING DISK', cfg.x, cfg.bodyHeight + 0.5, cfg.z, '#FFA500', 0.15);
  createLabel('OUTPUT SLOT', cfg.x + 0.8, 1.5, cfg.z + 1.2, '#00FF00', 0.15);
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
    opacity: 0.85
  });
  machine.rightMachineBody = new THREE.Mesh(bodyGeo, bodyMat);
  machine.rightMachineBody.position.set(cfg.x, cfg.bodyHeight / 2, cfg.z);
  machine.rightMachineBody.castShadow = true;
  scene.add(machine.rightMachineBody);
  
  // Rotating disk on top
  const diskGeo = new THREE.CylinderGeometry(cfg.diskRadius, cfg.diskRadius, cfg.diskHeight, 32);
  const diskMat = new THREE.MeshStandardMaterial({ 
    color: cfg.diskColor, 
    metalness: 0.7, 
    roughness: 0.3,
    emissive: cfg.diskColor,
    emissiveIntensity: 0.2
  });
  machine.rightMachineDisk = new THREE.Mesh(diskGeo, diskMat);
  machine.rightMachineDisk.position.set(cfg.x, cfg.bodyHeight + cfg.diskHeight / 2, cfg.z);
  machine.rightMachineDisk.castShadow = true;
  scene.add(machine.rightMachineDisk);
  
  // Glow effect
  const glowGeo = new THREE.SphereGeometry(1.2, 16, 16);
  const glowMat = new THREE.MeshBasicMaterial({ 
    color: '#FFD700', 
    transparent: true, 
    opacity: 0 
  });
  machine.rightMachineGlow = new THREE.Mesh(glowGeo, glowMat);
  machine.rightMachineGlow.position.set(cfg.x, cfg.bodyHeight / 2, cfg.z);
  scene.add(machine.rightMachineGlow);
  
  createLabel('RIGHT WRAPPING STATION', cfg.x, cfg.bodyHeight + 0.8, cfg.z, '#FFD700', 0.28);
  createLabel('INPUT SLOT', cfg.x - 0.8, 1.5, cfg.z - 1.2, '#FF4444', 0.15);
  createLabel('WRAPPING DISK', cfg.x, cfg.bodyHeight + 0.5, cfg.z, '#FFA500', 0.15);
  createLabel('OUTPUT SLOT', cfg.x + 0.8, 1.5, cfg.z + 1.2, '#00FF00', 0.15);
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
  
  createLabel('LEFT OUTPUT TRAY', cfg.x, cfg.y + 0.7, cfg.z, '#FFD700', 0.25);
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
  
  createLabel('RIGHT OUTPUT TRAY', cfg.x, cfg.y + 0.7, cfg.z, '#FFD700', 0.25);
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
  
  // Multiple white tape bands
  const bandPositions = [-0.25, -0.08, 0.08, 0.25];
  bandPositions.forEach(yPos => {
    const bandGeo = new THREE.TorusGeometry(cfg.radius + 0.03, 0.03, 12, 32);
    const bandMat = new THREE.MeshStandardMaterial({ 
      color: cfg.bandColor,
      roughness: 0.6,
      metalness: 0.2
    });
    const band = new THREE.Mesh(bandGeo, bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = yPos;
    bundle.add(band);
  });
  
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
  
  toggleGlowBtn.addEventListener('click', () => {
    glowEnabled = !glowEnabled;
    toggleGlowBtn.textContent = glowEnabled ? '✨ Glow: ON' : '✨ Glow: OFF';
  });
  
  resetBtn.addEventListener('click', () => {
    cycleTime = 0;
    cycleCount = 0;
    leftCount = 0;
    rightCount = 0;
    cycleCounter.textContent = '0';
    leftCounter.textContent = '0';
    rightCounter.textContent = '0';
    
    // Remove all wrapped bundles
    machine.leftBundles.forEach(b => scene.remove(b));
    machine.rightBundles.forEach(b => scene.remove(b));
    machine.leftBundles = [];
    machine.rightBundles = [];
    
    // Remove current bundles if exist
    if (machine.leftBundle) {
      scene.remove(machine.leftBundle);
      machine.leftBundle = null;
    }
    if (machine.rightBundle) {
      scene.remove(machine.rightBundle);
      machine.rightBundle = null;
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
    
    // Update cycle counter (each cycle produces 2 bundles)
    const newCycleCount = Math.floor(cycleTime / CYCLE_DURATION);
    if (newCycleCount !== cycleCount) {
      cycleCount = newCycleCount;
      cycleCounter.textContent = cycleCount * 2;
    }
    
    // Animate pulsing indicator light
    if (machine.indicatorLight) {
      const pulse = Math.sin(loopTime * 4) * 0.5 + 0.5;
      machine.indicatorLight.material.emissiveIntensity = 0.5 + pulse * 0.5;
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



// ===== DUAL ARM ANIMATION UPDATE =====
function updateMachineAnimation(phaseName, progress, loopTime) {
  const t = easeInOutCubic(progress);
  
  const topCfg = MACHINE_CONFIG.topStation;
  const leftMachineCfg = MACHINE_CONFIG.leftMachine;
  const rightMachineCfg = MACHINE_CONFIG.rightMachine;
  const leftTrayCfg = MACHINE_CONFIG.leftTray;
  const rightTrayCfg = MACHINE_CONFIG.rightTray;
  
  switch(phaseName) {
    case 'spawn':
      // Phase 1: Spawn TWO bundles at TOP
      if (!machine.leftBundle && progress < 0.1) {
        machine.leftBundle = createRawBundle();
        machine.leftBundle.position.set(topCfg.x - 0.5, topCfg.platformHeight + 0.4, topCfg.z);
        scene.add(machine.leftBundle);
        machine.leftBundleWrapped = false;
      }
      if (!machine.rightBundle && progress < 0.1) {
        machine.rightBundle = createRawBundle();
        machine.rightBundle.position.set(topCfg.x + 0.5, topCfg.platformHeight + 0.4, topCfg.z);
        scene.add(machine.rightBundle);
        machine.rightBundleWrapped = false;
      }
      
      // Reset arms to neutral
      machine.leftArmPivot.rotation.y = 0;
      machine.rightArmPivot.rotation.y = 0;
      
      // Open gripper jaws
      machine.leftGripperJaws[0].position.x = -0.35;
      machine.leftGripperJaws[1].position.x = 0.35;
      machine.rightGripperJaws[0].position.x = -0.35;
      machine.rightGripperJaws[1].position.x = 0.35;
      
      // Reset glows
      if (machine.leftArmGlow) machine.leftArmGlow.material.opacity = 0;
      if (machine.rightArmGlow) machine.rightArmGlow.material.opacity = 0;
      if (machine.leftMachineGlow) machine.leftMachineGlow.material.opacity = 0;
      if (machine.rightMachineGlow) machine.rightMachineGlow.material.opacity = 0;
      break
      
    case 'simultaneous_pick':
      // Phase 2: BOTH arms rotate to TOP and pick bundles
      // LEFT arm stays at 0 (pointing to TOP)
      machine.leftArmPivot.rotation.y = 0;
      // RIGHT arm stays at 0 (pointing to TOP)
      machine.rightArmPivot.rotation.y = 0;
      
      // Close gripper jaws (both arms)
      const jawDist = 0.35 - t * 0.1;
      machine.leftGripperJaws[0].position.x = -jawDist;
      machine.leftGripperJaws[1].position.x = jawDist;
      machine.rightGripperJaws[0].position.x = -jawDist;
      machine.rightGripperJaws[1].position.x = jawDist;
      
      // Arm glow effect
      if (glowEnabled) {
        const glowIntensity = t * 0.4;
        if (machine.leftArmGlow) machine.leftArmGlow.material.opacity = glowIntensity;
        if (machine.rightArmGlow) machine.rightArmGlow.material.opacity = glowIntensity;
      }
      
      // Attach bundles to grippers
      if (machine.leftBundle && t > 0.5) {
        machine.leftArmPivot.attach(machine.leftBundle);
        machine.leftBundle.position.set(0, 0.2, -4.75);
      }
      if (machine.rightBundle && t > 0.5) {
        machine.rightArmPivot.attach(machine.rightBundle);
        machine.rightBundle.position.set(0, 0.2, -4.75);
      }
      break;
      
    case 'simultaneous_transport':
      // Phase 3: Rotate BOTH arms to their respective machines
      // LEFT arm rotates to LEFT machine (90 degrees)
      machine.leftArmPivot.rotation.y = easeInOutQuad(t) * (Math.PI / 2);
      // RIGHT arm rotates to RIGHT machine (-90 degrees)
      machine.rightArmPivot.rotation.y = easeInOutQuad(t) * (-Math.PI / 2);
      
      // Keep grippers closed
      machine.leftGripperJaws[0].position.x = -0.25;
      machine.leftGripperJaws[1].position.x = 0.25;
      machine.rightGripperJaws[0].position.x = -0.25;
      machine.rightGripperJaws[1].position.x = 0.25;
      
      // Maintain arm glow
      if (glowEnabled) {
        if (machine.leftArmGlow) machine.leftArmGlow.material.opacity = 0.4;
        if (machine.rightArmGlow) machine.rightArmGlow.material.opacity = 0.4;
      }
      break;
      
    case 'insert_wrappers':
      // Phase 4: Insert bundles into BOTH wrapping machines
      machine.leftArmPivot.rotation.y = Math.PI / 2;
      machine.rightArmPivot.rotation.y = -Math.PI / 2;
      
      // Open gripper jaws to release
      const releaseJaw = 0.25 + t * 0.15;
      machine.leftGripperJaws[0].position.x = -releaseJaw;
      machine.leftGripperJaws[1].position.x = releaseJaw;
      machine.rightGripperJaws[0].position.x = -releaseJaw;
      machine.rightGripperJaws[1].position.x = releaseJaw;
      
      // Detach bundles and position in machines
      if (machine.leftBundle && t > 0.5 && machine.leftBundle.parent !== scene) {
        scene.attach(machine.leftBundle);
        machine.leftBundle.position.set(leftMachineCfg.x, 1.5, leftMachineCfg.z);
      }
      if (machine.rightBundle && t > 0.5 && machine.rightBundle.parent !== scene) {
        scene.attach(machine.rightBundle);
        machine.rightBundle.position.set(rightMachineCfg.x, 1.5, rightMachineCfg.z);
      }
      
      // Fade arm glow
      if (machine.leftArmGlow) machine.leftArmGlow.material.opacity = 0.4 * (1 - t);
      if (machine.rightArmGlow) machine.rightArmGlow.material.opacity = 0.4 * (1 - t);
      break;
      
    case 'wrapping_process':
      // Phase 5: WRAPPING VISUALIZATION - Rotate disks and show wrapping
      // Rotate BOTH disks visibly
      machine.leftMachineDisk.rotation.y += 0.15;
      machine.rightMachineDisk.rotation.y += 0.15;
      
      // Keep bundles in machines
      if (machine.leftBundle) {
        machine.leftBundle.position.set(leftMachineCfg.x, 1.5, leftMachineCfg.z);
        // Rotate bundle to show wrapping process
        machine.leftBundle.rotation.y = t * Math.PI * 3.5;
      }
      if (machine.rightBundle) {
        machine.rightBundle.position.set(rightMachineCfg.x, 1.5, rightMachineCfg.z);
        // Rotate bundle to show wrapping process
        machine.rightBundle.rotation.y = t * Math.PI * 3.5;
      }
      
      // Machine glow effects during wrapping
      if (glowEnabled) {
        const pulse = Math.sin(t * Math.PI * 6) * 0.3 + 0.5;
        if (machine.leftMachineGlow) machine.leftMachineGlow.material.opacity = pulse;
        if (machine.rightMachineGlow) machine.rightMachineGlow.material.opacity = pulse;
      }
      
      // Convert to wrapped bundles at end
      if (t > 0.85 && !machine.leftBundleWrapped && machine.leftBundle) {
        const pos = machine.leftBundle.position.clone();
        scene.remove(machine.leftBundle);
        machine.leftBundle = createWrappedBundle();
        machine.leftBundle.position.copy(pos);
        scene.add(machine.leftBundle);
        machine.leftBundleWrapped = true;
      }
      if (t > 0.85 && !machine.rightBundleWrapped && machine.rightBundle) {
        const pos = machine.rightBundle.position.clone();
        scene.remove(machine.rightBundle);
        machine.rightBundle = createWrappedBundle();
        machine.rightBundle.position.copy(pos);
        scene.add(machine.rightBundle);
        machine.rightBundleWrapped = true;
      }
      break;
      
    case 'exit_wrappers':
      // Phase 6: BOTH arms pick up wrapped bundles
      machine.leftArmPivot.rotation.y = Math.PI / 2;
      machine.rightArmPivot.rotation.y = -Math.PI / 2;
      
      // Close grippers
      const grabJaw = 0.35 - t * 0.1;
      machine.leftGripperJaws[0].position.x = -grabJaw;
      machine.leftGripperJaws[1].position.x = grabJaw;
      machine.rightGripperJaws[0].position.x = -grabJaw;
      machine.rightGripperJaws[1].position.x = grabJaw;
      
      // Fade machine glow
      if (machine.leftMachineGlow) machine.leftMachineGlow.material.opacity = 0.5 * (1 - t);
      if (machine.rightMachineGlow) machine.rightMachineGlow.material.opacity = 0.5 * (1 - t);
      
      // Show arm glow
      if (glowEnabled) {
        if (machine.leftArmGlow) machine.leftArmGlow.material.opacity = t * 0.4;
        if (machine.rightArmGlow) machine.rightArmGlow.material.opacity = t * 0.4;
      }
      
      // Attach wrapped bundles
      if (machine.leftBundle && t > 0.5) {
        machine.leftArmPivot.attach(machine.leftBundle);
        machine.leftBundle.position.set(0, 0.2, -4.75);
        machine.leftBundle.rotation.y = 0;
      }
      if (machine.rightBundle && t > 0.5) {
        machine.rightArmPivot.attach(machine.rightBundle);
        machine.rightBundle.position.set(0, 0.2, -4.75);
        machine.rightBundle.rotation.y = 0;
      }
      break;
      
    case 'simultaneous_to_trays':
      // Phase 7: Rotate BOTH arms to output trays
      const leftTrayAngle = Math.PI / 2 + Math.PI / 4;
      const rightTrayAngle = -Math.PI / 2 - Math.PI / 4;
      machine.leftArmPivot.rotation.y = Math.PI / 2 + easeInOutQuad(t) * (Math.PI / 4);
      machine.rightArmPivot.rotation.y = -Math.PI / 2 + easeInOutQuad(t) * (-Math.PI / 4);
      
      // Keep grippers closed
      machine.leftGripperJaws[0].position.x = -0.25;
      machine.leftGripperJaws[1].position.x = 0.25;
      machine.rightGripperJaws[0].position.x = -0.25;
      machine.rightGripperJaws[1].position.x = 0.25;
      
      // Maintain arm glow
      if (glowEnabled) {
        if (machine.leftArmGlow) machine.leftArmGlow.material.opacity = 0.4;
        if (machine.rightArmGlow) machine.rightArmGlow.material.opacity = 0.4;
      }
      break;
      
    case 'place_in_trays':
      // Phase 8: Place bundles in BOTH trays
      machine.leftArmPivot.rotation.y = Math.PI / 2 + Math.PI / 4;
      machine.rightArmPivot.rotation.y = -Math.PI / 2 - Math.PI / 4;
      
      // Open grippers
      const dropJaw = 0.25 + t * 0.15;
      machine.leftGripperJaws[0].position.x = -dropJaw;
      machine.leftGripperJaws[1].position.x = dropJaw;
      machine.rightGripperJaws[0].position.x = -dropJaw;
      machine.rightGripperJaws[1].position.x = dropJaw;
      
      // Fade arm glow
      if (machine.leftArmGlow) machine.leftArmGlow.material.opacity = 0.4 * (1 - t);
      if (machine.rightArmGlow) machine.rightArmGlow.material.opacity = 0.4 * (1 - t);
      
      // Place LEFT bundle in tray
      if (machine.leftBundle && t > 0.5) {
        scene.attach(machine.leftBundle);
        
        const slotIndex = machine.leftBundles.length;
        const row = Math.floor(slotIndex / 4);
        const col = slotIndex % 4;
        
        machine.leftBundle.position.set(
          leftTrayCfg.x + (col * 0.7 - 1.05),
          leftTrayCfg.y + 0.6,
          leftTrayCfg.z + (row * 0.7 - 0.35)
        );
        
        machine.leftBundles.push(machine.leftBundle);
        machine.leftBundle = null;
        machine.leftBundleWrapped = false;
        
        leftCount++;
        leftCounter.textContent = leftCount;
      }
      
      // Place RIGHT bundle in tray
      if (machine.rightBundle && t > 0.5) {
        scene.attach(machine.rightBundle);
        
        const slotIndex = machine.rightBundles.length;
        const row = Math.floor(slotIndex / 4);
        const col = slotIndex % 4;
        
        machine.rightBundle.position.set(
          rightTrayCfg.x + (col * 0.7 - 1.05),
          rightTrayCfg.y + 0.6,
          rightTrayCfg.z + (row * 0.7 - 0.35)
        );
        
        machine.rightBundles.push(machine.rightBundle);
        machine.rightBundle = null;
        machine.rightBundleWrapped = false;
        
        rightCount++;
        rightCounter.textContent = rightCount;
      }
      break;
      
    case 'reset':
      // Phase 9: Reset BOTH arms to neutral
      const leftFinalAngle = Math.PI / 2 + Math.PI / 4;
      const rightFinalAngle = -Math.PI / 2 - Math.PI / 4;
      machine.leftArmPivot.rotation.y = leftFinalAngle - easeInOutQuad(t) * leftFinalAngle;
      machine.rightArmPivot.rotation.y = rightFinalAngle - easeInOutQuad(t) * rightFinalAngle;
      
      // Open grippers
      machine.leftGripperJaws[0].position.x = -0.35;
      machine.leftGripperJaws[1].position.x = 0.35;
      machine.rightGripperJaws[0].position.x = -0.35;
      machine.rightGripperJaws[1].position.x = 0.35;
      
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
