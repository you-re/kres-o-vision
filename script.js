import * as THREE from './three/build/three.module.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from './three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './three/examples/jsm/postprocessing/RenderPass.js';

// DOF
import { BokehPass } from './three/examples/jsm/postprocessing/BokehPass.js';

// Bloom + Tonemapping
import { UnrealBloomPass } from './three/examples/jsm/postprocessing/UnrealBloomPass.js';

// HDRI and other necessary imports
import { RGBELoader } from './three/examples/jsm/loaders/RGBELoader.js';
import { PMREMGenerator } from './three/build/three.module.js';

// FXAA
import { ShaderPass } from './three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from './three/examples/jsm/shaders/FXAAShader.js';

// Chromatic Aberration
import { ChromaticAberrationShader } from './shaders/ChromaticAberrationShader.js';

// Grain
import { GrainShader } from './three/examples/jsm/shaders/GrainShader.js';

// Vignette
import { VignetteShader } from './three/examples/jsm/shaders/VignetteShader.js';

// ACES Transform
import { ACESShader } from './shaders/ACESShader.js';

// Toon post processing
import { toonShader } from './shaders/toonShader.js';

// Edge detect shader
import { gaussianBlurShader } from './shaders/gaussianBlurShader.js';
import { edgeDetectShader } from './shaders/edgeDetectShader.js';

let scene, camera, renderer, controls, composer, bloomPass, chromaticAberrationPass, grainPass;

// Variables for lerping the camera position
let lerpDuration = 0.2; // Duration of the lerp in seconds
let lerpStartTime = null;
let isLerping = false;

let lerpStartPosition = new THREE.Vector3();
let lerpEndPosition = new THREE.Vector3();
let lerpStartTarget = new THREE.Vector3();
let lerpEndTarget = new THREE.Vector3();

// ACES Material
const acesMaterial = new THREE.ShaderMaterial({
  uniforms: ACESShader.uniforms,
  vertexShader: ACESShader.vertexShader,
  fragmentShader: ACESShader.fragmentShader
});

// Animation stuff
const clock = new THREE.Clock();
let mixer;
const mixers = [];
const loader = new GLTFLoader();

// Focus on click
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

init();
animate();

function init() {
  // Scene setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x555555);

  // Camera setup
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(1, 1, 1);
  camera.updateProjectionMatrix();

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  
  // Light
  const light = new THREE.DirectionalLight(0xffffff, 5.0);

  light.position.set(0, 10, 0);
  light.target.position.set(-5, 0, 0);

  scene.add(light);
  scene.add(light.target); 

  document.body.appendChild(renderer.domElement);

  // Postprocessing setup
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
  });
  composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));

  // Controls for camera movement
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;

  /*
  // Load HDRI as environment map
  const pmremGenerator = new PMREMGenerator(renderer);
  new RGBELoader()
    .setDataType(THREE.FloatType)
    .load('hdri/georgentor_2k.hdr', (hdrTexture) => {
      const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
      scene.environment = envMap;
      hdrTexture.dispose();
      pmremGenerator.dispose();
    });
  */
    
  // Load 3D model (GLTF)
  loadModel('winnowing_basket_sim.gltf', new THREE.Vector3(0, 0, 0));
  loadModel('winnowing_basket_sim.gltf', new THREE.Vector3(3, 0, 0));
  loadModel('winnowing_basket_sim.gltf', new THREE.Vector3(0, 0, 3));
  loadModel('winnowing_basket_sim.gltf', new THREE.Vector3(3, 0, 3));
  modelGridArray('walls.gltf', new THREE.Vector3(-12, 1, -12), new THREE.Vector3(3, 0, 3), new THREE.Vector3(9, 1, 9), new THREE.Vector3(0.2, 0.1, 0.2));
  modelGridArray('floor.gltf', new THREE.Vector3(-9, 1.05, -9), new THREE.Vector3(9, 0, 9), new THREE.Vector3(3, 1, 3));

  // FXAA
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight); 
  composer.addPass(fxaaPass);
  
  // Vignette effect setup
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.material.uniforms['offset'].value = 1.4;  
  vignettePass.material.uniforms['darkness'].value = 1.0;
  composer.addPass(vignettePass);

  // Bloom effect (UnrealBloomPass)
  const bloomStrength = 0.2; 
  const bloomRadius = 0.01;  
  const bloomThreshold = 2.0; 
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomStrength,
    bloomRadius,
    bloomThreshold
  );
  composer.addPass(bloomPass);
  
  // Chromatic Aberration
  chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
  chromaticAberrationPass.material.uniforms['aberrationIntensity'].value = 0.02; // Controls the maximum intensity of the effect
  composer.addPass(chromaticAberrationPass);
  
  // Create Grain pass and set uniforms
  grainPass = new ShaderPass(GrainShader);
  grainPass.material.uniforms['grainIntensity'].value = 0.02;
  grainPass.material.uniforms['grainSize'].value = 2.0;
  grainPass.material.uniforms['height'].value = window.innerHeight;
  grainPass.material.uniforms['width'].value = window.innerWidth;
  composer.addPass(grainPass);
  
  // ACES Tonemapping
  const ACESPass = new ShaderPass(ACESShader);
  ACESPass.material.uniforms['Gamma'].value = 2.2;
  ACESPass.material.uniforms['toneMappingExposure'].value = 1.0;
  composer.addPass(ACESPass);
    
  /*
  // Toon Post Processing
  const toonPass = new ShaderPass(toonShader);
  composer.addPass(toonPass);
  
  // Edge Detect
  const edgePass = new ShaderPass(edgeDetectShader);
  edgePass.material.uniforms['width'].value = window.innerWidth;
  edgePass.material.uniforms['height'].value = window.innerHeight;
  composer.addPass(edgePass);
  */

  // Listen for mouse clicks
  document.addEventListener('click', setCameraPosition, false);
  
  // Resize event listener
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  // Update grain resolution
  grainPass.material.uniforms['height'].value = window.innerHeight;
  grainPass.material.uniforms['width'].value = window.innerWidth;
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  
  var camZPos = Math.min(1, Math.max(-1, camera.position.y));
  camera.position.set(camera.position.x, camZPos, camera.position.z);

  // Update all mixers
  const delta = clock.getDelta(); // use deltaTime for smoother animation
  mixers.forEach(m => m.update(delta));

  // Update Grain Pass
  grainPass.material.uniforms['time'].value += 0.05; 
  composer.render();

  // Update camera position
  // Lerp camera position and target
  if (isLerping) {
    let elapsedTime = clock.getElapsedTime() - lerpStartTime;
    let t = Math.min(elapsedTime / lerpDuration, 1); // Clamp t between 0 and 1

    camera.position.lerpVectors(lerpStartPosition, lerpEndPosition, t);
    controls.target.lerpVectors(lerpStartTarget, lerpEndTarget, t);

    if (t === 1) {
      isLerping = false; // Stop lerping when done
    }
  }
}

// Focus on click
function setCameraPosition(event) {
  // Normalize mouse coordinates to be between -1 and 1
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

  // Create a vector to store the direction
  let vector = new THREE.Vector3(mouse.x, mouse.y, 1);

  // Unproject the vector from normalized device coordinates to 3D world coordinates
  vector.unproject(camera);

  // Calculate the direction from the camera to the vector
  let direction = vector.sub(camera.position).normalize();

  // Set the ray origin and direction
  raycaster.ray.origin.copy(camera.position);
  raycaster.ray.direction.copy(direction);

  // Find the intersected objects
  let intersects = raycaster.intersectObjects(scene.children, true); // true to include descendants

  if (intersects.length === 0) return;

  let firstObjecName = intersects[0].object.name.split("_")[0];
  if (firstObjecName === "Walls" || firstObjecName === "FloorLP") {
    return;
  }

  console.log(firstObjecName);

  // Get the position of the intersected object
  let intersectedObject = intersects[0].object;
  let newTargetPosition = intersectedObject.getWorldPosition(new THREE.Vector3());

  if (newTargetPosition.equals(controls.target)) {
    return; // If the target is the same, do nothing
  }
  // Start lerping
  lerpStartTime = clock.getElapsedTime();
  isLerping = true;

  lerpStartPosition.copy(camera.position);
  lerpEndPosition.subVectors(newTargetPosition, controls.target).add(camera.position);

  lerpStartTarget.copy(controls.target);
  lerpEndTarget.copy(newTargetPosition);
}

// Function to load models
function loadModel(path, position = new THREE.Vector3(), onLoad = () => {}) {
  loader.load(path, (gltf) => {
    const model = gltf.scene;

    // Cast and recieve shadows
    model.castShadow = true;
    model.receiveShadow = true;

    model.position.copy(position);
    scene.add(model);

    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(clip => mixer.clipAction(clip).play());
      mixers.push(mixer);
    }

    onLoad(model);
  });
}

// Function to load models
function modelGridArray(path, position = new THREE.Vector3(), offset = new THREE.Vector3(), copies = new THREE.Vector3(), jitter = new THREE.Vector3(0, 0, 0), onLoad = () => {}) {

  loader.load(path, (gltf) => {
    const model = gltf.scene;

    // Cast and recieve shadows
    model.castShadow = true;
    model.receiveShadow = true;

    var positions = [];

    const numCopies = copies.x * copies.y * copies.z;
    for (let i = 0; i < numCopies; i++) {
      const x = (i % copies.x) * offset.x + (Math.random(i) * jitter.x - jitter.x / 2);
      const y = Math.floor(i / copies.x) % copies.y * offset.y + (Math.random(i) * jitter.y - jitter.z / 2);;
      const z = Math.floor(i / (copies.x * copies.y)) * offset.z + (Math.random(i) * jitter.y - jitter.z / 2);;

      const newPos = position.clone().add(new THREE.Vector3(x, y, z));
      positions.push(newPos);
    }

    positions.forEach(pos => {
      const clone = model.clone(true); // true = deep clone
      clone.position.copy(pos);
      scene.add(clone);
    });

    if (gltf.animations.length > 0) {
      const mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(clip => mixer.clipAction(clip).play());
      mixers.push(mixer);
    }

    onLoad(model);
  });
}
