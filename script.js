/**
 * 🎄 Interactive 3D Christmas Tree with AI Hand Tracking
 * Features: Three.js, MediaPipe, Audio Visualizer, Dynamic Day/Night Cycle
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

// --- 1. CONFIGURATION ---
const CONFIG = {
    colors: {
        bg: 0x000000,
        champagneGold: 0xffd966,
        deepGreen: 0x03180a,
        accentRed: 0x990000,
    },
    particles: {
        count: 1500,
        dustCount: 2500,
        treeHeight: 24,
        treeRadius: 8
    },
    camera: { z: 50 }
};

// --- 2. STATE MANAGEMENT ---
const STATE = {
    mode: 'TREE', // 'TREE', 'SCATTER', 'FOCUS'
    focusIndex: -1,
    focusTarget: null,
    hand: { detected: false, x: 0, y: 0 },
    rotation: { x: 0, y: 0 }
};

// --- 3. GLOBAL VARIABLES ---
let scene, camera, renderer, composer, mainGroup;
let clock = new THREE.Clock();
let particleSystem = [];
let photoMeshGroup = new THREE.Group();
let handLandmarker, video, webcamCanvas, webcamCtx;
let caneTexture, audioAnalyser, dataArray;
let starMaterial, starMesh;

// --- 4. CORE INITIALIZATION ---
async function init() {
    initThree();           
    setupEnvironment();    
    setupLights();         
    createTextures();      
    createParticles();     
    createDust();          
    setupPostProcessing(); 
    setupEvents();         
    await initMediaPipe(); 

    // Handle Loader UI
    const loader = document.getElementById('loader');
    if (loader) {
        loader.style.opacity = 0;
        setTimeout(() => loader.remove(), 800);
    }

    animate(); 
}

function initThree() {
    const container = document.getElementById('canvas-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020406);
    scene.fog = new THREE.FogExp2(0x020406, 0.004);

    camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, CONFIG.camera.z);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2; 

    container.appendChild(renderer.domElement);
    mainGroup = new THREE.Group();
    scene.add(mainGroup);
}

// --- 5. ENVIRONMENT & TEXTURES ---
function setupEnvironment() {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
}

function setupLights() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const innerLight = new THREE.PointLight(0xffaa00, 2, 20);
    innerLight.position.set(0, 5, 0);
    mainGroup.add(innerLight);

    const spotGold = new THREE.SpotLight(0xffcc66, 1200);
    spotGold.position.set(30, 40, 40);
    scene.add(spotGold);

    const spotBlue = new THREE.SpotLight(0x6688ff, 600);
    spotBlue.position.set(-30, 20, -30);
    scene.add(spotBlue);

    const fill = new THREE.DirectionalLight(0xffeebb, 0.8);
    fill.position.set(0, 0, 50);
    scene.add(fill);
}

function createTextures() {
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#880000';
    ctx.beginPath();
    for (let i = -128; i < 256; i += 32) {
        ctx.moveTo(i, 0); ctx.lineTo(i + 32, 128); ctx.lineTo(i + 16, 128); ctx.lineTo(i - 16, 0);
    }
    ctx.fill();
    caneTexture = new THREE.CanvasTexture(canvas);
    caneTexture.wrapS = caneTexture.wrapT = THREE.RepeatWrapping;
    caneTexture.repeat.set(3, 3);
}

// --- 6. PARTICLE SYSTEM CLASS ---
class Particle {
    constructor(mesh, type, isDust = false) {
        this.mesh = mesh;
        this.type = type;
        this.isDust = isDust;
        this.posTree = new THREE.Vector3();    
        this.posScatter = new THREE.Vector3(); 
        this.baseScale = mesh.scale.x;

        const speedMult = (type === 'PHOTO') ? 0.3 : 2.0;
        this.spinSpeed = new THREE.Vector3(
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult,
            (Math.random() - 0.5) * speedMult
        );
        this.calculatePositions();
    }

    calculatePositions() {
        const h = CONFIG.particles.treeHeight;
        let t = Math.pow(Math.random(), 0.8);
        const y = (t * h) - (h / 2);
        let rMax = Math.max(0.5, CONFIG.particles.treeRadius * (1.0 - t));
        const angle = t * 50 * Math.PI + Math.random() * Math.PI;
        const r = rMax * (0.8 + Math.random() * 0.4);
        this.posTree.set(Math.cos(angle) * r, y, Math.sin(angle) * r);

        let rScatter = this.isDust ? (12 + Math.random() * 20) : (8 + Math.random() * 12);
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        this.posScatter.set(
            rScatter * Math.sin(phi) * Math.cos(theta),
            rScatter * Math.sin(phi) * Math.sin(theta),
            rScatter * Math.cos(phi)
        );
    }

    update(dt, mode, focusTargetMesh) {
        let target = (mode === 'SCATTER') ? this.posScatter : this.posTree;

        if (mode === 'FOCUS') {
            if (this.mesh === focusTargetMesh) {
                const invMatrix = new THREE.Matrix4().copy(mainGroup.matrixWorld).invert();
                target = new THREE.Vector3(0, 2, 35).applyMatrix4(invMatrix);
            } else {
                target = this.posScatter;
            }
        }

        const lerpSpeed = (mode === 'FOCUS' && this.mesh === focusTargetMesh) ? 5.0 : 2.0;
        this.mesh.position.lerp(target, lerpSpeed * dt);

        if (mode === 'SCATTER') {
            this.mesh.rotation.x += this.spinSpeed.x * dt;
            this.mesh.rotation.y += this.spinSpeed.y * dt;
            this.mesh.rotation.z += this.spinSpeed.z * dt;
        } else if (mode === 'TREE') {
            this.mesh.rotation.x = THREE.MathUtils.lerp(this.mesh.rotation.x, 0, dt);
            this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt);
            this.mesh.rotation.y += 0.5 * dt;
        }

        if (mode === 'FOCUS' && this.mesh === focusTargetMesh) this.mesh.lookAt(camera.position);

        let s = this.baseScale;
        if (this.isDust) {
            s = (mode === 'TREE') ? 0 : this.baseScale * (0.8 + 0.4 * Math.sin(clock.elapsedTime * 4 + this.mesh.id));
        } else if (mode === 'SCATTER' && this.type === 'PHOTO') {
            s = this.baseScale * 2.5;
        } else if (mode === 'FOCUS') {
            s = (this.mesh === focusTargetMesh) ? 4.5 : this.baseScale * 0.8;
        }
        this.mesh.scale.lerp(new THREE.Vector3(s, s, s), 4 * dt);
    }
}

// --- 7. CREATION LOGIC ---
function createParticles() {
    const sphereGeo = new THREE.SphereGeometry(0.5, 32, 32);
    const boxGeo = new THREE.BoxGeometry(0.55, 0.55, 0.55);
    const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0, 0.3, 0),
        new THREE.Vector3(0.1, 0.5, 0), new THREE.Vector3(0.3, 0.4, 0)
    ]);
    const candyGeo = new THREE.TubeGeometry(curve, 16, 0.08, 8, false);

    const goldMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.champagneGold, metalness: 1.0, roughness: 0.1, emissive: 0x443300, emissiveIntensity: 0.3 });
    const greenMat = new THREE.MeshStandardMaterial({ color: CONFIG.colors.deepGreen, metalness: 0.2, roughness: 0.8, emissive: 0x002200, emissiveIntensity: 0.2 });
    const redMat = new THREE.MeshPhysicalMaterial({ color: CONFIG.colors.accentRed, metalness: 0.3, roughness: 0.2, clearcoat: 1.0, emissive: 0x330000 });
    const candyMat = new THREE.MeshStandardMaterial({ map: caneTexture, roughness: 0.4 });

    for (let i = 0; i < CONFIG.particles.count; i++) {
        const rand = Math.random();
        let mesh, type;
        if (rand < 0.4) { mesh = new THREE.Mesh(boxGeo, greenMat); type = 'BOX'; }
        else if (rand < 0.7) { mesh = new THREE.Mesh(boxGeo, goldMat); type = 'GOLD_BOX'; }
        else if (rand < 0.92) { mesh = new THREE.Mesh(sphereGeo, goldMat); type = 'GOLD_SPHERE'; }
        else if (rand < 0.97) { mesh = new THREE.Mesh(sphereGeo, redMat); type = 'RED'; }
        else { mesh = new THREE.Mesh(candyGeo, candyMat); type = 'CANE'; }

        const s = 0.4 + Math.random() * 0.5;
        mesh.scale.set(s, s, s);
        mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        mainGroup.add(mesh);
        particleSystem.push(new Particle(mesh, type));
    }
    createStar();
    mainGroup.add(photoMeshGroup);
}

function createStar() {
    const starShape = new THREE.Shape();
    const points = 5;
    for (let i = 0; i < points * 2; i++) {
        const r = i % 2 === 0 ? 1.5 : 0.6;
        const a = (i * Math.PI) / points;
        starShape[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
    }
    starShape.closePath();
    const starGeo = new THREE.ExtrudeGeometry(starShape, { depth: 0.4, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.1, bevelSegments: 3 });
    starMaterial = new THREE.MeshStandardMaterial({ color: 0xffdd88, emissive: 0xffaa00, emissiveIntensity: 1.5, metalness: 1.0, roughness: 0.1 });
    starMesh = new THREE.Mesh(starGeo, starMaterial);
    starMesh.rotation.z = Math.PI / 2;
    starMesh.position.set(0, CONFIG.particles.treeHeight / 2 + 1.5, 0);
    mainGroup.add(starMesh);
}

function createDust() {
    const geo = new THREE.TetrahedronGeometry(0.08, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffeebb, transparent: true, opacity: 0.8 });
    for (let i = 0; i < CONFIG.particles.dustCount; i++) {
        const mesh = new THREE.Mesh(geo, mat);
        mesh.scale.setScalar(0.5 + Math.random());
        mainGroup.add(mesh);
        particleSystem.push(new Particle(mesh, 'DUST', true));
    }
}

// --- 8. AUDIO & VISUAL UPDATES ---
function setupAudioVisualizer() {
    const audio = document.getElementById('bg-music');
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioAnalyser = audioCtx.createAnalyser();
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(audioAnalyser);
    audioAnalyser.connect(audioCtx.destination);
    audioAnalyser.fftSize = 256;
    dataArray = new Uint8Array(audioAnalyser.frequencyBinCount);
}

function updateStarPulse() {
    if (!audioAnalyser || !starMaterial || !starMesh) return;
    audioAnalyser.getByteFrequencyData(dataArray);
    let bass = 0;
    for (let i = 0; i < 10; i++) bass += dataArray[i];
    bass /= 10;
    starMaterial.emissiveIntensity = THREE.MathUtils.lerp(starMaterial.emissiveIntensity, 1.0 + (bass/255)*8.0, 0.1);
    const s = THREE.MathUtils.lerp(starMesh.scale.x, 1.0 + (bass/255)*0.5, 0.2);
    starMesh.scale.set(s, s, s);
}

function updateDynamicBackground() {
    const hours = new Date().getHours();
    const isDay = hours >= 6 && hours < 18;
    const bgColor = new THREE.Color(isDay ? 0x101a2d : 0x000000);
    const fogColor = new THREE.Color(isDay ? 0x0a121e : 0x010103);
    const ambient = isDay ? 0.7 : 0.2;
    const exposure = isDay ? 1.4 : 1.0;

    if (scene.background) scene.background.lerp(bgColor, 0.02);
    if (scene.fog) scene.fog.color.lerp(fogColor, 0.02);
    renderer.toneMappingExposure = THREE.MathUtils.lerp(renderer.toneMappingExposure, exposure, 0.02);
    scene.traverse(c => { if (c.isAmbientLight) c.intensity = THREE.MathUtils.lerp(c.intensity, ambient, 0.02); });
}

// --- 9. PHOTO & GESTURE HANDLING ---
function addPhotoToScene(texture) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.05), new THREE.MeshStandardMaterial({ color: CONFIG.colors.champagneGold, metalness: 1.0, roughness: 0.1 }));
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), new THREE.MeshBasicMaterial({ map: texture }));
    photo.position.z = 0.04;
    const group = new THREE.Group();
    group.add(frame, photo);
    group.scale.setScalar(0.8);
    photoMeshGroup.add(group);
    particleSystem.push(new Particle(group, 'PHOTO'));
}

function handleImageUpload(e) {
    Array.from(e.target.files).forEach(f => {
        const reader = new FileReader();
        reader.onload = (ev) => new THREE.TextureLoader().load(ev.target.result, (t) => {
            t.colorSpace = THREE.SRGBColorSpace;
            addPhotoToScene(t);
        });
        reader.readAsDataURL(f);
    });
}

function processGestures(result) {
    if (result.landmarks?.length > 0) {
        STATE.hand.detected = true;
        const lm = result.landmarks[0];
        STATE.hand.x = (lm[9].x - 0.5) * 2;
        STATE.hand.y = (lm[9].y - 0.5) * 2;
        const pinchDist = Math.hypot(lm[4].x - lm[8].x, lm[4].y - lm[8].y);
        const wrist = lm[0];
        let avgDist = [8, 12, 16, 20].reduce((sum, i) => sum + Math.hypot(lm[i].x - wrist.x, lm[i].y - wrist.y), 0) / 4;

        if (pinchDist < 0.05) {
            if (STATE.mode !== 'FOCUS') {
                STATE.mode = 'FOCUS';
                const photos = particleSystem.filter(p => p.type === 'PHOTO');
                if (photos.length) STATE.focusTarget = photos[Math.floor(Math.random() * photos.length)].mesh;
            }
        } else if (avgDist < 0.25) { STATE.mode = 'TREE'; STATE.focusTarget = null; }
        else if (avgDist > 0.4) { STATE.mode = 'SCATTER'; STATE.focusTarget = null; }
    } else { STATE.hand.detected = false; }
}

// --- 10. AI & SYSTEM EVENTS ---
async function initMediaPipe() {
    video = document.getElementById('webcam');
    webcamCanvas = document.getElementById('webcam-preview');
    webcamCtx = webcamCanvas.getContext('2d');
    webcamCanvas.width = 160; webcamCanvas.height = 120;
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`, delegate: "GPU" },
        runningMode: "VIDEO", numHands: 1
    });
    if (navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
        video.addEventListener("loadeddata", predictWebcam);
    }
}

async function predictWebcam() {
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        webcamCtx.save();
        webcamCtx.clearRect(0, 0, webcamCanvas.width, webcamCanvas.height);
        webcamCtx.drawImage(video, 0, 0, webcamCanvas.width, webcamCanvas.height);
        if (handLandmarker) {
            const result = handLandmarker.detectForVideo(video, performance.now());
            if (result.landmarks?.length > 0) {
                webcamCtx.fillStyle = "#d4af37";
                result.landmarks[0].forEach(p => { webcamCtx.beginPath(); webcamCtx.arc(p.x * webcamCanvas.width, p.y * webcamCanvas.height, 2, 0, 7); webcamCtx.fill(); });
            }
            processGestures(result);
        }
        webcamCtx.restore();
    }
    requestAnimationFrame(predictWebcam);
}
let lastVideoTime = -1;

function setupPostProcessing() {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloom.threshold = 0.7; bloom.strength = 0.45; bloom.radius = 0.4;
    composer.addPass(bloom);
}

function setupEvents() {
    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
    });

    const musicBtn = document.getElementById('music-btn');
    const bgMusic = document.getElementById('bg-music');
    musicBtn.addEventListener('click', () => {
        if (bgMusic.paused) {
            if (!audioAnalyser) setupAudioVisualizer();
            bgMusic.play();
            musicBtn.innerHTML = '🔊 MUSIC: ON';
        } else {
            bgMusic.pause();
            musicBtn.innerHTML = '🔈 MUSIC: OFF';
        }
    });

    document.getElementById('file-input').addEventListener('change', handleImageUpload);
    window.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'h') document.querySelector('.upload-wrapper')?.classList.toggle('ui-hidden');
        if (k === 'g') { const w = document.getElementById('webcam-wrapper'); if (w) w.style.opacity = w.style.opacity === "0" ? "1" : "0"; }
        if (k === 'm') musicBtn.click();
    });
}

// --- 11. MAIN LOOP ---
function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    updateDynamicBackground();
    updateStarPulse();

    if (STATE.mode === 'SCATTER' && STATE.hand.detected) {
        STATE.rotation.y += ((STATE.hand.x * Math.PI * 0.9) - STATE.rotation.y) * 3.0 * dt;
        STATE.rotation.x += ((STATE.hand.y * Math.PI * 0.25) - STATE.rotation.x) * 3.0 * dt;
    } else {
        STATE.rotation.y += (STATE.mode === 'TREE' ? 0.3 : 0.1) * dt;
        STATE.rotation.x += (0 - STATE.rotation.x) * 2.0 * dt;
    }

    mainGroup.rotation.y = STATE.rotation.y;
    mainGroup.rotation.x = STATE.rotation.x;
    particleSystem.forEach(p => p.update(dt, STATE.mode, STATE.focusTarget));
    composer.render();
}

init();