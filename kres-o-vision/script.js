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

// Vignette
import { ACESShader } from './shaders/ACESShader.js';

let scene, camera, renderer, controls, composer, bokehPass, bloomPass, chromaticAberrationPass, grainPass;

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

  // Tonemapping in renderer
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  // Shadows
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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

  // Lighting setup
  /*
  const light = new THREE.DirectionalLight(0xffffff, 10.0);
  light.position.set(0, 10, 0);
  light.target.position.set(-5, 0, 0);
  scene.add(light);
  scene.add(light.target);
  */

  // Load HDRI as environment map
  const pmremGenerator = new PMREMGenerator(renderer);
  new RGBELoader()
    .setDataType(THREE.FloatType)
    .setPath('hdri/')
    .load('forest_2.0.hdr', (hdrTexture) => {
      const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
      scene.environment = envMap;
      hdrTexture.dispose();
      pmremGenerator.dispose();
    });

  // Load 3D model (GLTF)
  loadModel('winnowing_basket_sim.glb', new THREE.Vector3(0, 0, 0));
  
  // DOF
  /*
  bokehPass = new BokehPass(scene, camera, {
    focus: 1.0,
    aperture: 0.01,
    maxblur: 0.01,
    width: window.innerWidth,
    height: window.innerHeight
  });
  composer.addPass(bokehPass);
  */

  // Bloom effect (UnrealBloomPass)
  const bloomStrength = 1.5; 
  const bloomRadius = 1;  
  const bloomThreshold = 10.0; 
  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    bloomStrength,
    bloomRadius,
    bloomThreshold
  );
  composer.addPass(bloomPass);

  /*
  // FXAA
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.material.uniforms['resolution'].value.set(1 / window.innerWidth, 1 / window.innerHeight); 
  composer.addPass(fxaaPass);
  */

  // Chromatic Aberration
  chromaticAberrationPass = new ShaderPass(ChromaticAberrationShader);
  chromaticAberrationPass.material.uniforms['aberrationIntensity'].value = 0.02; 
  composer.addPass(chromaticAberrationPass);

  // Create grain pass and set uniforms
  grainPass = new ShaderPass(GrainShader);
  grainPass.material.uniforms['grainIntensity'].value = 0.02;
  grainPass.material.uniforms['grainSize'].value = 5.0;
  composer.addPass(grainPass);
  
  // Vignette effect setup
  const vignettePass = new ShaderPass(VignetteShader);
  vignettePass.material.uniforms['offset'].value = 1.2;  
  vignettePass.material.uniforms['darkness'].value = 1.0;
  composer.addPass(vignettePass);

  // ACES Tonemapping
  const ACESPass = new ShaderPass(ACESShader);
  ACESPass.material.uniforms['ACESBL_Gamma'].value = 2.2;
  ACESPass.material.uniforms['toneMappingExposure'].value = 1.0;
  composer.addPass(ACESPass);

  // Listen for mouse clicks
  document.addEventListener('click', onMouseClick, false);
  
  // Resize event listener
  window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();

  // Update all mixers
  const delta = clock.getDelta(); // use deltaTime for smoother animation
  mixers.forEach(m => m.update(delta));

  // Update Grain Pass
  grainPass.material.uniforms['time'].value += 0.05; 
  composer.render();
}

// Focus on click
function onMouseClick(event) {
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

  if (intersects.length > 0) {
    // Get the position of the first intersected object
    let intersectedObject = intersects[0].object;
    let targetPosition = intersectedObject.getWorldPosition(new THREE.Vector3());

    // Calculate the distance between the camera and the clicked point
    let distance = camera.position.distanceTo(targetPosition);

    // Log the new focus value
    console.log("New Focus Distance: ", distance);

    // Update the focus of the BokehPass
    bokehPass.focus = distance;

    // Force the BokehPass to update
    bokehPass.uniforms["focus"].value = distance; // Ensure the uniform is updated directly

    // Trigger a composer render to refresh the post-processing with updated parameters
    composer.render();
  }
}

// Function to load models
function loadModel(path, position = new THREE.Vector3(), onLoad = () => {}) {
  loader.load(path, (gltf) => {
    const model = gltf.scene;
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