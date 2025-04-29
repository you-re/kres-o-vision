"use strict";
import * as THREE from './three/build/three.module.js';
import { OrbitControls } from './three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from './three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from './three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from './three/examples/jsm/postprocessing/RenderPass.js';

// HDRI
import { RGBELoader } from './three/examples/jsm/loaders/RGBELoader.js';
import { PMREMGenerator } from './three/build/three.module.js';

// Bloom + Tonemapping
import { UnrealBloomPass } from './three/examples/jsm/postprocessing/UnrealBloomPass.js';

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

let scene, camera, renderer, controls, composer, bloomPass, chromaticAberrationPass, grainPass;

// Variables for lerping the camera position
let lerpDuration = 0.3; // Duration of the lerp in seconds
let lerpStartTime = null;
let isLerping = false;

let lerpStartPosition = new THREE.Vector3();
let lerpEndPosition = new THREE.Vector3();
let lerpStartTarget = new THREE.Vector3();
let lerpEndTarget = new THREE.Vector3();

// Active object for animation 
let active_object = "";

// Animation stuff
const clock = new THREE.Clock();
let mixer;
const mixers = [];
const loader = new GLTFLoader();

// Focus on click
let raycaster = new THREE.Raycaster();
let mouse = new THREE.Vector2();

let fogColor = new THREE.Color(0x0f0b0b);

// OneShoot animation
let oneShootCheck = false;
let oneShootObjects = [];
let oneShootStartTime = [];

// Reset scene
let lastInteractionTime = Date.now();
let interactionDetected = false;

loadScene();

function loadScene() {
  const loadingScreen = document.getElementById("loading-screen");
  const loadingPercent = document.getElementById("loading-percent");

  // Camera setup
  camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(1, 0.5, 1);
  camera.updateProjectionMatrix();

  // Renderer setup
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);

  // Controls for camera movement
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = false;
  controls.autoRotate = true;
  controls.autoRotateSpeed = -50.0;

  // Scene setup
  scene = new THREE.Scene();
  {
    const near = 10;
    const far = 30;
    scene.fog = new THREE.Fog(fogColor, near, far);
  }
  scene.background = fogColor;

  // Add the navigation spheres
  navigationSpheres();

  // Track loaded objects
  let objectsToLoad = 30; // Total number of objects to load
  let objectsLoaded = 1;

  function checkLoadingComplete() {
    // Update the loading screen
    objectsLoaded++;
    loadingPercent.textContent = Math.round((objectsLoaded / objectsToLoad) * 100) + "%";

    if (objectsLoaded === objectsToLoad) {
      if (loadingScreen) {
        loadingScreen.style.zIndex = "-1"; // Hide the loading screen
        controls.autoRotateSpeed = -1.0;
        controls.enableDamping = true;
      }
    }
  }

  // Load 3D models (GLTF)
  loadModel('winnowing_basket_sim.gltf', "Winnowing_Basket_LP", new THREE.Vector3(-3, 0, 0), checkLoadingComplete);

  loadModel('ox_thing.gltf', "Ox_Thing", new THREE.Vector3(3, 0, 0), checkLoadingComplete);

  loadModel('obj/Brana.gltf', "Brana", new THREE.Vector3(0, 0, 3), checkLoadingComplete);

  // Import all ceramic objects
  for (let i = 1; i < 24; i++) {
    let objectId = String(i).padStart(3, '0');
    let gltfName = "obj/Ceramic" + objectId + ".gltf";
    let importName = "Ceramic" + objectId;

    loadModel(gltfName, importName, new THREE.Vector3(0, 0, 3), checkLoadingComplete);
  }

  modelGridArray('walls.gltf', new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 0, 3), new THREE.Vector3(27, 1, 27), new THREE.Vector3(0.2, 0.2, 0.2), true, false, checkLoadingComplete);
  modelGridArray('candle.gltf', new THREE.Vector3(0, -0.1, 0), new THREE.Vector3(3, 0, 3), new THREE.Vector3(27, 1, 27), new THREE.Vector3(0, 0.1, 0), true, false, checkLoadingComplete);
  modelGridArray('ground.gltf', new THREE.Vector3(0, 0, 0), new THREE.Vector3(3, 0, 3), new THREE.Vector3(27, 1, 27), new THREE.Vector3(0, 0, 0), true, false, checkLoadingComplete);

  init();
  animate();
}

function init() {

  // Shadows
  // renderer.shadowMap.enabled = true;
  // renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /*
  // Light
  const light = new THREE.DirectionalLight(0xffffff, 5.0);

  light.position.set(0, 10, 0);
  light.target.position.set(-5, 0, 0);

  scene.add(light);
  scene.add(light.target); 
  */
  document.body.appendChild(renderer.domElement);

  // Postprocessing setup
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    encoding: THREE.sRGBEncoding,
  });
  composer = new EffectComposer(renderer, renderTarget);
  composer.addPass(new RenderPass(scene, camera));

  // Load HDRI as environment map
  const pmremGenerator = new PMREMGenerator(renderer);
  new RGBELoader()
    .setDataType(THREE.FloatType)
    .load('hdri/dungeon_2k.hdr', (hdrTexture) => {
      const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
      scene.environment = envMap;
      scene.background = fogColor;
      hdrTexture.dispose();
      pmremGenerator.dispose();
    });

  // FXAA
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight); 
  composer.addPass(fxaaPass);

  // Bloom effect (UnrealBloomPass)
  const bloomStrength = 1.0; 
  const bloomRadius = 0.01;  
  const bloomThreshold = 5.0; 
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomStrength,
    bloomRadius,
    bloomThreshold
  );
  composer.addPass(bloomPass);

  // Vignette effect setup
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.material.uniforms['offset'].value = 1.4;  
  vignettePass.material.uniforms['darkness'].value = 1.0;
  composer.addPass(vignettePass);
  
  // Chromatic Aberration
  chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
  chromaticAberrationPass.material.uniforms['aberrationIntensity'].value = 0.04; // Controls the maximum intensity of the effect
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

  // Listen for user interactions
  document.addEventListener('mousemove', resetInteractionTimer);
  document.addEventListener('keydown', resetInteractionTimer);
  document.addEventListener('click', resetInteractionTimer);

  composer.render();
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

function oneShootAnimation(oneShootDelta) {
  // Check all the objects tagged for oneShootAnimation
  for (let i = 0; i < oneShootObjects.length; i++) {
    const objectName = oneShootObjects[i];
    const elapsedTime = clock.getElapsedTime() - oneShootStartTime[i];

    mixers.forEach(m => {
      const rootMixerName = m.getRoot().name;

      if (rootMixerName.includes(objectName)) {
        // Check if the animation finished and reset it
        if (elapsedTime > 4.4) { // Need to find a way to get the duration of the animation
          m.setTime(0.0);
        }
        else {
          // Update the animation
          m.update(oneShootDelta);
          }
        }
      });

    if (elapsedTime > 4.4) { // Assuming 4.3 is the duration of the animation
      oneShootObjects.splice(i, 1);
      oneShootStartTime.splice(i, 1);
      i--; // Adjust index after removal
    }
  }
}

function animate() {
  controls.update();  
  
  // Start checking for inactivity
  checkUserInactivity();
  
  var camZPos = Math.min(1, Math.max(-1, camera.position.y));
  camera.position.set(camera.position.x, camZPos, camera.position.z);

  // Update all mixers
  const delta = clock.getDelta(); // use deltaTime for smoother animation
  mixers.forEach(m => {
    if (m.getRoot().name.startsWith("Scene")) {
      m.update(delta / 2.0);
    }
    if (m.getRoot().name === active_object && !active_object.includes("Ceramic")) {
      m.update(delta);
    }
  });

  // Not ideal but works for now
  oneShootAnimation(delta)

  // Update Grain Pass
  grainPass.material.uniforms['time'].value += 0.001; 
  composer.render();
  // renderer.render(scene, camera);

  // Update camera position
  if (isLerping) {
    let elapsedTime = clock.getElapsedTime() - lerpStartTime;
    let lerpValue = elapsedTime / lerpDuration;
    lerpValue = lerpValue < 1 ? 3 * lerpValue ** 2 - 2 * lerpValue ** 3 : 1; // Bezier easing
    let t = Math.min(lerpValue, 1); // Clamp t between 0 and 1

    camera.position.lerpVectors(lerpStartPosition, lerpEndPosition, t);
    controls.target.lerpVectors(lerpStartTarget, lerpEndTarget, t);

    if (t === 1) {
      isLerping = false; // Stop lerping when done
    }
  }
  requestAnimationFrame(animate);
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

  // If there are no intersections, return
  if (intersects.length === 0) return;


  let firstObjectName = intersects[0].object.name;
  console.log(firstObjectName);
  if (firstObjectName != "Winnowing_Basket_LP" && firstObjectName != "Ox_Thing" && !firstObjectName.includes("Brana") && !firstObjectName.includes("Ceramic") && firstObjectName != "NavigationSphere") {
    return;
  }

  if (firstObjectName.includes("Ceramic")) {
    active_object = firstObjectName.split("_")[0];
    oneShootCheck = true;
    oneShootObjects.push(active_object);
    oneShootStartTime.push(clock.getElapsedTime());
  }

  else {
    active_object = intersects[0].object.name;

    // Update the "object-name-display" element in the HTML
    const objectNameDisplay = document.getElementById("object-name-display");
    if (objectNameDisplay) {
      objectNameDisplay.textContent = active_object;
    }
  }
  
  // Get the position of the intersected object
  let intersectedObject = intersects[0].object;
  let newTargetPosition = intersectedObject.getWorldPosition(new THREE.Vector3());

  newTargetPosition.x = Math.round(newTargetPosition.x, 1.0);
  newTargetPosition.y = 0;
  newTargetPosition.z = Math.round(newTargetPosition.z, 1.0);

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
function loadModel(path, name = "", position = new THREE.Vector3(), onLoad = () => {}) {
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
      mixer.getRoot().name = name;
      mixers.push(mixer);
    }

    onLoad(model);
  });
}

// Function to load models
function modelGridArray(path, position = new THREE.Vector3(0, 0, 0), offset = new THREE.Vector3(), copies = new THREE.Vector3(), jitter = new THREE.Vector3(0, 0, 0), center = true, rotate = false, onLoad = () => {}) {

  loader.load(path, (gltf) => {
    const model = gltf.scene;

    // Cast and recieve shadows
    model.castShadow = true;
    model.receiveShadow = true;

    var positions = [];

    if (center) {
      position.x -= (copies.x - 1) * offset.x / 2;
      position.y -= (copies.y - 1) * offset.y / 2;
      position.z -= (copies.z - 1) * offset.z / 2;
    }

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

      if (rotate) { 
        let rotation = new THREE.Euler(0, 0, 0);
        rotation.y = Math.floor(Math.random() * 4) * Math.PI;
        clone.rotation.copy(rotation);
      }

      clone.position.copy(pos);

      // Add animation to clones
      const animationMixer = new THREE.AnimationMixer(clone);
      if (gltf.animations.length > 0) {
        gltf.animations.forEach(clip => animationMixer.clipAction(clip).play());
      }
      mixers.push(animationMixer);
      scene.add(clone);
    });

    onLoad(model);
  });
}

function resetInteractionTimer() {
  // Reset the last interaction time
  lastInteractionTime = Date.now();
  interactionDetected = true;
  // Disable auto-rotation
  controls.autoRotate = false;
}

function checkUserInactivity() {
  const currentTime = Date.now();
  const inactivityDuration = (currentTime - lastInteractionTime) / 1000; // in seconds

  if (inactivityDuration > 5 && interactionDetected) {
    // Start lerping to start
    lerpStartTime = clock.getElapsedTime();
    isLerping = true;

    // Reset the camera
    lerpStartPosition.copy(camera.position);
    lerpEndPosition.set(1, 0.5, 1)

    lerpStartTarget.copy(controls.target);
    lerpEndTarget.set(0, 0, 0);
    interactionDetected = false;

    // Update the text to prompt the user to interact
    const objectNameDisplay = document.getElementById("object-name-display");
    objectNameDisplay.textContent = "Try clicking on objects to interact!";

    // Enable auto-rotation
    controls.autoRotate = true;
    controls.autoRotateSpeed = -1.0;
  }
}

function navigationSpheres (startPos = new THREE.Vector3(0, -1.5, 0), offset = new THREE.Vector3(3, 0, 3), copies = new THREE.Vector3(3, 1, 3))  {
  const numCopies = copies.x * copies.z;
  
  startPos.x -= (copies.x - 1) * offset.x / 2;
  startPos.y -= (copies.y - 1) * offset.y / 2;
  startPos.z -= (copies.z - 1) * offset.z / 2;

  for (let i = 0; i < numCopies; i++) {
    const x = (i % copies.x) * offset.x;
    const y = Math.floor(i / copies.x) % copies.y * offset.y;
    const z = Math.floor(i / (copies.x * copies.y)) * offset.z;

    const newPos = startPos.clone().add(new THREE.Vector3(x, y, z));

    const sphereGeometry = new THREE.SphereGeometry(0.5, 32, 32);
    const sphereMaterial = new THREE.MeshPhongMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0
    });
    const NavigationSphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    NavigationSphere.position.copy(newPos);
    NavigationSphere.name = "NavigationSphere";
    scene.add(NavigationSphere);
  }
}