// Import Three.js components and OrbitControls
import * as THREE from 'https://unpkg.com/three@0.128.0/build/three.module.js';
import { ARButton } from 'https://unpkg.com/three@0.128.0/examples/jsm/webxr/ARButton.js';
import { OrbitControls } from 'https://unpkg.com/three@0.128.0/examples/jsm/controls/OrbitControls.js';

document.addEventListener('DOMContentLoaded', () => {
    const startButton = document.getElementById('start-button');
    const overlay = document.getElementById('instruction-overlay');
    const container = document.getElementById('container');

    let camera, scene, renderer, controls;
    let reticle, solarSystemGroup;
    let hitTestSource = null;
    let hitTestSourceRequested = false;
    const textureLoader = new THREE.TextureLoader();
    
    // --- 1. Solar System Configuration (Planet Scale and Speed) ---
    const planetConfig = [
        // Name, Radius (Scaled), Distance (Scaled), Texture File, Orbital Speed
        { name: 'Sun', radius: 0.5, distance: 0, texture: 'sun.jpg', speed: 0 },
        { name: 'Mercury', radius: 0.05, distance: 1.0, texture: 'mercury.jpg', speed: 0.02 },
        { name: 'Venus', radius: 0.08, distance: 1.5, texture: 'venus.jpg', speed: 0.015 },
        { name: 'Earth', radius: 0.09, distance: 2.0, texture: 'earth.jpg', speed: 0.01 },
        { name: 'Mars', radius: 0.06, distance: 2.5, texture: 'mars.jpg', speed: 0.008 },
        { name: 'Jupiter', radius: 0.20, distance: 3.5, texture: 'jupiter.jpg', speed: 0.005 },
        { name: 'Saturn', radius: 0.18, distance: 4.5, texture: 'saturn.jpg', speed: 0.004 },
        { name: 'Uranus', radius: 0.12, distance: 5.5, texture: 'uranus.jpg', speed: 0.003 },
        { name: 'Neptune', radius: 0.11, distance: 6.5, texture: 'neptune.jpg', speed: 0.002 }
    ];
    let planets = []; 

    // --- 2. Build the 3D Solar System Model with Textures ---
    function createSolarSystem() {
        solarSystemGroup = new THREE.Group();
        
        // Load the background star texture
        textureLoader.load('./assets/textures/stars.jpg', (starsTexture) => {
            const starGeometry = new THREE.SphereGeometry(100, 32, 32); // Huge sphere
            const starMaterial = new THREE.MeshBasicMaterial({
                map: starsTexture,
                side: THREE.BackSide // Render inside the sphere
            });
            const starMesh = new THREE.Mesh(starGeometry, starMaterial);
            scene.add(starMesh);
        });

        planetConfig.forEach(config => {
            // Load the planet texture
            const texture = textureLoader.load(`./assets/textures/${config.texture}`);
            const geometry = new THREE.SphereGeometry(config.radius, 64, 64);
            
            let material;
            
            if (config.name === 'Sun') {
                // Sun uses BasicMaterial with a yellow light source inside
                material = new THREE.MeshBasicMaterial({ map: texture });
                
                // Add a bright point light to simulate the sun's glow
                const sunLight = new THREE.PointLight(0xffffff, 5, 100);
                sunLight.position.set(0, 0, 0); 
                solarSystemGroup.add(sunLight);
                
            } else {
                // Planets use StandardMaterial to interact with the light source (the Sun)
                material = new THREE.MeshStandardMaterial({
                    map: texture,
                    metalness: 0.1, // Slight shine
                    roughness: 0.8  // Not too glossy
                });
            }

            const mesh = new THREE.Mesh(geometry, material);
            mesh.userData = { 
                name: config.name, 
                distance: config.distance, 
                speed: config.speed,
                angle: Math.random() * Math.PI * 2
            };
            
            if (config.name !== 'Sun') {
                // Pivot group for orbit
                const pivot = new THREE.Group();
                pivot.add(mesh);
                mesh.position.x = config.distance; 
                solarSystemGroup.add(pivot);
                planets.push(pivot); 
            } else {
                solarSystemGroup.add(mesh); 
            }
        });
    }

    // --- 3. Initialize the Standard 3D Scene (Desktop/Non-AR View) ---
    function init3D() {
        // Show the 3D container
        container.style.visibility = 'visible'; 
        
        scene = new THREE.Scene();
        
        // Renderer Setup
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

        // Camera Setup
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.set(0, 5, 10); // Start position looking down at the system
        
        // Add Ambient Light (to see the non-Sun side of planets slightly)
        scene.add(new THREE.AmbientLight(0x404040, 0.5));

        // OrbitControls for interaction (Zoom, Pan, Rotate)
        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; // Smooth movement
        controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false;
        controls.minDistance = 2;
        controls.maxDistance = 30;
        
        createSolarSystem(); // Build models and load textures
        
        renderer.setAnimationLoop(animate);
    }
    
    // --- 4. Animation Loop for Desktop/3D View ---
    function animate() {
        controls.update(); // Update controls for smooth movement
        
        // Animate Orbits and Rotations
        planets.forEach(pivot => {
            const mesh = pivot.children[0];
            const userData = mesh.userData;
            
            // 1. Orbit: Rotate the pivot group
            pivot.rotation.y += userData.speed; 
            
            // 2. Axial Rotation: Rotate the planet itself
            mesh.rotation.y += userData.speed * 2; 
        });

        renderer.render(scene, camera);
    }

    // --- 5. Initialize the AR Scene (Called AFTER permissions are handled) ---
    function initAR() {
        // Clean up 3D view controls and setup
        if (controls) controls.dispose();
        if (renderer.domElement) container.removeChild(renderer.domElement);
        renderer.setAnimationLoop(null); 

        // Scene and Renderer Setup for AR
        scene = new THREE.Scene();
        renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true
        });
        renderer.setPixelRatio(window.devicePixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.xr.enabled = true; 
        container.appendChild(renderer.domElement);

        // Camera (controlled by WebXR)
        camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 20);

        // Re-add Ambient Light and Solar System Group
        scene.add(new THREE.HemisphereLight(0x606060, 0x404040, 3));
        createSolarSystem(); // Rebuilds the system into the new scene
        
        // Add the AR Button
        const arButton = ARButton.createButton(renderer, { 
            requiredFeatures: ['hit-test']
        });
        container.appendChild(arButton);
        
        // Create Reticle for placement
        const reticleGeometry = new THREE.RingGeometry(0.15, 0.2, 32).rotateX(- Math.PI / 2);
        const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
        reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
        reticle.matrixAutoUpdate = false;
        reticle.visible = false;
        scene.add(reticle);

        renderer.setAnimationLoop(renderAR);
    }

    // --- 6. AR Render Loop (Overrides animate() when AR is active) ---
    function renderAR(timestamp, frame) {
        if (frame) {
            const referenceSpace = renderer.xr.getReferenceSpace();
            const session = renderer.xr.getSession();

            if (session && !hitTestSourceRequested) {
                session.requestReferenceSpace('viewer').then((viewerSpace) => {
                    session.requestHitTestSource({ space: viewerSpace }).then((source) => {
                        hitTestSource = source;
                    });
                });
                session.addEventListener('end', () => { hitTestSourceRequested = false; hitTestSource = null; });
                hitTestSourceRequested = true;
            }

            if (hitTestSource) {
                const hitTestResults = frame.getHitTestResults(hitTestSource);

                if (hitTestResults.length) {
                    const hit = hitTestResults[0];
                    const pose = hit.getPose(referenceSpace); 
                    
                    reticle.visible = true;
                    reticle.matrix.fromArray(pose.transform.matrix);
                    
                    session.addEventListener('select', onSelect, { once: true });
                } else {
                    reticle.visible = false;
                }
            }
        }
        
        // Animate Orbits in AR view
        planets.forEach(pivot => {
            const mesh = pivot.children[0];
            const userData = mesh.userData;
            pivot.rotation.y += userData.speed; 
            mesh.rotation.y += userData.speed * 2; 
        });

        renderer.render(scene, camera);
    }

    // --- 7. Placement Logic (Tap to place model in AR) ---
    function onSelect() {
        if (reticle.visible) {
            solarSystemGroup.position.setFromMatrixPosition(reticle.matrix);
            // Scale down the system for a realistic AR placement size
            solarSystemGroup.scale.set(0.3, 0.3, 0.3); 
            scene.add(solarSystemGroup);
            reticle.visible = false;
        }
    }

    // --- 8. Handle Instruction Screen Click ---
    startButton.addEventListener('click', () => {
        // The AR Button will handle the session start, but we use this to check support
        if (navigator.xr && navigator.xr.isSessionSupported('immersive-ar')) {
             // Start AR initialization. The user will then click the AR button in the corner.
            overlay.classList.add('hidden');
            initAR();
        } else {
            // Fallback to pure 3D view if AR is not supported
            alert('WebXR Augmented Reality not supported. Falling back to interactive 3D view.');
            overlay.classList.add('hidden');
            init3D();
        }
    });

    // --- 9. Initial Load (Start in 3D mode first) ---
    // If the user is on a desktop, or if AR is unavailable, the 3D mode gives them something to interact with.
    init3D();

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
