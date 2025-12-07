// Import Three.js components using ES modules for easy setup
import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.128.0/examples/jsm/webxr/ARButton.js';

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const overlay = document.getElementById('instruction-overlay');
    const container = document.getElementById('container');

    let camera, scene, renderer;
    let reticle, solarSystemGroup;
    
    // Variables for AR session management
    let hitTestSource = null;
    let hitTestSourceRequested = false;

    // --- 1. Solar System Configuration ---
    // A simplified config for initial setup (radius in arbitrary units, color)
    const planetConfig = [
        // Name, Radius (size), Distance (for visual spacing), Color
        { name: 'Sun', radius: 0.25, distance: 0, color: 0xFFFF00, speed: 0 },
        { name: 'Mercury', radius: 0.03, distance: 0.4, color: 0xAAAAAA, speed: 0.02 },
        { name: 'Venus', radius: 0.05, distance: 0.6, color: 0xDD9900, speed: 0.015 },
        { name: 'Earth', radius: 0.05, distance: 0.8, color: 0x0000FF, speed: 0.01 },
        { name: 'Mars', radius: 0.04, distance: 1.0, color: 0xFF4400, speed: 0.008 }
    ];
    let planets = []; // Array to hold the planetary meshes

    // --- 2. Build the 3D Solar System Model ---
    function createSolarSystem() {
        solarSystemGroup = new THREE.Group();
        
        planetConfig.forEach(config => {
            const geometry = new THREE.SphereGeometry(config.radius, 32, 32);
            
            // Sun is MeshBasicMaterial (it provides its own light)
            // Planets are MeshStandardMaterial (they reflect light)
            let material;
            if (config.name === 'Sun') {
                 material = new THREE.MeshBasicMaterial({ color: config.color });
            } else {
                 material = new THREE.MeshStandardMaterial({ color: config.color });
            }

            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData = { 
                name: config.name, 
                distance: config.distance, 
                speed: config.speed,
                angle: Math.random() * Math.PI * 2 // Start at a random point in orbit
            };
            
            // For planets, create a pivot group at the center (0,0,0)
            if (config.name !== 'Sun') {
                const pivot = new THREE.Group();
                pivot.add(mesh);
                mesh.position.x = config.distance; // Place the planet on the x-axis
                solarSystemGroup.add(pivot);
                planets.push(pivot); // Track the pivot for rotation
            } else {
                solarSystemGroup.add(mesh); // Sun is at the center
            }
        });

        // Add a point light at the Sun's position for the planets
        const pointLight = new THREE.PointLight(0xffffff, 5, 100);
        pointLight.position.set(0, 0, 0); // At the center of the solar system
        solarSystemGroup.add(pointLight);
    }
    
    // --- 3. Function to Initialize the AR Scene ---
    function initAR() {
        createSolarSystem(); // Build the 3D models

        // Scene Setup
        scene = new THREE.Scene();
        scene.add(new THREE.HemisphereLight(0x606060, 0x404040, 3)); // Ambient light

        // Renderer Setup
        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true; // Enable the XR module
        container.appendChild(renderer.domElement);

        // Camera (WebXR controls this)
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        // Add the AR Button (This handles the session start and camera permission)
        const arButton = ARButton.createButton(renderer, { 
            requiredFeatures: ['hit-test']
        });
        container.appendChild(arButton);
        
        // Create Reticle (A ring to show where the object will be placed)
        const reticleGeometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(- Math.PI / 2);
        const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
        reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        // Start the continuous animation loop controlled by WebXR
        renderer.setAnimationLoop(render);
    }
    
    // --- 4. The AR Render Loop ---
    function render(timestamp, frame) {
        if (frame) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            const session = renderer.xr.getSession();

            // Hit-test Request (only requested once)
            if (session && !hitTestSourceRequested) {
                session.requestReferenceSpace('viewer').then((viewerSpace) => {
                    session.requestHitTestSource({ space: viewerSpace }).then((source) => {
                        hitTestSource = source;
                    });
                });
                session.addEventListener('end', () => { hitTestSourceRequested = false; hitTestSource = null; });
                hitTestSourceRequested = true;
            }

            // Perform Hit-test
            if (hitTestSource) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                if (hitTestResults.length) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(referenceSpace); 
                    
                    // Update reticle position and make it visible
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                    
                    // Add listener to place the model on tap/select
                    session.addEventListener('select', onSelect, { once: true });

                } else {
                    reticle.visible = false;
                }
            }
        }
        
        // --- Animate Orbits ---
        if (solarSystemGroup && scene.children.includes(solarSystemGroup)) {
            planets.forEach(pivot => {
                const userData = pivot.children[0].userData;
                pivot.rotation.y += userData.speed; // Rotate the pivot
            });
            // Rotate the entire solar system for a nice effect
            solarSystemGroup.rotation.y += 0.001; 
        }

        renderer.render(scene, camera);
    }

    // --- 5. Placement Logic (Called when the user taps the screen) ---
    function onSelect() {
        if (reticle.visible) {
            // Place the Solar System Group where the reticle is
            solarSystemGroup.position.setFromMatrixPosition(reticle.matrix);
            scene.add(solarSystemGroup);
            
            // Hide the reticle permanently after placement
            reticle.visible = false;
        }
    }

    // --- 6. Handle Instruction Screen Click ---
    startButton.addEventListener('click', () => {
        // Check for WebXR support before proceeding
        if (navigator.xr && navigator.xr.isSessionSupported('immersive-ar')) {
             // Hide the instruction overlay
            overlay.classList.add('hidden');
            // Initialize the AR scene (The ARButton will then prompt the user)
            initAR();
        } else {
            alert('Your browser or device does not support WebXR Augmented Reality. Please try a modern mobile browser (Chrome/Safari) on an AR-enabled phone.');
        }
    });

    // Handle resizing
    window.addEventListener('resize', () => {
        if (camera) {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
        }
        if (renderer) {
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    });
});