// webgpu_materials_basic — adapted for three.zig runtime
// Original: three.js examples/webgpu_materials_basic.html

import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

var camera, scene, renderer;
var spheres = [];
var mouseX = 0, mouseY = 0;
var windowHalfX, windowHalfY;
var lastLog = 0;

function init() {
  windowHalfX = window.innerWidth / 2;
  windowHalfY = window.innerHeight / 2;

  document.addEventListener('mousemove', function(e) {
    mouseX = (e.clientX - windowHalfX) / 100;
    mouseY = (e.clientY - windowHalfY) / 100;
  });

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.01, 100);
  camera.position.z = 3;

  var path = 'examples/webgpu_materials_basic/assets/textures/cube/pisa/';
  var format = '.png';
  var urls = [
    path + 'px' + format, path + 'nx' + format,
    path + 'py' + format, path + 'ny' + format,
    path + 'pz' + format, path + 'nz' + format
  ];

  var textureCube = new THREE.CubeTextureLoader().load(urls);

  scene = new THREE.Scene();
  scene.background = textureCube;

  var geometry = new THREE.SphereGeometry(0.1, 32, 16);
  var material = new THREE.MeshBasicMaterial({ color: 0xffffff, envMap: textureCube });

  for (var i = 0; i < 500; i++) {
    var mesh = new THREE.Mesh(geometry, material);
    mesh.position.x = Math.random() * 10 - 5;
    mesh.position.y = Math.random() * 10 - 5;
    mesh.position.z = Math.random() * 10 - 5;
    mesh.scale.x = mesh.scale.y = mesh.scale.z = Math.random() * 3 + 1;
    scene.add(mesh);
    spheres.push(mesh);
  }

  renderer = new WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  window.addEventListener('resize', function() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

async function start() {
  init();
  await renderer.init();
  renderer.setAnimationLoop(animate);
  console.log('Basic Material example started');
}
start();

function animate() {
  if (spheres.length > 0 && Date.now() - lastLog > 1000) {
    console.log('frame, spheres:', spheres.length, 'renderer:', !!renderer);
    lastLog = Date.now();
  }
  var timer = 0.0001 * Date.now();
  camera.position.x += (mouseX - camera.position.x) * 0.05;
  camera.position.y += (-mouseY - camera.position.y) * 0.05;
  camera.lookAt(scene.position);

  for (var i = 0; i < spheres.length; i++) {
    var sphere = spheres[i];
    sphere.position.x = 5 * Math.cos(timer + i);
    sphere.position.y = 5 * Math.sin(timer + i * 1.1);
  }

  renderer.render(scene, camera);
}