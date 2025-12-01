// ===== FILAMENT BUNDLING SYSTEM WITH COMPLETE ANIMATIONS =====

let scene, camera, renderer, clock;
let isPlaying = true;
let speed = 1.0;
let cycleTime = 0;
const CYCLE_DURATION = 14;

// Machine components
const machine = {
  topPlatform: null,
  centerBase: null,
  leftArm: null,
  rightArm: null,
  leftPress: { topPlate: null, bottomPlate: null, pistons: [] },
  rightPress: { topPlate: null, bottomPlate: null, pistons: [] },
  leftWrapper: { body: null, disk: null },
  rightWrapper: { body: null, disk: null },
  leftTray: null,
  rightTray: null
};

// Active bundles
let leftBundle = null;
let rightBundle = null;
let leftTrayBundles = [];
let rightTrayBundles = [];
let bundleCount = 0;

// Animation phases with detailed timing
const PHASES = [
  { name: 'spawn', start: 0, end: 1, label: '📦 Spawning bundles...' },
  { name: 'pickup', start: 1, end: 3, label: '🦾 Picking up bundles...' },
  { name: 'transport_to_press', start: 3, end: 5, label: '🔄 Transporting to PRESS machines...' },
  { name: 'press_down', start: 5, end: 6.5, label: '⬇️ Pressing down...' },
  { name: 'vibration', start: 6.5, end: 7.5, label: '📳 Shaking to level filaments...' },
  { name: 'hold_pressed', start: 7.5, end: 8.5, label: '⏸️ Holding compressed...' },
  { name: 'release', start: 8.5, end: 9.5, label: '⬆️ Releasing from press...' },
  { name: 'wrapping', start: 9.5, end: 11.5, label: '🎁 WRAPPING with tape...' },
  { name: 'eject', start: 11.5, end: 12, label: '✅ Wrapped! Ejecting...' },
  { name: 'transport_to_tray', start: 12, end: 13, label: '🔄 Moving to output trays...' },
  { name: 'place_in_tray', start: 13, end: 14, label: '📍 Placed in tray!' }
];

// UI elements
const ui = {
  currentPhase: document.getElementById('current-phase'),
  cycleTime: document.getElementById('cycle-time'),
  bundleCount: document.getElementById('bundle-count'),
  leftCount: document.getElementById('left-count'),
  rightCount: document.getElementById('right-count'),
  progressFill: document.getElementById('progress-fill'),
  playPause: document.getElementById('play-pause'),
  reset: document.getElementById('reset'),
  speed: document.getElementById('speed'),
  speedValue: document.getElementById('speed-value')
};

// ===== INITIALIZATION =====
function init() {
  clock = new THREE.Clock();
  
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.fog = new THREE.Fog(0x000000, 30, 100);
  
  // Camera setup
  camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.set(18, 14, 18);
  camera.lookAt(0, 2, 0);
  
  // Renderer setup
  const container = document.getElementById('canvas-container');
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  
  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
  scene.add(ambientLight);
  
  const directionalLight = new THREE.DirectionalLight(0xffffff, 1.4);
  directionalLight.position.set(15, 25, 12);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -40;
  directionalLight.shadow.camera.right = 40;
  directionalLight.shadow.camera.top = 40;
  directionalLight.shadow.camera.bottom = -40;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);
  
  // Grid
  const gridHelper = new THREE.GridHelper(40, 40, 0x444444, 0x222222);
  scene.add(gridHelper);
  
  buildMachines();
  setupEventListeners();
  animate();
}

// ===== BUILD MACHINES =====
function buildMachines() {
  // TOP PLATFORM
  const topGeo = new THREE.BoxGeometry(4, 0.4, 2.5);
  const topMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.6, roughness: 0.4 });
  machine.topPlatform = new THREE.Mesh(topGeo, topMat);
  machine.topPlatform.position.set(0, 6, -7);
  machine.topPlatform.castShadow = true;
  machine.topPlatform.receiveShadow = true;
  scene.add(machine.topPlatform);
  
  // CENTER BASE
  const baseGeo = new THREE.CylinderGeometry(1.5, 1.5, 0.6, 32);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x4444FF, metalness: 0.8, roughness: 0.2 });
  machine.centerBase = new THREE.Mesh(baseGeo, baseMat);
  machine.centerBase.position.set(0, 0.3, 0);
  machine.centerBase.castShadow = true;
  scene.add(machine.centerBase);
  
  // ARMS
  machine.leftArm = createArm(-2.5, 0.8, 0, 0xFF6B6B);
  machine.rightArm = createArm(2.5, 0.8, 0, 0x4ECDC4);
  scene.add(machine.leftArm.group);
  scene.add(machine.rightArm.group);
  
  // PRESS MACHINES
  machine.leftPress = createPressMachine(-6, 2, 0);
  machine.rightPress = createPressMachine(6, 2, 0);
  
  // WRAPPING MACHINES
  machine.leftWrapper = createWrappingMachine(-6, 0, 0);
  machine.rightWrapper = createWrappingMachine(6, 0, 0);
  
  // TRAYS
  machine.leftTray = createTray(-6, 0.3, 4);
  machine.rightTray = createTray(6, 0.3, 4);
}

function createArm(x, y, z, color) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  
  // Segment 1
  const seg1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.35, 0.3, 2.5),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 })
  );
  seg1.position.z = -1.25;
  seg1.castShadow = true;
  group.add(seg1);
  
  // Segment 2
  const seg2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.25, 2.2),
    new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 })
  );
  seg2.position.z = -3.6;
  seg2.castShadow = true;
  group.add(seg2);
  
  // Gripper
  const gripper = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.2, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.7, roughness: 0.3 })
  );
  gripper.position.z = -5;
  gripper.castShadow = true;
  group.add(gripper);
  
  // Gripper jaws
  const jawLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x666666 })
  );
  jawLeft.position.set(-0.35, 0, -5.2);
  jawLeft.castShadow = true;
  group.add(jawLeft);
  
  const jawRight = new THREE.Mesh(
    new THREE.BoxGeometry(0.15, 0.15, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x666666 })
  );
  jawRight.position.set(0.35, 0, -5.2);
  jawRight.castShadow = true;
  group.add(jawRight);
  
  return { group, gripper, jawLeft, jawRight };
}

function createPressMachine(x, y, z) {
  const press = { topPlate: null, bottomPlate: null, pistons: [] };
  
  // Bottom plate
  const bottomGeo = new THREE.BoxGeometry(1.5, 0.3, 1.5);
  const bottomMat = new THREE.MeshStandardMaterial({ color: 0x808080, metalness: 0.7, roughness: 0.3 });
  press.bottomPlate = new THREE.Mesh(bottomGeo, bottomMat);
  press.bottomPlate.position.set(x, y - 1.15, z);
  press.bottomPlate.castShadow = true;
  press.bottomPlate.receiveShadow = true;
  scene.add(press.bottomPlate);
  
  // Top plate
  const topGeo = new THREE.BoxGeometry(1.5, 0.3, 1.5);
  const topMat = new THREE.MeshStandardMaterial({ color: 0xC0C0C0, metalness: 0.8, roughness: 0.2 });
  press.topPlate = new THREE.Mesh(topGeo, topMat);
  press.topPlate.position.set(x, y + 0.35, z);
  press.topPlate.castShadow = true;
  scene.add(press.topPlate);
  
  // Pistons
  const pistonPositions = [
    [-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]
  ];
  pistonPositions.forEach(([px, pz]) => {
    const piston = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 1.5, 16),
      new THREE.MeshStandardMaterial({ color: 0xA0A0A0 })
    );
    piston.position.set(x + px, y - 0.4, z + pz);
    piston.castShadow = true;
    scene.add(piston);
    press.pistons.push(piston);
  });
  
  return press;
}

function createWrappingMachine(x, y, z) {
  const wrapper = { body: null, disk: null };
  
  // Body
  const bodyGeo = new THREE.BoxGeometry(2.5, 3.2, 2);
  const bodyMat = new THREE.MeshStandardMaterial({ 
    color: 0x00AA00, 
    metalness: 0.6, 
    roughness: 0.4,
    transparent: true,
    opacity: 0.85
  });
  wrapper.body = new THREE.Mesh(bodyGeo, bodyMat);
  wrapper.body.position.set(x, y + 1.6, z);
  wrapper.body.castShadow = true;
  scene.add(wrapper.body);
  
  // Disk
  const diskGeo = new THREE.CylinderGeometry(1, 1, 0.35, 32);
  const diskMat = new THREE.MeshStandardMaterial({ 
    color: 0xFFA500, 
    metalness: 0.7, 
    roughness: 0.3 
  });
  wrapper.disk = new THREE.Mesh(diskGeo, diskMat);
  wrapper.disk.position.set(x, y + 3.2, z);
  wrapper.disk.castShadow = true;
  scene.add(wrapper.disk);
  
  return wrapper;
}

function createTray(x, y, z) {
  const trayGeo = new THREE.BoxGeometry(3.5, 0.5, 3.5);
  const trayMat = new THREE.MeshStandardMaterial({ color: 0x8B4513, metalness: 0.5, roughness: 0.6 });
  const tray = new THREE.Mesh(trayGeo, trayMat);
  tray.position.set(x, y, z);
  tray.castShadow = true;
  tray.receiveShadow = true;
  scene.add(tray);
  return tray;
}

// ===== BUNDLE CREATION =====
function createRawBundle() {
  const bundleGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.8, 32);
  const bundleMat = new THREE.MeshStandardMaterial({ 
    color: 0xF5DEB3,
    emissive: 0xFFFFAA,
    emissiveIntensity: 0.2,
    roughness: 0.8 
  });
  const bundle = new THREE.Mesh(bundleGeo, bundleMat);
  bundle.castShadow = true;
  bundle.receiveShadow = true;
  return bundle;
}

function createWrappedBundle() {
  const group = new THREE.Group();
  
  // Cylinder body
  const bundleGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.5, 32);
  const bundleMat = new THREE.MeshStandardMaterial({ 
    color: 0xCD853F,
    roughness: 0.7 
  });
  const cylinder = new THREE.Mesh(bundleGeo, bundleMat);
  cylinder.castShadow = true;
  group.add(cylinder);
  
  // Tape bands
  const bandPositions = [-0.15, -0.05, 0.05, 0.15];
  bandPositions.forEach(yPos => {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.37, 0.37, 0.04, 32),
      new THREE.MeshStandardMaterial({ color: 0xFFFFFF, metalness: 0.3, roughness: 0.5 })
    );
    band.position.y = yPos;
    band.castShadow = true;
    group.add(band);
  });
  
  group.castShadow = true;
  return group;
}

// ===== ANIMATION PHASES =====
function updateAnimation() {
  const t = cycleTime % CYCLE_DURATION;
  const progress = (t / CYCLE_DURATION) * 100;
  ui.progressFill.style.width = progress + '%';
  ui.cycleTime.textContent = t.toFixed(1) + 's';
  
  // Find current phase
  let currentPhase = null;
  for (const phase of PHASES) {
    if (t >= phase.start && t < phase.end) {
      currentPhase = phase;
      break;
    }
  }
  
  if (currentPhase) {
    ui.currentPhase.textContent = currentPhase.label;
    const phaseProgress = (t - currentPhase.start) / (currentPhase.end - currentPhase.start);
    executePhase(currentPhase.name, phaseProgress, t);
  }
  
  // Rotate wrapper disks
  if (machine.leftWrapper.disk) machine.leftWrapper.disk.rotation.y += 0.05;
  if (machine.rightWrapper.disk) machine.rightWrapper.disk.rotation.y += 0.05;
}

function executePhase(phaseName, progress, time) {
  const ease = easeInOutQuad(progress);
  
  switch (phaseName) {
    case 'spawn':
      if (!leftBundle) {
        leftBundle = createRawBundle();
        leftBundle.position.set(-0.5, 6.4, -7);
        leftBundle.scale.set(0.01, 0.01, 0.01);
        scene.add(leftBundle);
      }
      if (!rightBundle) {
        rightBundle = createRawBundle();
        rightBundle.position.set(0.5, 6.4, -7);
        rightBundle.scale.set(0.01, 0.01, 0.01);
        scene.add(rightBundle);
      }
      // Fade in
      if (leftBundle) {
        const scale = ease;
        leftBundle.scale.set(scale, scale, scale);
      }
      if (rightBundle) {
        const scale = ease;
        rightBundle.scale.set(scale, scale, scale);
      }
      // Reset arms
      machine.leftArm.group.rotation.y = 0;
      machine.rightArm.group.rotation.y = 0;
      machine.leftArm.jawLeft.position.x = -0.35;
      machine.leftArm.jawRight.position.x = 0.35;
      machine.rightArm.jawLeft.position.x = -0.35;
      machine.rightArm.jawRight.position.x = 0.35;
      break;
      
    case 'pickup':
      // Arms stay pointing to TOP (rotation = 0)
      machine.leftArm.group.rotation.y = 0;
      machine.rightArm.group.rotation.y = 0;
      
      // Close grippers
      const jawDist = 0.35 - ease * 0.15;
      machine.leftArm.jawLeft.position.x = -jawDist;
      machine.leftArm.jawRight.position.x = jawDist;
      machine.rightArm.jawLeft.position.x = -jawDist;
      machine.rightArm.jawRight.position.x = jawDist;
      
      // Attach bundles to grippers at halfway
      if (progress > 0.5) {
        if (leftBundle && leftBundle.parent !== machine.leftArm.group) {
          machine.leftArm.group.attach(leftBundle);
          leftBundle.position.set(0, 0.2, -5.2);
        }
        if (rightBundle && rightBundle.parent !== machine.rightArm.group) {
          machine.rightArm.group.attach(rightBundle);
          rightBundle.position.set(0, 0.2, -5.2);
        }
      }
      break;
      
    case 'transport_to_press':
      // Left arm rotates left (90 degrees)
      machine.leftArm.group.rotation.y = ease * (Math.PI / 2);
      // Right arm rotates right (-90 degrees)
      machine.rightArm.group.rotation.y = ease * (-Math.PI / 2);
      
      // Keep grippers closed
      machine.leftArm.jawLeft.position.x = -0.2;
      machine.leftArm.jawRight.position.x = 0.2;
      machine.rightArm.jawLeft.position.x = -0.2;
      machine.rightArm.jawRight.position.x = 0.2;
      break;
      
    case 'press_down':
      // Arms at 90 degrees
      machine.leftArm.group.rotation.y = Math.PI / 2;
      machine.rightArm.group.rotation.y = -Math.PI / 2;
      
      // Open grippers and detach bundles
      if (progress > 0.3) {
        machine.leftArm.jawLeft.position.x = -0.4;
        machine.leftArm.jawRight.position.x = 0.4;
        machine.rightArm.jawLeft.position.x = -0.4;
        machine.rightArm.jawRight.position.x = 0.4;
        
        if (leftBundle && leftBundle.parent !== scene) {
          scene.attach(leftBundle);
          leftBundle.position.set(-6, 1.5, 0);
        }
        if (rightBundle && rightBundle.parent !== scene) {
          scene.attach(rightBundle);
          rightBundle.position.set(6, 1.5, 0);
        }
      }
      
      // Press plates descend
      const pressY = 2.35 - ease * 0.5;
      machine.leftPress.topPlate.position.y = pressY;
      machine.rightPress.topPlate.position.y = pressY;
      
      // Compress bundles
      if (leftBundle) {
        leftBundle.scale.y = 1 - ease * 0.375;
        leftBundle.position.y = 1.5 - ease * 0.15;
      }
      if (rightBundle) {
        rightBundle.scale.y = 1 - ease * 0.375;
        rightBundle.position.y = 1.5 - ease * 0.15;
      }
      break;
      
    case 'vibration':
      // Shake plates horizontally
      const shakeFreq = 8;
      const shakeAmp = 0.1 * (1 - progress * 0.7);
      const shake = Math.sin(progress * shakeFreq * Math.PI * 2) * shakeAmp;
      
      machine.leftPress.topPlate.position.y = 1.85;
      machine.leftPress.topPlate.position.x = -6 + shake;
      machine.rightPress.topPlate.position.y = 1.85;
      machine.rightPress.topPlate.position.x = 6 + shake;
      
      if (leftBundle) {
        leftBundle.position.x = -6 + shake;
        leftBundle.position.y = 1.35;
      }
      if (rightBundle) {
        rightBundle.position.x = 6 + shake;
        rightBundle.position.y = 1.35;
      }
      break;
      
    case 'hold_pressed':
      machine.leftPress.topPlate.position.set(-6, 1.85, 0);
      machine.rightPress.topPlate.position.set(6, 1.85, 0);
      if (leftBundle) leftBundle.position.set(-6, 1.35, 0);
      if (rightBundle) rightBundle.position.set(6, 1.35, 0);
      break;
      
    case 'release':
      // Plates rise
      const releaseY = 1.85 + ease * 0.5;
      machine.leftPress.topPlate.position.y = releaseY;
      machine.rightPress.topPlate.position.y = releaseY;
      break;
      
    case 'wrapping':
      // Move bundles into wrapper machines
      if (leftBundle) {
        leftBundle.position.set(-6, 1.6, 0);
        leftBundle.rotation.y = progress * Math.PI * 4;
      }
      if (rightBundle) {
        rightBundle.position.set(6, 1.6, 0);
        rightBundle.rotation.y = progress * Math.PI * 4;
      }
      
      // Replace with wrapped bundles at 80%
      if (progress > 0.8) {
        if (leftBundle && leftBundle.children.length < 2) {
          const pos = leftBundle.position.clone();
          const rot = leftBundle.rotation.clone();
          scene.remove(leftBundle);
          leftBundle = createWrappedBundle();
          leftBundle.position.copy(pos);
          leftBundle.rotation.copy(rot);
          scene.add(leftBundle);
        }
        if (rightBundle && rightBundle.children.length < 2) {
          const pos = rightBundle.position.clone();
          const rot = rightBundle.rotation.clone();
          scene.remove(rightBundle);
          rightBundle = createWrappedBundle();
          rightBundle.position.copy(pos);
          rightBundle.rotation.copy(rot);
          scene.add(rightBundle);
        }
      }
      break;
      
    case 'eject':
      // Exit from wrappers
      if (leftBundle) {
        leftBundle.position.set(-6, 1.6, 0);
        leftBundle.rotation.y = 0;
      }
      if (rightBundle) {
        rightBundle.position.set(6, 1.6, 0);
        rightBundle.rotation.y = 0;
      }
      
      // Arms pick up wrapped bundles
      machine.leftArm.group.rotation.y = Math.PI / 2;
      machine.rightArm.group.rotation.y = -Math.PI / 2;
      
      const grabJaw = 0.4 - ease * 0.2;
      machine.leftArm.jawLeft.position.x = -grabJaw;
      machine.leftArm.jawRight.position.x = grabJaw;
      machine.rightArm.jawLeft.position.x = -grabJaw;
      machine.rightArm.jawRight.position.x = grabJaw;
      
      if (progress > 0.5) {
        if (leftBundle && leftBundle.parent !== machine.leftArm.group) {
          machine.leftArm.group.attach(leftBundle);
          leftBundle.position.set(0, 0.2, -5.2);
          leftBundle.rotation.set(0, 0, 0);
        }
        if (rightBundle && rightBundle.parent !== machine.rightArm.group) {
          machine.rightArm.group.attach(rightBundle);
          rightBundle.position.set(0, 0.2, -5.2);
          rightBundle.rotation.set(0, 0, 0);
        }
      }
      break;
      
    case 'transport_to_tray':
      // Rotate to trays
      const trayAngleLeft = Math.PI / 2 + ease * (Math.PI / 4);
      const trayAngleRight = -Math.PI / 2 - ease * (Math.PI / 4);
      machine.leftArm.group.rotation.y = trayAngleLeft;
      machine.rightArm.group.rotation.y = trayAngleRight;
      
      machine.leftArm.jawLeft.position.x = -0.2;
      machine.leftArm.jawRight.position.x = 0.2;
      machine.rightArm.jawLeft.position.x = -0.2;
      machine.rightArm.jawRight.position.x = 0.2;
      break;
      
    case 'place_in_tray':
      machine.leftArm.group.rotation.y = Math.PI / 2 + Math.PI / 4;
      machine.rightArm.group.rotation.y = -Math.PI / 2 - Math.PI / 4;
      
      // Open grippers
      const dropJaw = 0.2 + ease * 0.2;
      machine.leftArm.jawLeft.position.x = -dropJaw;
      machine.leftArm.jawRight.position.x = dropJaw;
      machine.rightArm.jawLeft.position.x = -dropJaw;
      machine.rightArm.jawRight.position.x = dropJaw;
      
      // Place bundles in trays
      if (progress > 0.5) {
        if (leftBundle && leftBundle.parent !== scene) {
          scene.attach(leftBundle);
          const slotIndex = leftTrayBundles.length;
          const row = Math.floor(slotIndex / 4);
          const col = slotIndex % 4;
          leftBundle.position.set(
            -6 + (col * 0.7 - 1.05),
            0.55,
            4 + (row * 0.7 - 0.35)
          );
          leftBundle.rotation.set(0, 0, 0);
          leftTrayBundles.push(leftBundle);
          leftBundle = null;
          ui.leftCount.textContent = leftTrayBundles.length;
        }
        if (rightBundle && rightBundle.parent !== scene) {
          scene.attach(rightBundle);
          const slotIndex = rightTrayBundles.length;
          const row = Math.floor(slotIndex / 4);
          const col = slotIndex % 4;
          rightBundle.position.set(
            6 + (col * 0.7 - 1.05),
            0.55,
            4 + (row * 0.7 - 0.35)
          );
          rightBundle.rotation.set(0, 0, 0);
          rightTrayBundles.push(rightBundle);
          rightBundle = null;
          ui.rightCount.textContent = rightTrayBundles.length;
        }
      }
      
      // Update total count
      bundleCount = leftTrayBundles.length + rightTrayBundles.length;
      ui.bundleCount.textContent = bundleCount;
      break;
  }
}

// ===== EASING FUNCTION =====
function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  ui.playPause.addEventListener('click', () => {
    isPlaying = !isPlaying;
    ui.playPause.textContent = isPlaying ? '⏸️ Pause' : '▶️ Play';
  });
  
  ui.reset.addEventListener('click', () => {
    cycleTime = 0;
    bundleCount = 0;
    
    // Remove all bundles
    if (leftBundle) scene.remove(leftBundle);
    if (rightBundle) scene.remove(rightBundle);
    leftTrayBundles.forEach(b => scene.remove(b));
    rightTrayBundles.forEach(b => scene.remove(b));
    
    leftBundle = null;
    rightBundle = null;
    leftTrayBundles = [];
    rightTrayBundles = [];
    
    ui.bundleCount.textContent = '0';
    ui.leftCount.textContent = '0';
    ui.rightCount.textContent = '0';
  });
  
  ui.speed.addEventListener('input', (e) => {
    speed = parseFloat(e.target.value);
    ui.speedValue.textContent = speed.toFixed(1) + 'x';
  });
  
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

// ===== ANIMATION LOOP =====
function animate() {
  requestAnimationFrame(animate);
  
  const delta = clock.getDelta();
  
  if (isPlaying) {
    cycleTime += delta * speed;
    updateAnimation();
  }
  
  TWEEN.update();
  renderer.render(scene, camera);
}

// ===== START =====
init();