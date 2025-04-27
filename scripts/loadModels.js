"use strict";
import * as THREE from '../three/build/three.module.js';
import { GLTFLoader } from '../three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const mixers = [];

// Function to load models
export function loadModel(scene, path, name = "", position = new THREE.Vector3(), onLoad = () => {}) {
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
      console.log(mixer.getRoot().name);
      mixers.push(mixer);
    }

    onLoad(model);
  });
}
  
// Function to load models
export function modelGridArray(scene, path, position = new THREE.Vector3(0, 0, 0), offset = new THREE.Vector3(), copies = new THREE.Vector3(), jitter = new THREE.Vector3(0, 0, 0), center = true, onLoad = () => {}) {

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

      let rotation = new THREE.Euler(0, 0, 0);
      rotation.y = Math.floor(Math.random() * 4) * Math.PI;
      clone.rotation.copy(rotation);

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