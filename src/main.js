import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { OutlineEffect } from 'three/examples/jsm/effects/OutlineEffect';

class MrBeanGame {
    constructor() {
        // Make sure DOM is loaded before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        try {
            // Create scene with fog for depth
            this.scene = new THREE.Scene();
            this.scene.background = new THREE.Color(0x87CEEB); // Light blue sky
            this.scene.fog = new THREE.FogExp2(0x87CEEB, 0.012); // Reduced fog density

            // Create camera with position behind Mr. Bean
            this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
            
            // Initialize camera settings first
            this.thirdPersonCameraOffset = new THREE.Vector3(0, 3, -6);
            this.firstPersonCameraOffset = new THREE.Vector3(0, 1.7, 0.3); // Eye level
            this.cameraOffset = this.thirdPersonCameraOffset.clone();
            this.smoothFactor = 0.15; // Camera smoothing factor
            
            // Set initial camera position
            this.camera.position.set(-38, 3, -34);
            this.camera.lookAt(-38, 1.5, -28);

            // Create frustum for culling
            this.frustum = new THREE.Frustum();
            this.cameraViewProjectionMatrix = new THREE.Matrix4();
            
            // Performance optimization: Reduce shadow map size but keep quality
            this.renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                powerPreference: "high-performance",
                precision: "mediump"
            });
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            
            // Optimize shadow settings
            const shadowMapSize = 1024;
            this.renderer.shadowMap.autoUpdate = false;
            this.renderer.shadowMap.needsUpdate = true;

            // Add outline effect for cartoon style
            this.outlineEffect = new OutlineEffect(this.renderer, {
                defaultThickness: 0.008,
                defaultColor: [0, 0, 0],
                defaultAlpha: 1,
                defaultKeepAlive: true
            });
            
            // Get the container element
            const container = document.getElementById('game-container');
            if (!container) {
                throw new Error('Game container not found!');
            }
            container.appendChild(this.renderer.domElement);

            // Initialize game state with improved movement values
            this.moveSpeed = 0.25;
            this.turnSpeed = 0.045;
            this.playerVelocity = new THREE.Vector3();
            this.playerDirection = new THREE.Vector3();

            // Create textures
            this.createTextures();

            // Initialize audio-related properties first
            this.soundEffectsEnabled = false;
            this.soundEffects = {
                footsteps: null,
                doorOpen: null,
                interact: null
            };
            
            // Initialize game components
            this.setupLights();
            this.createGround();
            this.createCity();
            this.setupPlayer();
            this.setupNPCs();
            this.setupInteraction();
            this.setupAudio(); // Move audio setup after other components

            // Handle window resize
            window.addEventListener('resize', () => this.onWindowResize(), false);

            // Performance optimization: Object pooling for particles and effects
            this.objectPool = new Map();
            
            // Initialize challenge system
            this.initializeChallenges();

            // Start animation loop with optimized timing
            this.lastTime = performance.now();
            this.frameCount = 0;
            this.animate();

            // Hide loading screen
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }

            // Add camera mode tracking
            this.isFirstPerson = false;
            this.cameraOffset = this.thirdPersonCameraOffset.clone();
        } catch (error) {
            console.error('Error initializing game:', error);
            const container = document.getElementById('game-container');
            if (container) {
                container.innerHTML = '<div style="color: white; padding: 20px;">Error loading game. Please check console for details.</div>';
            }
        }
    }

    initializeChallenges() {
        this.challenges = [
            {
                id: 1,
                title: "Find Teddy",
                description: "Your beloved Teddy has gone missing! Mrs. Wicket might have seen it last.",
                completed: false,
                steps: [
                    { text: "Talk to Mrs. Wicket about Teddy", completed: false },
                    { text: "Search the park benches", completed: false },
                    { text: "Check the department store", completed: false }
                ],
                reward: "You found Teddy! He's happy to be back with you."
            },
            {
                id: 2,
                title: "Late for Appointment",
                description: "You're late for your dentist appointment! But your car won't start...",
                completed: false,
                steps: [
                    { text: "Check your broken car", completed: false },
                    { text: "Find Rupert and ask for help", completed: false },
                    { text: "Get to the city center clinic", completed: false }
                ],
                reward: "You made it to the dentist! Only 30 minutes late..."
            },
            {
                id: 3,
                title: "Christmas Shopping",
                description: "You need to buy a Christmas present for Irma, but you're on a budget!",
                completed: false,
                steps: [
                    { text: "Talk to Irma about her interests", completed: false },
                    { text: "Visit the department store for sales", completed: false },
                    { text: "Find the perfect gift", completed: false }
                ],
                reward: "You found a lovely gift that Irma will surely appreciate!"
            }
        ];

        this.activeChallenge = null;
        this.createChallengeUI();
    }

    createChallengeUI() {
        // Create challenge menu
        const challengeMenu = document.createElement('div');
        challengeMenu.style.position = 'fixed';
        challengeMenu.style.top = '10px';
        challengeMenu.style.left = '10px';
        challengeMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        challengeMenu.style.padding = '15px';
        challengeMenu.style.borderRadius = '10px';
        challengeMenu.style.color = 'white';
        challengeMenu.style.fontFamily = 'Arial, sans-serif';
        challengeMenu.style.zIndex = '1000';
        challengeMenu.style.maxWidth = '300px';

        // Add challenge title
        const title = document.createElement('h3');
        title.textContent = 'Mr. Bean\'s Tasks';
        title.style.margin = '0 0 10px 0';
        title.style.color = '#4CAF50';
        challengeMenu.appendChild(title);

        // Create challenge list
        const challengeList = document.createElement('div');
        this.challenges.forEach(challenge => {
            const challengeItem = document.createElement('div');
            challengeItem.className = 'challenge-item';
            challengeItem.dataset.challengeId = challenge.id;
            challengeItem.style.marginBottom = '10px';
            challengeItem.style.cursor = 'pointer';
            challengeItem.style.padding = '5px';
            challengeItem.style.borderRadius = '5px';
            challengeItem.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';

            const challengeTitle = document.createElement('div');
            challengeTitle.textContent = challenge.title;
            challengeTitle.style.fontWeight = 'bold';
            challengeItem.appendChild(challengeTitle);

            const challengeDesc = document.createElement('div');
            challengeDesc.textContent = challenge.description;
            challengeDesc.style.fontSize = '0.9em';
            challengeDesc.style.marginTop = '5px';
            challengeItem.appendChild(challengeDesc);

            if (challenge.completed) {
                challengeItem.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
                challengeItem.style.textDecoration = 'line-through';
            }

            challengeItem.onclick = () => this.startChallenge(challenge.id);

            challengeList.appendChild(challengeItem);
        });
        challengeMenu.appendChild(challengeList);

        // Add to document
        document.body.appendChild(challengeMenu);
        this.challengeMenu = challengeMenu;

        // Create active challenge display
        this.createActiveChallengeDisplay();
    }

    createActiveChallengeDisplay() {
        const display = document.createElement('div');
        display.style.position = 'fixed';
        display.style.top = '200px';
        display.style.left = '10px';
        display.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        display.style.padding = '15px';
        display.style.borderRadius = '10px';
        display.style.color = 'white';
        display.style.fontFamily = 'Arial, sans-serif';
        display.style.zIndex = '1000';
        display.style.maxWidth = '300px';
        display.style.display = 'none';

        this.activeChallengeDisplay = display;
        document.body.appendChild(display);
    }

    startChallenge(challengeId) {
        const challenge = this.challenges.find(c => c.id === challengeId);
        if (challenge && !challenge.completed) {
            // Reset progress if starting a new challenge
            if (this.activeChallenge && this.activeChallenge.id !== challengeId) {
                this.activeChallenge.steps.forEach(step => step.completed = false);
            }
            
            this.activeChallenge = challenge;
            this.updateActiveChallengeDisplay();
            
            // Show challenge start message
            this.showDialog({
                userData: {
                    name: "New Challenge",
                    dialogs: [challenge.description]
                }
            });

            // Play interaction sound
            if (this.soundEffectsEnabled && this.soundEffects && this.soundEffects.interact) {
                this.soundEffects.interact.play();
            }
        } else if (challenge && challenge.completed) {
            this.showDialog({
                userData: {
                    name: "Challenge Complete",
                    dialogs: ["You've already completed this challenge!"]
                }
            });
        }
    }

    updateActiveChallengeDisplay() {
        if (!this.activeChallenge) {
            this.activeChallengeDisplay.style.display = 'none';
            return;
        }

        this.activeChallengeDisplay.style.display = 'block';
        this.activeChallengeDisplay.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #4CAF50;">${this.activeChallenge.title}</h3>
            <div style="margin-bottom: 10px;">${this.activeChallenge.description}</div>
            <div style="font-weight: bold; margin-bottom: 5px;">Progress:</div>
            ${this.activeChallenge.steps.map(step => `
                <div style="margin-bottom: 5px;">
                    <span style="color: ${step.completed ? '#4CAF50' : '#FFF'}">
                        ${step.completed ? '✓' : '○'} ${step.text}
                    </span>
                </div>
            `).join('')}
        `;
    }

    updateChallengeProgress(stepIndex) {
        if (this.activeChallenge && !this.activeChallenge.steps[stepIndex].completed) {
            this.activeChallenge.steps[stepIndex].completed = true;
            this.updateActiveChallengeDisplay();

            // Check if all steps are completed
            if (this.activeChallenge.steps.every(step => step.completed)) {
                this.activeChallenge.completed = true;
                this.showDialog({
                    userData: {
                        name: "Challenge Complete!",
                        dialogs: ["Well done! You've completed the challenge!"]
                    }
                });
                this.activeChallenge = null;
                this.updateActiveChallengeDisplay();
            }

            // Play interaction sound
            if (this.soundEffectsEnabled && this.soundEffects && this.soundEffects.interact) {
                this.soundEffects.interact.play();
            }
        }
    }

    createTextures() {
        // Create a brick texture procedurally
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Fill background
        ctx.fillStyle = '#cc8866';
        ctx.fillRect(0, 0, 256, 256);

        // Draw bricks
        ctx.fillStyle = '#aa6644';
        for (let y = 0; y < 256; y += 32) {
            const offset = (y % 64) === 0 ? 0 : 32;
            for (let x = -32; x < 256; x += 64) {
                ctx.fillRect(x + offset, y, 60, 28);
            }
        }

        // Create mortar lines
        ctx.fillStyle = '#bbbbbb';
        for (let y = 0; y < 256; y += 32) {
            ctx.fillRect(0, y, 256, 2);
        }
        for (let x = 0; x < 256; x += 32) {
            ctx.fillRect(x, 0, 2, 256);
        }

        // Create the texture
        this.brickTexture = new THREE.CanvasTexture(canvas);
        this.brickTexture.wrapS = THREE.RepeatWrapping;
        this.brickTexture.wrapT = THREE.RepeatWrapping;
        this.brickTexture.repeat.set(2, 2);
    }

    setupLights() {
        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        // Main sun light with optimized shadows
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(50, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 1024; // Reduced from 2048
        sunLight.shadow.mapSize.height = 1024; // Reduced from 2048
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        this.scene.add(sunLight);

        // Optimize fill lights
        const fillLight1 = new THREE.DirectionalLight(0x9999ff, 0.2);
        fillLight1.position.set(-50, 20, -50);
        this.scene.add(fillLight1);

        const fillLight2 = new THREE.DirectionalLight(0xff9999, 0.2);
        fillLight2.position.set(50, 20, 50);
        this.scene.add(fillLight2);
    }

    createGround() {
        const groundGroup = new THREE.Group();
        
        // Create main road network
        this.createRoads(groundGroup);
        
        // Create sidewalks along roads
        this.createSidewalks(groundGroup);
        
        // Create grass ground instead of blue
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3b7d3b,  // Darker grass green
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        groundGroup.add(ground);

        // Add some grass texture variation
        for (let i = 0; i < 1000; i++) {
            const grassPatch = new THREE.Mesh(
                new THREE.PlaneGeometry(0.3, 0.3),
                new THREE.MeshStandardMaterial({ color: 0x4a9e4a })
            );
            grassPatch.rotation.x = -Math.PI / 2;
            grassPatch.position.set(
                (Math.random() - 0.5) * 190,
                0.01,
                (Math.random() - 0.5) * 190
            );
            groundGroup.add(grassPatch);
        }
        
        this.scene.add(groundGroup);
    }

    createRoads(groundGroup) {
        // Main road material
        const roadMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            roughness: 0.8,
            metalness: 0.1
        });

        // Create main roads
        const mainRoadGeometry = new THREE.PlaneGeometry(200, 10);
        const crossRoadGeometry = new THREE.PlaneGeometry(10, 200);

        // Horizontal roads
        [-30, 0, 30].forEach(z => {
            const road = new THREE.Mesh(mainRoadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(0, 0.01, z);
            groundGroup.add(road);
        });

        // Vertical roads
        [-30, 0, 30].forEach(x => {
            const road = new THREE.Mesh(crossRoadGeometry, roadMaterial);
            road.rotation.x = -Math.PI / 2;
            road.position.set(x, 0.01, 0);
            groundGroup.add(road);
        });

        // Add road markings
        this.createRoadMarkings(groundGroup);
    }

    createRoadMarkings(groundGroup) {
        const markingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFFFFF,
            roughness: 0.5
        });

        // Create dashed lines for road center
        const dashGeometry = new THREE.PlaneGeometry(1, 0.2);
        
        // Add dashed lines to horizontal roads
        [-30, 0, 30].forEach(z => {
            for (let x = -95; x < 95; x += 5) {
                const dash = new THREE.Mesh(dashGeometry, markingMaterial);
                dash.rotation.x = -Math.PI / 2;
                dash.position.set(x, 0.02, z);
                groundGroup.add(dash);
            }
        });

        // Add dashed lines to vertical roads
        [-30, 0, 30].forEach(x => {
            for (let z = -95; z < 95; z += 5) {
                const dash = new THREE.Mesh(dashGeometry, markingMaterial);
                dash.rotation.x = -Math.PI / 2;
                dash.rotation.y = Math.PI / 2;
                dash.position.set(x, 0.02, z);
                groundGroup.add(dash);
            }
        });
    }

    createSidewalks(groundGroup) {
        const sidewalkMaterial = new THREE.MeshStandardMaterial({
            color: 0x999999,
            roughness: 0.8
        });

        // Create sidewalks along roads
        [-35, -25, 25, 35].forEach(z => {
            const sidewalk = new THREE.Mesh(
                new THREE.PlaneGeometry(200, 4),
                sidewalkMaterial
            );
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.position.set(0, 0.05, z);
            groundGroup.add(sidewalk);
        });

        [-35, -25, 25, 35].forEach(x => {
            const sidewalk = new THREE.Mesh(
                new THREE.PlaneGeometry(4, 200),
                sidewalkMaterial
            );
            sidewalk.rotation.x = -Math.PI / 2;
            sidewalk.position.set(x, 0.05, 0);
            groundGroup.add(sidewalk);
        });
    }

    createCity() {
        // Create residential district - Arbour Road
        const arbourRoad = this.createArbourRoad();
        arbourRoad.position.set(-40, 0, -30);
        this.scene.add(arbourRoad);
        
        // Create department store (Havlotts)
        const departmentStore = this.createDepartmentStore();
        departmentStore.position.set(30, 0, -30);
        this.scene.add(departmentStore);
        
        // Create shop street with more cartoon-like shops
        const shopStreet = this.createShopStreet();
        shopStreet.position.set(30, 0, 0);
        this.scene.add(shopStreet);
        
        // Create central park with more cartoon elements
        const park = this.createPark();
        park.position.set(0, 0, 30);
        this.scene.add(park);

        // Add Mr. Bean's car (Mini)
        const beansCar = this.createCar();
        beansCar.position.set(-38, 0, -28);
        beansCar.rotation.y = Math.PI / 2;
        this.scene.add(beansCar);

        // Add more decorative elements
        this.addStreetLamps();
        this.addPhoneBoxes();
        this.addTrashBins();
        this.addParkedCars();
        this.addCartoonDetails();

        // Add stores with more cartoon-like appearance
        this.stores = [];
        
        // Create different types of stores with cartoon styling
        const storeConfigs = [
            { type: 'grocery', position: new THREE.Vector3(20, 0, -20) },
            { type: 'clothing', position: new THREE.Vector3(-20, 0, 20) },
            { type: 'electronics', position: new THREE.Vector3(20, 0, 20) }
        ];

        storeConfigs.forEach(config => {
            const store = this.createStore(config.type, config.position);
            this.stores.push(store);
            this.scene.add(store);
        });
    }

    addCartoonDetails() {
        // Add cartoon clouds
        for (let i = 0; i < 10; i++) {
            const cloud = this.createCartoonCloud();
            cloud.position.set(
                (Math.random() - 0.5) * 200,
                30 + Math.random() * 20,
                (Math.random() - 0.5) * 200
            );
            this.scene.add(cloud);
        }

        // Add cartoon birds
        for (let i = 0; i < 5; i++) {
            const bird = this.createCartoonBird();
            bird.position.set(
                (Math.random() - 0.5) * 100,
                20 + Math.random() * 10,
                (Math.random() - 0.5) * 100
            );
            this.scene.add(bird);
        }
    }

    createCartoonCloud() {
        const cloudGroup = new THREE.Group();
        
        // Create multiple spheres for a fluffy cloud
        const cloudMaterial = new THREE.MeshToonMaterial({ 
            color: 0xFFFFFF,
            gradientMap: this.createToonGradient()
        });

        for (let i = 0; i < 5; i++) {
            const size = 2 + Math.random() * 2;
            const cloudPart = new THREE.Mesh(
                new THREE.SphereGeometry(size, 8, 8),
                cloudMaterial
            );
            cloudPart.position.set(
                (Math.random() - 0.5) * 4,
                (Math.random() - 0.5) * 2,
                (Math.random() - 0.5) * 4
            );
            cloudGroup.add(cloudPart);
        }

        return cloudGroup;
    }

    createCartoonBird() {
        const birdGroup = new THREE.Group();
        
        // Bird body
        const bodyGeometry = new THREE.SphereGeometry(0.5, 8, 8);
        const bodyMaterial = new THREE.MeshToonMaterial({ 
            color: 0x000000,
            gradientMap: this.createToonGradient()
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        birdGroup.add(body);

        // Bird wings
        const wingGeometry = new THREE.BoxGeometry(1, 0.1, 0.5);
        const wingMaterial = new THREE.MeshToonMaterial({ 
            color: 0x000000,
            gradientMap: this.createToonGradient()
        });
        const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
        leftWing.position.set(-0.5, 0, 0);
        leftWing.rotation.y = Math.PI / 4;
        birdGroup.add(leftWing);

        const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
        rightWing.position.set(0.5, 0, 0);
        rightWing.rotation.y = -Math.PI / 4;
        birdGroup.add(rightWing);

        // Bird beak
        const beakGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
        const beakMaterial = new THREE.MeshToonMaterial({ 
            color: 0xFFA500,
            gradientMap: this.createToonGradient()
        });
        const beak = new THREE.Mesh(beakGeometry, beakMaterial);
        beak.position.set(0, 0, 0.5);
        beak.rotation.x = -Math.PI / 2;
        birdGroup.add(beak);

        return birdGroup;
    }

    createArbourRoad() {
        const streetGroup = new THREE.Group();
        
        // Create Mr. Bean's house (number 12)
        const beanHouse = this.createBritishHouse(true); // Pass true for Mr. Bean's house
        beanHouse.position.set(0, 0, 0);
        streetGroup.add(beanHouse);
        
        // Create Bruiser family house next door
        const bruiserHouse = this.createBritishHouse(false); // Pass false for other houses
        bruiserHouse.position.set(8, 0, 0);
        streetGroup.add(bruiserHouse);
        
        // Create other houses along the street
        for (let i = -2; i <= 2; i++) {
            if (i === 0) continue; // Skip Mr. Bean's house position
            if (i === 1) continue; // Skip Bruiser's house position
            const house = this.createBritishHouse(false); // Pass false for other houses
            house.position.set(i * 8, 0, 0);
            streetGroup.add(house);
        }
        
        // Add street name sign
        const streetSign = this.createStreetSign("ARBOUR ROAD");
        streetSign.position.set(-15, 2.5, 5);
        streetGroup.add(streetSign);
        
        // Add house number "12" to Mr. Bean's house
        const houseNumber = this.createHouseNumber("12");
        houseNumber.position.set(0.5, 2, 3.1);
        streetGroup.add(houseNumber);
        
        return streetGroup;
    }

    createBritishHouse(isBeanHouse) {
        const houseGroup = new THREE.Group();
        
        // Main building structure with more cartoon-like appearance
        const buildingGeometry = new THREE.BoxGeometry(6, 8, 6);
        const brickMaterial = new THREE.MeshToonMaterial({ 
            color: isBeanHouse ? 0xE8BEAC : 0xD4A59A,
            gradientMap: this.createToonGradient(),
            bumpMap: this.brickTexture,
            bumpScale: 0.2, // Increased bump scale for more cartoon effect
            map: this.brickTexture
        });
        const building = new THREE.Mesh(buildingGeometry, brickMaterial);
        building.position.y = 4;
        building.castShadow = true;
        building.receiveShadow = true;
        houseGroup.add(building);

        // Add collision box for the house
        houseGroup.collider = new THREE.Box3(
            new THREE.Vector3(-3, 0, -3),
            new THREE.Vector3(3, 8, 3)
        );

        // Add door with more cartoon-like appearance
        const doorGroup = this.createBritishDoor(isBeanHouse);
        doorGroup.position.set(0, 0.5, 3);
        houseGroup.add(doorGroup);

        // Add door interaction data
        houseGroup.doorData = {
            position: new THREE.Vector3(0, 0, 3),
            isOpen: false,
            canInteract: true,
            type: isBeanHouse ? "Mr. Bean's House" : "House"
        };

        // Add more cartoon-like window frames
        const windowFrames = this.createWindowFrames();
        windowFrames.position.set(0, 4, 3.1);
        houseGroup.add(windowFrames);

        // Add roof with more cartoon-like appearance
        const roofGeometry = new THREE.ConeGeometry(4.5, 3, 4);
        const roofMaterial = new THREE.MeshToonMaterial({ 
            color: 0x8B4513,
            gradientMap: this.createToonGradient()
        });
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = 9;
        roof.rotation.y = Math.PI / 4;
        roof.castShadow = true;
        houseGroup.add(roof);

        // Add chimney with more cartoon-like appearance
        const chimneyGeometry = new THREE.BoxGeometry(0.8, 2, 0.8);
        const chimney = new THREE.Mesh(chimneyGeometry, brickMaterial);
        chimney.position.set(2, 8.5, 0);
        chimney.castShadow = true;
        houseGroup.add(chimney);

        // Add decorative elements
        if (isBeanHouse) {
            // Add more cartoon-like flower boxes
            const flowerBox = this.createFlowerBox();
            flowerBox.position.set(0, 2.5, 3.2);
            houseGroup.add(flowerBox);

            // Add Scrapper the cat with more cartoon-like appearance
            const cat = this.createCat();
            cat.position.set(2, 0.2, 2.5);
            houseGroup.add(cat);
        }

        // Mark as building for visibility handling
        houseGroup.isBuilding = true;
        
        return houseGroup;
    }

    createToonGradient() {
        const gradientMap = new THREE.DataTexture(new Uint8Array([0, 128, 255]), 3, 1, THREE.LuminanceFormat);
        gradientMap.minFilter = THREE.NearestFilter;
        gradientMap.magFilter = THREE.NearestFilter;
        gradientMap.generateMipmaps = false;
        return gradientMap;
    }

    createWindowFrames() {
        const frameGroup = new THREE.Group();
        
        // Window frame with toon material
        const frameGeometry = new THREE.BoxGeometry(2, 2, 0.2);
        const frameMaterial = new THREE.MeshToonMaterial({ 
            color: 0xFFFFFF,
            gradientMap: this.createToonGradient()
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frameGroup.add(frame);

        // Window panes with cartoon glass effect
        const paneGeometry = new THREE.BoxGeometry(0.9, 0.9, 0.05);
        const paneMaterial = new THREE.MeshToonMaterial({
            color: 0x88CCFF,
            transparent: true,
            opacity: 0.6
        });

        // Create four window panes
        const panePositions = [
            [-0.45, 0.45], [0.45, 0.45],
            [-0.45, -0.45], [0.45, -0.45]
        ];

        panePositions.forEach(([x, y]) => {
            const pane = new THREE.Mesh(paneGeometry, paneMaterial);
            pane.position.set(x, y, 0);
            frameGroup.add(pane);
        });

        return frameGroup;
    }

    createFlowerBox() {
        const boxGroup = new THREE.Group();

        // Box container
        const boxGeometry = new THREE.BoxGeometry(1.8, 0.3, 0.4);
        const boxMaterial = new THREE.MeshToonMaterial({ 
            color: 0x8B4513,
            gradientMap: this.createToonGradient()
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        boxGroup.add(box);

        // Add flowers
        const flowerColors = [0xFF69B4, 0xFF0000, 0xFFFF00];
        for (let i = 0; i < 6; i++) {
            const flowerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
            const flowerMaterial = new THREE.MeshToonMaterial({ 
                color: flowerColors[i % 3],
                gradientMap: this.createToonGradient()
            });
            const flower = new THREE.Mesh(flowerGeometry, flowerMaterial);
            flower.position.set(
                (Math.random() - 0.5) * 1.4,
                0.2,
                0
            );
            boxGroup.add(flower);
        }

        return boxGroup;
    }

    createBritishDoor(isBeanHouse) {
        const doorGroup = new THREE.Group();
        
        // Main door
        const doorGeometry = new THREE.BoxGeometry(1.2, 2.2, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ 
            color: isBeanHouse ? 0x8B4513 : 0x4A4A4A 
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.name = 'door'; // Add name for easy reference
        doorGroup.add(door);
        
        // Door frame
        const frameGeometry = new THREE.BoxGeometry(1.4, 2.3, 0.2);
        const frameMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xA0522D 
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        frame.position.z = -0.05;
        doorGroup.add(frame);
        
        // Door knocker
        const knockerGeometry = new THREE.TorusGeometry(0.1, 0.02, 8, 16);
        const knockerMaterial = new THREE.MeshStandardMaterial({ color: 0xB87333 });
        const knocker = new THREE.Mesh(knockerGeometry, knockerMaterial);
        knocker.position.set(0, 0.3, 0.06);
        doorGroup.add(knocker);

        // Door handle
        const handleGeometry = new THREE.BoxGeometry(0.1, 0.03, 0.05);
        const handleMaterial = new THREE.MeshStandardMaterial({ color: 0xB87333 });
        const handle = new THREE.Mesh(handleGeometry, handleMaterial);
        handle.position.set(0.4, 0, 0.06);
        doorGroup.add(handle);
        
        return doorGroup;
    }

    createDepartmentStore() {
        const storeGroup = new THREE.Group();
        
        // Main building - Havlotts Department Store (10 stories)
        const buildingGeometry = new THREE.BoxGeometry(20, 40, 15);
        const buildingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xE5E5E5,
            roughness: 0.7
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = 20;
        storeGroup.add(building);

        // Large display windows on ground floor
        const windowGeometry = new THREE.BoxGeometry(18, 4, 0.1);
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x88CCFF,
            transparent: true,
            opacity: 0.5
        });
        const displayWindow = new THREE.Mesh(windowGeometry, windowMaterial);
        displayWindow.position.set(0, 4, 7.6);
        storeGroup.add(displayWindow);

        // Store name
        const signGeometry = new THREE.BoxGeometry(15, 2, 0.5);
        const signMaterial = new THREE.MeshStandardMaterial({ color: 0x4A4A4A });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, 35, 7.6);
        storeGroup.add(sign);

        // Add windows for each floor
        for (let floor = 1; floor < 10; floor++) {
            for (let x = -8; x <= 8; x += 4) {
                const window = this.createWindow();
                window.position.set(x, floor * 4 + 2, 7.5);
                window.scale.set(1.5, 1.5, 1);
                storeGroup.add(window);
            }
        }

        // Mark as building for visibility handling
        storeGroup.isBuilding = true;
        storeGroup.isDepartmentStore = true;
        
        return storeGroup;
    }

    createShopStreet() {
        const shopGroup = new THREE.Group();
        
        // Create a row of shops with more cartoon-like appearance
        const shopTypes = ['Grocery', 'Post Office', 'Cafe', 'Bookshop'];
        const shopColors = [0xE8BEAC, 0xD4A59A, 0xBFACA4, 0xCCB3A3];
        
        for (let i = 0; i < shopTypes.length; i++) {
            const shop = new THREE.Group();
            
            // Shop building with more cartoon-like appearance
            const buildingGeometry = new THREE.BoxGeometry(6, 6, 8);
            const buildingMaterial = new THREE.MeshToonMaterial({ 
                color: shopColors[i],
                gradientMap: this.createToonGradient(),
                roughness: 0.9
            });
            const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
            building.position.y = 3;
            shop.add(building);
            
            // Shop window with more cartoon-like appearance
            const windowGeometry = new THREE.BoxGeometry(4, 3, 0.1);
            const windowMaterial = new THREE.MeshToonMaterial({
                color: 0x88CCFF,
                gradientMap: this.createToonGradient(),
                transparent: true,
                opacity: 0.5
            });
            const shopWindow = new THREE.Mesh(windowGeometry, windowMaterial);
            shopWindow.position.set(0, 2, 4.1);
            shop.add(shopWindow);
            
            // Shop door with more cartoon-like appearance
            const doorGeometry = new THREE.BoxGeometry(1.2, 2.5, 0.1);
            const doorMaterial = new THREE.MeshToonMaterial({ 
                color: 0x4A4A4A,
                gradientMap: this.createToonGradient()
            });
            const door = new THREE.Mesh(doorGeometry, doorMaterial);
            door.position.set(2, 1.25, 4.1);
            shop.add(door);

            // Add shop sign with cartoon style
            const signGeometry = new THREE.BoxGeometry(5, 0.8, 0.2);
            const signMaterial = new THREE.MeshToonMaterial({ 
                color: 0x4A4A4A,
                gradientMap: this.createToonGradient()
            });
            const sign = new THREE.Mesh(signGeometry, signMaterial);
            sign.position.set(0, 6.5, 4.1);
            shop.add(sign);
            
            // Position shop in row
            shop.position.x = i * 8 - 12;
            shopGroup.add(shop);
        }
        
        // Position the entire shop street
        shopGroup.position.set(20, 0, 20);
        return shopGroup;
    }

    createPark() {
        const parkGroup = new THREE.Group();
        
        // Create larger grass area with more cartoon-like appearance
        const grassGeometry = new THREE.PlaneGeometry(40, 40);
        const grassMaterial = new THREE.MeshToonMaterial({ 
            color: 0x228B22,
            gradientMap: this.createToonGradient(),
            roughness: 0.8
        });
        const grass = new THREE.Mesh(grassGeometry, grassMaterial);
        grass.rotation.x = -Math.PI / 2;
        grass.position.y = 0.01;
        parkGroup.add(grass);
        
        // Add more cartoon-like benches
        const benchPositions = [
            [-15, 0, -15], [15, 0, -15],
            [-15, 0, 15], [15, 0, 15],
            [0, 0, 0], [-15, 0, 0],
            [15, 0, 0], [0, 0, -15],
            [0, 0, 15]
        ];
        
        benchPositions.forEach(pos => {
            const bench = this.createBench();
            bench.position.set(...pos);
            // Add collision to bench
            bench.collider = new THREE.Box3(
                new THREE.Vector3(-1, 0, -0.3).add(new THREE.Vector3(...pos)),
                new THREE.Vector3(1, 0.8, 0.3).add(new THREE.Vector3(...pos))
            );
            parkGroup.add(bench);
        });
        
        // Add more cartoon-like trees
        for (let i = 0; i < 15; i++) {
            const tree = this.createTree();
            const position = new THREE.Vector3(
                (Math.random() - 0.5) * 35,
                0,
                (Math.random() - 0.5) * 35
            );
            tree.position.copy(position);
            // Update tree's collider position
            tree.collider.translate(position);
            parkGroup.add(tree);
        }

        // Add cartoon-like park features
        this.addParkFeatures(parkGroup);
        
        return parkGroup;
    }

    addParkFeatures(parkGroup) {
        // Add cartoon-like fountain
        const fountain = this.createFountain();
        fountain.position.set(0, 0, 0);
        parkGroup.add(fountain);

        // Add cartoon-like flower beds
        const flowerBedPositions = [
            [-10, 0, -10], [10, 0, -10],
            [-10, 0, 10], [10, 0, 10]
        ];

        flowerBedPositions.forEach(pos => {
            const flowerBed = this.createFlowerBed();
            flowerBed.position.set(...pos);
            parkGroup.add(flowerBed);
        });
    }

    createFountain() {
        const fountainGroup = new THREE.Group();
        
        // Fountain base
        const baseGeometry = new THREE.CylinderGeometry(2, 2.5, 0.5, 16);
        const baseMaterial = new THREE.MeshToonMaterial({ 
            color: 0xCCCCCC,
            gradientMap: this.createToonGradient()
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        fountainGroup.add(base);

        // Fountain center
        const centerGeometry = new THREE.CylinderGeometry(1, 1.5, 1, 16);
        const centerMaterial = new THREE.MeshToonMaterial({ 
            color: 0xDDDDDD,
            gradientMap: this.createToonGradient()
        });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.position.y = 0.75;
        fountainGroup.add(center);

        // Water effect
        const waterGeometry = new THREE.CylinderGeometry(0.5, 0.8, 0.2, 16);
        const waterMaterial = new THREE.MeshToonMaterial({ 
            color: 0x88CCFF,
            gradientMap: this.createToonGradient(),
            transparent: true,
            opacity: 0.7
        });
        const water = new THREE.Mesh(waterGeometry, waterMaterial);
        water.position.y = 1.5;
        fountainGroup.add(water);

        return fountainGroup;
    }

    createFlowerBed() {
        const flowerBedGroup = new THREE.Group();
        
        // Flower bed base
        const baseGeometry = new THREE.CylinderGeometry(1, 1, 0.2, 16);
        const baseMaterial = new THREE.MeshToonMaterial({ 
            color: 0x8B4513,
            gradientMap: this.createToonGradient()
        });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        flowerBedGroup.add(base);

        // Add cartoon-like flowers
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const radius = 0.6;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const flower = this.createCartoonFlower();
            flower.position.set(x, 0.1, z);
            flowerBedGroup.add(flower);
        }

        return flowerBedGroup;
    }

    createCartoonFlower() {
        const flowerGroup = new THREE.Group();
        
        // Flower center
        const centerGeometry = new THREE.SphereGeometry(0.1, 8, 8);
        const centerMaterial = new THREE.MeshToonMaterial({ 
            color: 0xFFFF00,
            gradientMap: this.createToonGradient()
        });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        flowerGroup.add(center);

        // Flower petals
        const petalGeometry = new THREE.ConeGeometry(0.1, 0.2, 8);
        const petalMaterial = new THREE.MeshToonMaterial({ 
            color: 0xFF69B4,
            gradientMap: this.createToonGradient()
        });

        for (let i = 0; i < 5; i++) {
            const petal = new THREE.Mesh(petalGeometry, petalMaterial);
            petal.position.y = 0.1;
            petal.rotation.x = Math.PI / 2;
            petal.rotation.z = (i / 5) * Math.PI * 2;
            flowerGroup.add(petal);
        }

        return flowerGroup;
    }

    createBench() {
        const benchGroup = new THREE.Group();
        
        // Bench seat
        const seatGeometry = new THREE.BoxGeometry(2, 0.1, 0.6);
        const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const seat = new THREE.Mesh(seatGeometry, woodMaterial);
        seat.position.y = 0.4;
        benchGroup.add(seat);
        
        // Bench back
        const backGeometry = new THREE.BoxGeometry(2, 0.6, 0.1);
        const back = new THREE.Mesh(backGeometry, woodMaterial);
        back.position.set(0, 0.7, -0.25);
        benchGroup.add(back);
        
        // Bench legs
        const legGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.6);
        const metalMaterial = new THREE.MeshStandardMaterial({ color: 0x4A4A4A });
        
        [-0.8, 0.8].forEach(x => {
            const leg = new THREE.Mesh(legGeometry, metalMaterial);
            leg.position.set(x, 0.2, 0);
            benchGroup.add(leg);
        });
        
        return benchGroup;
    }

    createTree() {
        const treeGroup = new THREE.Group();
        
        // Tree trunk - made bigger
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        treeGroup.add(trunk);
        
        // Tree leaves - made bigger
        const leavesGeometry = new THREE.SphereGeometry(2.5, 8, 8);
        const leavesMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
        const leaves = new THREE.Mesh(leavesGeometry, leavesMaterial);
        leaves.position.y = 4;
        treeGroup.add(leaves);

        // Add collision box
        const collider = new THREE.Box3(
            new THREE.Vector3(-0.4, 0, -0.4),
            new THREE.Vector3(0.4, 3, 0.4)
        );
        treeGroup.collider = collider;
        
        return treeGroup;
    }

    createCar() {
        const carGroup = new THREE.Group();
        
        // Car body - Mr. Bean's iconic green Mini
        const bodyGeometry = new THREE.BoxGeometry(1.8, 1.2, 3.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x355E3B, // British Racing Green
            metalness: 0.7,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.6;
        carGroup.add(body);
        
        // Roof
        const roofGeometry = new THREE.BoxGeometry(1.6, 0.8, 2);
        const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
        roof.position.y = 1.6;
        carGroup.add(roof);
        
        // Windows
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x88CCFF,
            transparent: true,
            opacity: 0.5
        });
        
        // Windshield
        const windshieldGeometry = new THREE.BoxGeometry(1.5, 0.7, 0.1);
        const windshield = new THREE.Mesh(windshieldGeometry, windowMaterial);
        windshield.position.set(0, 1.3, 1);
        windshield.rotation.x = Math.PI * 0.1;
        carGroup.add(windshield);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const wheelPositions = [
            [-0.9, 0.3, -1], [0.9, 0.3, -1],
            [-0.9, 0.3, 1], [0.9, 0.3, 1]
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...pos);
            carGroup.add(wheel);
        });
        
        // Position Mr. Bean's car in front of his house
        carGroup.position.set(-30, 0, -15);
        this.scene.add(carGroup);
        
        return carGroup;
    }

    createStreetLamp() {
        const lampGroup = new THREE.Group();
        
        // Lamp post
        const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4, 8);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.y = 2;
        lampGroup.add(post);
        
        // Lamp head
        const headGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8);
        const headMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 4;
        lampGroup.add(head);
        
        // Light bulb
        const bulbGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const bulbMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFFF99,
            emissive: 0xFFFF99,
            emissiveIntensity: 0.5
        });
        const bulb = new THREE.Mesh(bulbGeometry, bulbMaterial);
        bulb.position.y = 3.8;
        lampGroup.add(bulb);
        
        // Add point light
        const light = new THREE.PointLight(0xFFFF99, 0.5, 10);
        light.position.y = 3.8;
        lampGroup.add(light);
        
        return lampGroup;
    }

    createTrashBin() {
        const binGroup = new THREE.Group();
        
        // Bin body
        const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.25, 0.8, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x2E4053 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.4;
        binGroup.add(body);
        
        // Bin lid
        const lidGeometry = new THREE.CylinderGeometry(0.32, 0.3, 0.1, 8);
        const lidMaterial = new THREE.MeshStandardMaterial({ color: 0x1B2631 });
        const lid = new THREE.Mesh(lidGeometry, lidMaterial);
        lid.position.y = 0.85;
        binGroup.add(lid);
        
        return binGroup;
    }

    createPhoneBox() {
        const boxGroup = new THREE.Group();
        
        // Main box
        const boxGeometry = new THREE.BoxGeometry(1, 2.5, 1);
        const boxMaterial = new THREE.MeshStandardMaterial({ color: 0xFF0000 });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.y = 1.25;
        boxGroup.add(box);
        
        // Crown on top
        const crownGeometry = new THREE.CylinderGeometry(0.6, 0.5, 0.3, 4);
        const crown = new THREE.Mesh(crownGeometry, boxMaterial);
        crown.position.y = 2.6;
        boxGroup.add(crown);
        
        // Door
        const doorGeometry = new THREE.BoxGeometry(0.8, 2, 0.1);
        const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x8B0000 });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 1.25, 0.45);
        boxGroup.add(door);
        
        // Windows
        const windowGeometry = new THREE.BoxGeometry(0.6, 0.6, 0.1);
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x88CCFF,
            transparent: true,
            opacity: 0.5
        });
        
        for (let y = 0.8; y <= 1.8; y += 0.8) {
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(0, y, 0.45);
            boxGroup.add(window);
        }
        
        return boxGroup;
    }

    createClassicBritishCar() {
        const carGroup = new THREE.Group();
        
        // Car body
        const bodyGeometry = new THREE.BoxGeometry(1.8, 1.2, 3.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: Math.random() > 0.5 ? 0x000000 : 0x1A1A1A,
            metalness: 0.7,
            roughness: 0.3
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.6;
        carGroup.add(body);
        
        // Roof
        const roofGeometry = new THREE.BoxGeometry(1.6, 0.8, 2);
        const roof = new THREE.Mesh(roofGeometry, bodyMaterial);
        roof.position.y = 1.6;
        carGroup.add(roof);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16);
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        
        const wheelPositions = [
            [-0.9, 0.3, -1], [0.9, 0.3, -1],
            [-0.9, 0.3, 1], [0.9, 0.3, 1]
        ];
        
        wheelPositions.forEach(pos => {
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(...pos);
            carGroup.add(wheel);
        });
        
        return carGroup;
    }

    createStreetSign(text) {
        const signGroup = new THREE.Group();
        
        // Post
        const postGeometry = new THREE.CylinderGeometry(0.05, 0.05, 3, 8);
        const postMaterial = new THREE.MeshStandardMaterial({ color: 0x4A4A4A });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.y = 1.5;
        signGroup.add(post);
        
        // Sign plate
        const plateGeometry = new THREE.BoxGeometry(2, 0.4, 0.1);
        const plateMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x006400, // Dark green, typical for British street signs
            metalness: 0.5,
            roughness: 0.5
        });
        const plate = new THREE.Mesh(plateGeometry, plateMaterial);
        plate.position.y = 2.5;
        signGroup.add(plate);

        // Create text texture (simulated with a white rectangle for now)
        const textGeometry = new THREE.BoxGeometry(1.8, 0.3, 0.02);
        const textMaterial = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
        const textMesh = new THREE.Mesh(textGeometry, textMaterial);
        textMesh.position.y = 2.5;
        textMesh.position.z = 0.06;
        signGroup.add(textMesh);
        
        return signGroup;
    }

    createHouseNumber(number) {
        const numberGroup = new THREE.Group();
        
        // Background plate
        const plateGeometry = new THREE.BoxGeometry(0.3, 0.4, 0.05);
        const plateMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFFFFF,
            metalness: 0.2,
            roughness: 0.8
        });
        const plate = new THREE.Mesh(plateGeometry, plateMaterial);
        numberGroup.add(plate);

        // Number (simulated with a dark rectangle)
        const numberGeometry = new THREE.BoxGeometry(0.2, 0.3, 0.02);
        const numberMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        const numberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
        numberMesh.position.z = 0.035;
        numberGroup.add(numberMesh);
        
        return numberGroup;
    }

    createCat() {
        const catGroup = new THREE.Group();
        
        // Cat body
        const bodyGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.5);
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2C3E50, // Dark grey for Scrapper
            roughness: 0.8
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 0.15;
        catGroup.add(body);
        
        // Cat head
        const headGeometry = new THREE.SphereGeometry(0.15, 8, 8);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.set(0, 0.3, 0.2);
        catGroup.add(head);
        
        // Cat ears
        const earGeometry = new THREE.ConeGeometry(0.05, 0.1, 4);
        [-0.08, 0.08].forEach(x => {
            const ear = new THREE.Mesh(earGeometry, bodyMaterial);
            ear.position.set(x, 0.4, 0.2);
            ear.rotation.x = -Math.PI / 4;
            catGroup.add(ear);
        });
        
        // Cat tail
        const tailGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
        const tail = new THREE.Mesh(tailGeometry, bodyMaterial);
        tail.position.set(0, 0.2, -0.2);
        tail.rotation.x = Math.PI / 4;
        catGroup.add(tail);
        
        // Cat eyes
        const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xFFFF00, // Yellow eyes
            emissive: 0xFFFF00,
            emissiveIntensity: 0.2
        });
        
        [-0.06, 0.06].forEach(x => {
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(x, 0.33, 0.32);
            catGroup.add(eye);
        });
        
        return catGroup;
    }

    setupNPCs() {
        this.npcs = [];
        this.mainNPCs = [];
        
        // Create main NPCs first
        const mainNPCConfigs = [
            {
                name: "Mrs. Wicket",
                description: "Mr. Bean's landlady",
                position: new THREE.Vector3(-42, 0, -32), // Near Bean's house
                colors: {
                    clothing: 0x4A0404, // Dark red dress
                    hair: 0x808080, // Grey hair
                    skin: 0xE6C5A5
                },
                scale: 0.9, // Slightly smaller
                dialogs: [
                    "Mr. Bean! Your rent is due!",
                    "Have you seen my Scrapper? That cat's always wandering off...",
                    "Keep the noise down up there!",
                    "I heard crashes from your flat again last night!",
                    "Don't forget to clean the stairs this week, it's your turn!"
                ]
            },
            {
                name: "Irma Gobb",
                description: "Mr. Bean's girlfriend",
                position: new THREE.Vector3(25, 0, -25), // Near the shops
                colors: {
                    clothing: 0xE6A8D7, // Pink dress
                    hair: 0x4A2F23, // Brown hair
                    skin: 0xFFE0BD
                },
                scale: 0.95,
                dialogs: [
                    "Oh, Mr. Bean! I've been waiting for our date!",
                    "I found this lovely new café we could try...",
                    "Have you remembered it's my birthday next week?",
                    "I saw this beautiful teddy bear in the shop window...",
                    "Shall we go to the park together?"
                ]
            },
            {
                name: "Rupert",
                description: "The grumpy neighbor",
                position: new THREE.Vector3(-34, 0, -32), // Next door
                colors: {
                    clothing: 0x2C3E50, // Navy suit
                    hair: 0x1A1A1A, // Black hair
                    skin: 0xFFD7B5
                },
                scale: 1.1, // Slightly larger
                dialogs: [
                    "Keep that racket down, Bean!",
                    "What are you up to now?",
                    "Stay away from my garden!",
                    "I saw you sneaking around last night!",
                    "Not another one of your silly schemes!"
                ]
            }
        ];

        // Create main NPCs
        mainNPCConfigs.forEach(config => {
            const npc = this.createMainNPC(config);
            this.mainNPCs.push(npc);
        });
        
        // Add regular NPCs
        for (let i = 0; i < 10; i++) {
            const npc = this.createNPC();
            npc.walkDirection = Math.random() * Math.PI * 2;
            npc.walkSpeed = 0.02 + Math.random() * 0.02;
            this.npcs.push(npc);
        }
    }

    createMainNPC(config) {
        const npcGroup = new THREE.Group();
        
        // Body - more detailed for main characters
        const torsoGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.3);
        const clothingMaterial = new THREE.MeshStandardMaterial({ 
            color: config.colors.clothing,
            roughness: 0.8
        });
        const torso = new THREE.Mesh(torsoGeometry, clothingMaterial);
        torso.position.y = 1.1;
        npcGroup.add(torso);

        // Legs with clothing color
        const legGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        [-0.1, 0.1].forEach(x => {
            const leg = new THREE.Mesh(legGeometry, clothingMaterial);
            leg.position.set(x, 0.5, 0);
            npcGroup.add(leg);
        });

        // Arms with clothing color
        const armGeometry = new THREE.BoxGeometry(0.12, 0.4, 0.12);
        [-0.25, 0.25].forEach(x => {
            const arm = new THREE.Mesh(armGeometry, clothingMaterial);
            arm.position.set(x, 1.2, 0);
            npcGroup.add(arm);
        });

        // Head with more detail
        const headGroup = new THREE.Group();
        
        // Basic head shape
        const headGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const skinMaterial = new THREE.MeshStandardMaterial({ 
            color: config.colors.skin,
            roughness: 0.7
        });
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        headGroup.add(head);

        // Distinctive hairstyle
        const hairGeometry = new THREE.SphereGeometry(0.16, 12, 12);
        const hairMaterial = new THREE.MeshStandardMaterial({ 
            color: config.colors.hair,
            roughness: 1
        });
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.scale.set(1, 0.7, 1);
        hair.position.y = 0.05;
        headGroup.add(hair);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        [-0.06, 0.06].forEach(x => {
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(x, 0, 0.12);
            headGroup.add(eye);
        });

        headGroup.position.y = 1.5;
        npcGroup.add(headGroup);

        // Scale the NPC according to config
        npcGroup.scale.setScalar(config.scale);

        // Set position
        npcGroup.position.copy(config.position);

        // Add metadata
        npcGroup.userData = {
            isMainNPC: true,
            name: config.name,
            dialogs: config.dialogs,
            walkSpeed: 0.01, // Slower than regular NPCs
            walkDirection: Math.random() * Math.PI * 2,
            originalPosition: config.position.clone(),
            maxWanderDistance: 5 // Maximum distance they can wander from their original position
        };

        // Add to scene
        this.scene.add(npcGroup);

        return npcGroup;
    }

    updateNPCs() {
        // Update main NPCs with restricted movement
        this.mainNPCs.forEach(npc => {
            if (Math.random() < 0.02) { // Occasionally change direction
                npc.userData.walkDirection += (Math.random() - 0.5) * Math.PI / 2;
            }

            // Calculate new position
            const newPosition = npc.position.clone();
            newPosition.x += Math.cos(npc.userData.walkDirection) * npc.userData.walkSpeed;
            newPosition.z += Math.sin(npc.userData.walkDirection) * npc.userData.walkSpeed;

            // Check if new position is within allowed range
            if (newPosition.distanceTo(npc.userData.originalPosition) < npc.userData.maxWanderDistance) {
                npc.position.copy(newPosition);
            } else {
                // Turn back towards original position
                const angleToOrigin = Math.atan2(
                    npc.userData.originalPosition.z - npc.position.z,
                    npc.userData.originalPosition.x - npc.position.x
                );
                npc.userData.walkDirection = angleToOrigin;
            }

            // Update NPC rotation to face movement direction
            npc.rotation.y = npc.userData.walkDirection;
        });

        // Update regular NPCs
        this.npcs.forEach(npc => {
            npc.position.x += Math.cos(npc.walkDirection) * npc.walkSpeed;
            npc.position.z += Math.sin(npc.walkDirection) * npc.walkSpeed;

            if (Math.random() < 0.02) {
                npc.walkDirection += (Math.random() - 0.5) * Math.PI / 2;
            }

            const maxDistance = 40;
            if (Math.abs(npc.position.x) > maxDistance || Math.abs(npc.position.z) > maxDistance) {
                npc.walkDirection += Math.PI;
            }

            npc.rotation.y = npc.walkDirection;
        });
    }

    addStreetLamps() {
        // Add lamps along roads at regular intervals
        const lampSpacing = 20;
        
        // Horizontal roads
        for (let x = -80; x <= 80; x += lampSpacing) {
            [-30, 0, 30].forEach(z => {
                const lamp = this.createStreetLamp();
                lamp.position.set(x, 0, z);
                this.scene.add(lamp);
            });
        }
        
        // Vertical roads
        for (let z = -80; z <= 80; z += lampSpacing) {
            [-30, 0, 30].forEach(x => {
                const lamp = this.createStreetLamp();
                lamp.position.set(x, 0, z);
                this.scene.add(lamp);
            });
        }
    }

    addPhoneBoxes() {
        // Add phone boxes at key intersections
        const locations = [
            [-30, -30], [30, -30],
            [-30, 30], [30, 30]
        ];
        
        locations.forEach(([x, z]) => {
            const phoneBox = this.createPhoneBox();
            phoneBox.position.set(x, 0, z);
            this.scene.add(phoneBox);
        });
    }

    addTrashBins() {
        // Add bins at street corners
        const locations = [
            [-32, -32], [-32, 0], [-32, 32],
            [0, -32], [0, 0], [0, 32],
            [32, -32], [32, 0], [32, 32]
        ];
        
        locations.forEach(([x, z]) => {
            const bin = this.createTrashBin();
            bin.position.set(x, 0, z);
            this.scene.add(bin);
        });
    }

    addParkedCars() {
        // Add parked cars along streets
        const locations = [
            { pos: [-35, -20], rot: Math.PI / 2 },
            { pos: [-35, 0], rot: Math.PI / 2 },
            { pos: [-35, 20], rot: Math.PI / 2 },
            { pos: [35, -20], rot: -Math.PI / 2 },
            { pos: [35, 0], rot: -Math.PI / 2 },
            { pos: [35, 20], rot: -Math.PI / 2 }
        ];
        
        locations.forEach(({pos, rot}) => {
            const car = this.createClassicBritishCar();
            car.position.set(pos[0], 0, pos[1]);
            car.rotation.y = rot;
            this.scene.add(car);
        });
    }

    setupPlayer() {
        const playerGroup = new THREE.Group();
        
        // Mr. Bean's body - slimmer torso with brown suit
        const torsoGeometry = new THREE.BoxGeometry(0.45, 0.7, 0.35);
        const suitMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x4A3C31, // Brown suit color
            roughness: 0.8
        });
        const torso = new THREE.Mesh(torsoGeometry, suitMaterial);
        torso.position.y = 1.1;
        playerGroup.add(torso);

        // Red tie
        const tieGeometry = new THREE.BoxGeometry(0.08, 0.3, 0.05);
        const tieMaterial = new THREE.MeshStandardMaterial({ color: 0xCC0000 });
        const tie = new THREE.Mesh(tieGeometry, tieMaterial);
        tie.position.set(0, 1.2, 0.2);
        playerGroup.add(tie);

        // Legs with brown trousers
        const legGeometry = new THREE.BoxGeometry(0.18, 0.6, 0.18);
        [-0.12, 0.12].forEach(x => {
            const leg = new THREE.Mesh(legGeometry, suitMaterial);
            leg.position.set(x, 0.5, 0);
            playerGroup.add(leg);
        });

        // Arms
        const armGeometry = new THREE.BoxGeometry(0.14, 0.5, 0.14);
        [-0.3, 0.3].forEach(x => {
            const arm = new THREE.Mesh(armGeometry, suitMaterial);
            arm.position.set(x, 1.2, 0);
            playerGroup.add(arm);
        });

        // Mr. Bean's distinctive head
        const headGroup = new THREE.Group();
        
        // Basic head shape - slightly elongated
        const headGeometry = new THREE.SphereGeometry(0.2, 16, 16);
        const skinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xE6B5A0,
            roughness: 0.7
        });
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        head.scale.set(0.8, 1.1, 0.9);
        headGroup.add(head);

        // Mr. Bean's characteristic dark hair
        const hairGeometry = new THREE.SphereGeometry(0.21, 12, 12);
        const hairMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1A1A1A,
            roughness: 1
        });
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.scale.set(0.85, 0.6, 0.9);
        hair.position.y = 0.08;
        headGroup.add(hair);

        // Large eyebrows
        const eyebrowGeometry = new THREE.BoxGeometry(0.08, 0.02, 0.02);
        const eyebrowMaterial = new THREE.MeshStandardMaterial({ color: 0x1A1A1A });
        [-0.08, 0.08].forEach(x => {
            const eyebrow = new THREE.Mesh(eyebrowGeometry, eyebrowMaterial);
            eyebrow.position.set(x, 0.1, 0.15);
            eyebrow.rotation.x = -0.2;
            headGroup.add(eyebrow);
        });

        // Big expressive eyes
        const eyeGeometry = new THREE.SphereGeometry(0.035, 12, 12);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        [-0.07, 0.07].forEach(x => {
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(x, 0.03, 0.16);
            headGroup.add(eye);
        });

        // Distinctive nose
        const noseGeometry = new THREE.BoxGeometry(0.06, 0.1, 0.06);
        const nose = new THREE.Mesh(noseGeometry, skinMaterial);
        nose.position.set(0, 0, 0.2);
        headGroup.add(nose);

        headGroup.position.y = 1.6;
        playerGroup.add(headGroup);

        // Set up the player with the new model
        this.player = playerGroup;
        this.player.position.set(-38, 0, -28); // Start at Mr. Bean's house
        this.player.castShadow = true;
        this.player.receiveShadow = true;
        this.scene.add(this.player);

        // Setup keyboard controls (rest of the method remains the same)
        this.keys = {
            w: false,
            a: false,
            s: false,
            d: false,
            e: false,
            0: false // Add 0 key for camera toggle
        };

        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.key.toLowerCase())) {
                this.keys[e.key.toLowerCase()] = true;
            }
            // Handle camera toggle
            if (e.key === '0') {
                this.isFirstPerson = !this.isFirstPerson;
                this.cameraOffset = this.isFirstPerson ? 
                    this.firstPersonCameraOffset.clone() : 
                    this.thirdPersonCameraOffset.clone();
            }
        });

        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.key.toLowerCase())) {
                this.keys[e.key.toLowerCase()] = false;
            }
        });

        // Add ESC key handler for options menu
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.optionsMenu) {
                    this.optionsMenu.style.display = this.optionsMenu.style.display === 'none' ? 'block' : 'none';
                }
            }
        });
    }

    updatePlayer() {
        // Reset velocity with improved responsiveness
        this.playerVelocity.set(0, 0, 0);

        // Handle rotation with smoother turning
        if (this.keys.a) {
            this.player.rotation.y += this.turnSpeed;
        }
        if (this.keys.d) {
            this.player.rotation.y -= this.turnSpeed;
        }

        // Calculate next position
        const currentSpeed = this.moveSpeed;
        if (this.keys.w) {
            this.playerVelocity.z = currentSpeed;
        }
        if (this.keys.s) {
            this.playerVelocity.z = -currentSpeed;
        }

        // Apply rotation to velocity
        this.playerVelocity.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation.y);
        
        // Calculate next position
        const nextPosition = this.player.position.clone().add(this.playerVelocity);

        // Create player collision box
        const playerBox = new THREE.Box3();
        const playerSize = new THREE.Vector3(0.4, 1.8, 0.4);
        playerBox.setFromCenterAndSize(nextPosition, playerSize);

        // Check for collisions with all objects
        let canMove = true;

        // Check collisions with stores
        this.stores.forEach(store => {
            if (store.collider) {
                const storeBox = store.collider.clone();
                storeBox.translate(store.position);
                if (storeBox.intersectsBox(playerBox)) {
                    canMove = false;
                }
            }
        });

        // Check collisions with houses in Arbour Road
        this.scene.traverse(object => {
            if (object.collider && !object.isStore) {
                const objBox = object.collider.clone();
                if (object.position) {
                    objBox.translate(object.position);
                }
                if (objBox.intersectsBox(playerBox)) {
                    canMove = false;
                }
            }
        });

        // Update position if no collision
        if (canMove) {
            this.player.position.copy(nextPosition);
        }

        // Keep player within bounds
        const maxDistance = 95;
        this.player.position.x = Math.max(-maxDistance, Math.min(maxDistance, this.player.position.x));
        this.player.position.z = Math.max(-maxDistance, Math.min(maxDistance, this.player.position.z));

        // Update camera
        this.updateCamera();

        // Play footstep sounds when moving
        if (this.soundEffects && this.soundEffects.footsteps && (this.keys.w || this.keys.s) && this.soundEffectsEnabled) {
            if (!this.soundEffects.footsteps.isPlaying) {
                this.soundEffects.footsteps.play();
            }
        } else if (this.soundEffects && this.soundEffects.footsteps && this.soundEffects.footsteps.isPlaying) {
            this.soundEffects.footsteps.stop();
        }
    }

    updateCamera() {
        // Calculate desired camera position
        const cameraOffset = new THREE.Vector3(
            0,
            this.cameraOffset.y,
            this.cameraOffset.z
        );
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.player.rotation.y);
        
        const targetPosition = this.player.position.clone().add(cameraOffset);
        
        // Smoothly move camera to desired position
        this.camera.position.lerp(targetPosition, this.smoothFactor);
        
        // Make camera look at point slightly above player
        const lookAtPoint = this.player.position.clone().add(new THREE.Vector3(0, 1.5, 0));
        this.camera.lookAt(lookAtPoint);
    }

    animate() {
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // Convert to seconds
        this.lastTime = currentTime;

        // Update frustum for culling
        this.camera.updateMatrixWorld();
        this.cameraViewProjectionMatrix.multiplyMatrices(
            this.camera.projectionMatrix,
            this.camera.matrixWorldInverse
        );
        this.frustum.setFromProjectionMatrix(this.cameraViewProjectionMatrix);

        // Update player movement and camera with delta time
        this.updatePlayer();
        
        // Update NPCs with optimized frequency and culling
        if (this.npcs) {
            // Only update NPCs every other frame for better performance
            if (this.frameCount % 2 === 0) {
                this.updateNPCsWithCulling();
            }
        }
        
        // Render only visible objects
        this.updateVisibility();
        
        // Render the scene with outline effect
        this.outlineEffect.render(this.scene, this.camera);

        // Update shadow map only when necessary
        if (this.shadowUpdateNeeded) {
            this.renderer.shadowMap.needsUpdate = true;
            this.shadowUpdateNeeded = false;
        }

        // Request next frame with optimized timing
        this.frameCount = (this.frameCount || 0) + 1;
        requestAnimationFrame(() => this.animate());
    }

    updateVisibility() {
        // Get player position for distance culling
        const playerPos = this.player.position;
        const cameraPos = this.camera.position;
        
        // Update visibility of all objects
        this.scene.traverse(object => {
            if (object.isMesh || object.isGroup) {
                // Skip player, camera, and essential objects
                if (object === this.player || object === this.camera) return;
                
                // Calculate distance to player and camera
                const distanceToPlayer = object.position.distanceTo(playerPos);
                const distanceToCamera = object.position.distanceTo(cameraPos);
                
                // Always show objects very close to the camera (prevents blue screen when looking inside)
                if (distanceToCamera < 3) {
                    object.visible = true;
                    return;
                }
                
                // Only process objects within reasonable distance (increased from 50 to 60 units)
                if (distanceToPlayer > 60) {
                    object.visible = false;
                    return;
                }
                
                // Check if object is in view frustum
                const box = new THREE.Box3().setFromObject(object);
                const sphere = new THREE.Sphere();
                box.getBoundingSphere(sphere);
                
                // Increase the sphere radius slightly to prevent pop-in
                sphere.radius *= 1.2;
                
                // Special handling for buildings and large objects
                if (object.isBuilding || object.scale.length() > 5) {
                    object.visible = true;
                    return;
                }
                
                object.visible = this.frustum.intersectsSphere(sphere);
            }
        });
    }

    updateNPCsWithCulling() {
        const playerPos = this.player.position;
        
        // Update main NPCs with restricted movement and culling
        this.mainNPCs.forEach(npc => {
            // Only update if within visible range
            if (npc.position.distanceTo(playerPos) <= 50) {
                if (Math.random() < 0.02) {
                    npc.userData.walkDirection += (Math.random() - 0.5) * Math.PI / 2;
                }

                const newPosition = npc.position.clone();
                newPosition.x += Math.cos(npc.userData.walkDirection) * npc.userData.walkSpeed;
                newPosition.z += Math.sin(npc.userData.walkDirection) * npc.userData.walkSpeed;

                if (newPosition.distanceTo(npc.userData.originalPosition) < npc.userData.maxWanderDistance) {
                    npc.position.copy(newPosition);
                } else {
                    const angleToOrigin = Math.atan2(
                        npc.userData.originalPosition.z - npc.position.z,
                        npc.userData.originalPosition.x - npc.position.x
                    );
                    npc.userData.walkDirection = angleToOrigin;
                }

                npc.rotation.y = npc.userData.walkDirection;
            }
        });

        // Update regular NPCs with culling
        this.npcs.forEach(npc => {
            // Only update if within visible range
            if (npc.position.distanceTo(playerPos) <= 50) {
                npc.position.x += Math.cos(npc.walkDirection) * npc.walkSpeed;
                npc.position.z += Math.sin(npc.walkDirection) * npc.walkSpeed;

                if (Math.random() < 0.02) {
                    npc.walkDirection += (Math.random() - 0.5) * Math.PI / 2;
                }

                const maxDistance = 40;
                if (Math.abs(npc.position.x) > maxDistance || Math.abs(npc.position.z) > maxDistance) {
                    npc.walkDirection += Math.PI;
                }

                npc.rotation.y = npc.walkDirection;
            }
        });
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setupInteraction() {
        this.interactionDistance = 2;
        this.interactableObjects = [];
        this.dialogElement = null;

        // Create dialog element
        this.createDialogElement();

        // Add interaction with NPCs and doors
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'e') {
                // Find closest NPC and interactable object
                let closestNPC = null;
                let closestDistance = Infinity;
                let closestInteractable = null;
                let closestInteractableDistance = Infinity;

                // Check main NPCs
                this.mainNPCs.forEach(npc => {
                    const distance = this.player.position.distanceTo(npc.position);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestNPC = npc;
                    }
                });

                // Check regular NPCs
                this.npcs.forEach(npc => {
                    const distance = this.player.position.distanceTo(npc.position);
                    if (distance < closestDistance) {
                        closestDistance = distance;
                        closestNPC = npc;
                    }
                });

                // Check all objects with doors
                this.scene.traverse(object => {
                    if (object.doorData) {
                        const doorWorldPos = object.position.clone().add(object.doorData.position);
                        const distance = this.player.position.distanceTo(doorWorldPos);
                        if (distance < closestInteractableDistance) {
                            closestInteractableDistance = distance;
                            closestInteractable = object;
                        }
                    }
                });

                // Handle NPC interaction
                if (closestNPC && closestDistance < this.interactionDistance) {
                    // Make the NPC turn to face the player
                    const angle = Math.atan2(
                        this.player.position.x - closestNPC.position.x,
                        this.player.position.z - closestNPC.position.z
                    );
                    closestNPC.rotation.y = angle;
                    
                    // Stop the NPC from walking temporarily
                    const currentSpeed = closestNPC.userData ? closestNPC.userData.walkSpeed : closestNPC.walkSpeed;
                    if (closestNPC.userData) {
                        closestNPC.userData.walkSpeed = 0;
                    } else {
                        closestNPC.walkSpeed = 0;
                    }
                    
                    // Show dialog
                    this.showDialog(closestNPC);
                    
                    // After 30 seconds, hide dialog and let them continue walking
                    setTimeout(() => {
                        this.hideDialog();
                        if (closestNPC.userData) {
                            closestNPC.userData.walkSpeed = currentSpeed;
                        } else {
                            closestNPC.walkSpeed = currentSpeed;
                        }
                    }, 30000);

                    // Play interaction sound
                    if (this.soundEffectsEnabled && this.soundEffects && this.soundEffects.interact) {
                        this.soundEffects.interact.play();
                    }

                    // Check for challenge progress
                    this.checkChallengeProgress(closestNPC);
                }
                // Handle door/building interaction
                else if (closestInteractable && closestInteractableDistance < this.interactionDistance) {
                    // Play door sound
                    if (this.soundEffectsEnabled && this.soundEffects && this.soundEffects.doorOpen) {
                        this.soundEffects.doorOpen.play();
                    }

                    // Show interaction message
                    const buildingType = closestInteractable.doorData.type;
                    this.showInteractionMessage(buildingType, closestInteractable.doorData.isOpen ? "Closing door..." : "Opening door...");

                    // Toggle door state
                    closestInteractable.doorData.isOpen = !closestInteractable.doorData.isOpen;
                    
                    // Animate the door
                    const door = closestInteractable.getObjectByName('door');
                    if (door) {
                        const targetRotation = closestInteractable.doorData.isOpen ? Math.PI / 2 : 0;
                        this.animateDoor(door, targetRotation);
                    }
                }
            }
        });
    }

    animateDoor(door, targetRotation) {
        const duration = 1000; // Animation duration in milliseconds
        const startRotation = door.rotation.y;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Use easing function for smooth animation
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            
            door.rotation.y = startRotation + (targetRotation - startRotation) * easeProgress;

            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    checkChallengeProgress(npc) {
        if (!this.activeChallenge || !npc.userData) return;

        const challenge = this.activeChallenge;
        const npcName = npc.userData.name;

        switch (challenge.id) {
            case 1: // Find Teddy
                if (npcName === "Mrs. Wicket" && !challenge.steps[0].completed) {
                    // First step: Talk to Mrs. Wicket
                    this.updateChallengeProgress(0);
                } else if (challenge.steps[0].completed && !challenge.steps[1].completed) {
                    // Check if player is near a park bench
                    const parkBenches = this.scene.children.filter(obj => 
                        obj.isBench && this.player.position.distanceTo(obj.position) < 2
                    );
                    if (parkBenches.length > 0) {
                        this.updateChallengeProgress(1);
                        this.showDialog({
                            userData: {
                                name: "Mr. Bean",
                                dialogs: ["Aha! There's a note here... 'Your Teddy is at the department store.'"]
                            }
                        });
                    }
                } else if (challenge.steps[1].completed && !challenge.steps[2].completed) {
                    // Check if player is near the department store
                    const nearDepartmentStore = this.scene.children.some(obj =>
                        obj.isDepartmentStore && this.player.position.distanceTo(obj.position) < 5
                    );
                    if (nearDepartmentStore) {
                        this.updateChallengeProgress(2);
                        this.completeChallenge();
                    }
                }
                break;

            case 2: // Late for Appointment
                if (!challenge.steps[0].completed) {
                    // Check if player is near their car
                    const nearCar = this.player.position.distanceTo(new THREE.Vector3(-38, 0, -28)) < 2;
                    if (nearCar) {
                        this.updateChallengeProgress(0);
                        this.showDialog({
                            userData: {
                                name: "Mr. Bean",
                                dialogs: ["Oh no! The car won't start! Maybe Rupert can help..."]
                            }
                        });
                    }
                } else if (npcName === "Rupert" && !challenge.steps[1].completed) {
                    this.updateChallengeProgress(1);
                    this.showDialog({
                        userData: {
                            name: "Rupert",
                            dialogs: ["*Sigh* Fine, Bean. The clinic is in the city center, near the department store."]
                        }
                    });
                } else if (challenge.steps[1].completed && !challenge.steps[2].completed) {
                    // Check if player is in the city center (near department store)
                    const inCityCenter = this.player.position.distanceTo(new THREE.Vector3(30, 0, -30)) < 10;
                    if (inCityCenter) {
                        this.updateChallengeProgress(2);
                        this.completeChallenge();
                    }
                }
                break;

            case 3: // Christmas Shopping
                if (npcName === "Irma Gobb" && !challenge.steps[0].completed) {
                    this.updateChallengeProgress(0);
                    this.showDialog({
                        userData: {
                            name: "Irma",
                            dialogs: ["Oh, Mr. Bean! I do love that teddy bear in the department store window..."]
                        }
                    });
                } else if (challenge.steps[0].completed && !challenge.steps[1].completed) {
                    // Check if player is at department store
                    const atStore = this.scene.children.some(obj =>
                        obj.isDepartmentStore && this.player.position.distanceTo(obj.position) < 5
                    );
                    if (atStore) {
                        this.updateChallengeProgress(1);
                        this.showDialog({
                            userData: {
                                name: "Store Clerk",
                                dialogs: ["The teddy bears are on sale today! Perfect timing!"]
                            }
                        });
                    }
                } else if (challenge.steps[1].completed && !challenge.steps[2].completed) {
                    // Player needs to interact with the store clerk
                    if (npcName === "Store Clerk") {
                        this.updateChallengeProgress(2);
                        this.completeChallenge();
                    }
                }
                break;
        }
    }

    completeChallenge() {
        if (!this.activeChallenge) return;

        const challenge = this.activeChallenge;
        this.showDialog({
            userData: {
                name: "Challenge Complete!",
                dialogs: [challenge.reward]
            }
        });

        // Play success sound
        if (this.soundEffectsEnabled && this.soundEffects && this.soundEffects.interact) {
            this.soundEffects.interact.play();
        }

        // Mark challenge as completed
        challenge.completed = true;
        this.activeChallenge = null;
        this.updateActiveChallengeDisplay();

        // Update challenge menu
        this.updateChallengeMenu();
    }

    updateChallengeMenu() {
        // Update the challenge menu to show completed challenges
        const challengeItems = this.challengeMenu.querySelectorAll('.challenge-item');
        challengeItems.forEach(item => {
            const challengeId = parseInt(item.dataset.challengeId);
            const challenge = this.challenges.find(c => c.id === challengeId);
            if (challenge && challenge.completed) {
                item.style.backgroundColor = 'rgba(76, 175, 80, 0.3)';
                item.style.textDecoration = 'line-through';
            }
        });
    }

    showStoreMessage(name, message) {
        if (!this.dialogElement) return;

        this.dialogName.textContent = name;
        this.dialogMessage.textContent = message;
        this.dialogElement.style.display = 'block';
        
        // Hide the message after 3 seconds
        setTimeout(() => {
            this.hideDialog();
        }, 3000);
    }

    createDialogElement() {
        if (!this.dialogElement) {
            this.dialogElement = document.createElement('div');
            this.dialogElement.style.position = 'fixed';
            this.dialogElement.style.bottom = '20px';
            this.dialogElement.style.left = '50%';
            this.dialogElement.style.transform = 'translateX(-50%)';
            this.dialogElement.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
            this.dialogElement.style.color = 'white';
            this.dialogElement.style.padding = '15px 20px';
            this.dialogElement.style.borderRadius = '10px';
            this.dialogElement.style.fontFamily = 'Arial, sans-serif';
            this.dialogElement.style.display = 'none';
            this.dialogElement.style.maxWidth = '400px';
            this.dialogElement.style.textAlign = 'center';
            this.dialogElement.style.zIndex = '1000';
            
            // Add name label
            this.dialogName = document.createElement('div');
            this.dialogName.style.fontWeight = 'bold';
            this.dialogName.style.marginBottom = '5px';
            this.dialogName.style.color = '#4CAF50';
            this.dialogElement.appendChild(this.dialogName);
            
            // Add message container
            this.dialogMessage = document.createElement('div');
            this.dialogMessage.style.marginBottom = '10px';
            this.dialogElement.appendChild(this.dialogMessage);

            // Add chat input
            this.chatInput = document.createElement('input');
            this.chatInput.type = 'text';
            this.chatInput.placeholder = 'Type your message...';
            this.chatInput.style.width = '100%';
            this.chatInput.style.padding = '5px';
            this.chatInput.style.marginTop = '10px';
            this.chatInput.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
            this.chatInput.style.border = 'none';
            this.chatInput.style.borderRadius = '5px';
            this.chatInput.style.display = 'none';
            this.dialogElement.appendChild(this.chatInput);
            
            document.body.appendChild(this.dialogElement);

            // Add chat input handler
            this.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter' && this.currentNPC) {
                    const message = this.chatInput.value.trim();
                    if (message) {
                        this.handlePlayerMessage(message, this.currentNPC);
                        this.chatInput.value = '';
                    }
                }
            });
        }
    }

    handlePlayerMessage(message, npc) {
        message = message.toLowerCase();
        let response;

        if (npc.userData && npc.userData.isMainNPC) {
            // Character-specific responses
            switch (npc.userData.name) {
                case "Mrs. Wicket":
                    response = this.getMrsWicketResponse(message);
                    break;
                case "Irma Gobb":
                    response = this.getIrmaResponse(message);
                    break;
                case "Rupert":
                    response = this.getRupertResponse(message);
                    break;
                default:
                    response = this.getGenericResponse(message);
            }
        } else {
            response = this.getGenericResponse(message);
        }

        // Update dialog with response
        this.dialogMessage.textContent = response;

        // Play interaction sound
        if (this.soundEffectsEnabled && this.soundEffects && this.soundEffects.interact) {
            this.soundEffects.interact.play();
        }
    }

    getMrsWicketResponse(message) {
        if (message.includes('rent')) {
            return "Yes, yes, the rent! It's due on Friday, don't forget!";
        } else if (message.includes('cat') || message.includes('scrapper')) {
            return "Oh, have you seen my Scrapper? He's such a dear cat. Though he doesn't seem to like you much, Mr. Bean!";
        } else if (message.includes('noise') || message.includes('loud')) {
            return "The noise from your flat is absolutely dreadful! What are you doing up there?";
        } else if (message.includes('hello') || message.includes('hi')) {
            return "Good day, Mr. Bean. I hope you're not planning any of your usual shenanigans.";
        } else if (message.includes('sorry')) {
            return "Well, just try to be more careful next time, Mr. Bean.";
        } else {
            return "Hmph! Just make sure you keep the noise down and pay your rent on time!";
        }
    }

    getIrmaResponse(message) {
        if (message.includes('date')) {
            return "Oh, Mr. Bean! I thought you'd never ask. Shall we go to the restaurant?";
        } else if (message.includes('teddy')) {
            return "That teddy bear of yours... Sometimes I think you love it more than me!";
        } else if (message.includes('hello') || message.includes('hi')) {
            return "Hello, Mr. Bean! I was just thinking about you!";
        } else if (message.includes('gift') || message.includes('present')) {
            return "You remembered! Though last time you gave me a picture of yourself...";
        } else if (message.includes('love')) {
            return "Oh, Mr. Bean... *blushes* You're sweet when you want to be.";
        } else {
            return "We should go on another date soon, Mr. Bean!";
        }
    }

    getRupertResponse(message) {
        if (message.includes('noise')) {
            return "You're making too much noise again, Bean! I'm trying to get some peace and quiet!";
        } else if (message.includes('garden')) {
            return "Stay away from my garden, Bean! I saw what you did to my flowers last time!";
        } else if (message.includes('hello') || message.includes('hi')) {
            return "What do you want now, Bean?";
        } else if (message.includes('sorry')) {
            return "Hmph! You're always sorry after the fact, aren't you?";
        } else {
            return "Just keep your distance, Bean. I'm watching you!";
        }
    }

    getGenericResponse(message) {
        if (message.includes('hello') || message.includes('hi')) {
            return "Hello! Lovely day, isn't it?";
        } else if (message.includes('weather')) {
            return "Yes, typical British weather we're having!";
        } else if (message.includes('bean')) {
            return "Oh, you know Mr. Bean? Quite a peculiar fellow, isn't he?";
        } else if (message.includes('shop') || message.includes('store')) {
            return "The shops around here are quite nice. Have you tried the new café?";
        } else if (message.includes('car')) {
            return "That green Mini is always causing chaos around here!";
        } else {
            return "Oh, how interesting! Do tell me more about that.";
        }
    }

    showDialog(npc) {
        if (!this.dialogElement) return;

        // Store current NPC for chat interaction
        this.currentNPC = npc;

        let message;
        let name;

        if (npc.userData && npc.userData.isMainNPC) {
            // Use specific dialogs for main NPCs
            name = npc.userData.name;
            message = npc.userData.dialogs[Math.floor(Math.random() * npc.userData.dialogs.length)];
        } else {
            // Generic NPC dialogs
            name = "Citizen";
            const dialogs = [
                "Hello there! Lovely weather we're having.",
                "Good day! Have you seen Mr. Bean's teddy?",
                "Mind the road, dear! The traffic's been terrible.",
                "Fancy a cup of tea? The café's just around the corner.",
                "I heard there's a sale at the department store today!",
                "Lovely day for a walk in the park, isn't it?",
                "Have you tried the new bakery? Their scones are divine!"
            ];
            message = dialogs[Math.floor(Math.random() * dialogs.length)];
        }

        // Update dialog content
        this.dialogName.textContent = name;
        this.dialogMessage.textContent = message;
        
        // Show the dialog and chat input
        this.dialogElement.style.display = 'block';
        this.chatInput.style.display = 'block';
        this.chatInput.focus();
    }

    hideDialog() {
        if (this.dialogElement) {
            this.dialogElement.style.display = 'none';
            this.chatInput.style.display = 'none';
            this.currentNPC = null;
        }
    }

    createNPC() {
        const npcGroup = new THREE.Group();
        
        // Body - more human-like with torso
        const torsoGeometry = new THREE.BoxGeometry(0.4, 0.6, 0.3);
        const clothingMaterial = new THREE.MeshStandardMaterial({ 
            color: Math.random() > 0.5 ? 0x2c3e50 : 0x34495e // Dark suit colors
        });
        const torso = new THREE.Mesh(torsoGeometry, clothingMaterial);
        torso.position.y = 1.1;
        npcGroup.add(torso);

        // Legs
        const legGeometry = new THREE.BoxGeometry(0.15, 0.5, 0.15);
        [-0.1, 0.1].forEach(x => {
            const leg = new THREE.Mesh(legGeometry, clothingMaterial);
            leg.position.set(x, 0.5, 0);
            npcGroup.add(leg);
        });

        // Arms
        const armGeometry = new THREE.BoxGeometry(0.12, 0.4, 0.12);
        [-0.25, 0.25].forEach(x => {
            const arm = new THREE.Mesh(armGeometry, clothingMaterial);
            arm.position.set(x, 1.2, 0);
            npcGroup.add(arm);
        });

        // Head with more detail
        const headGroup = new THREE.Group();
        
        // Basic head shape
        const headGeometry = new THREE.SphereGeometry(0.15, 12, 12);
        const skinMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xf5d0c5,
            roughness: 0.7
        });
        const head = new THREE.Mesh(headGeometry, skinMaterial);
        headGroup.add(head);

        // Hair
        const hairGeometry = new THREE.SphereGeometry(0.16, 8, 8);
        const hairMaterial = new THREE.MeshStandardMaterial({ 
            color: Math.random() > 0.5 ? 0x4a2f23 : 0x2c1810,
            roughness: 1
        });
        const hair = new THREE.Mesh(hairGeometry, hairMaterial);
        hair.scale.set(1, 0.7, 1);
        hair.position.y = 0.05;
        headGroup.add(hair);

        // Eyes
        const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
        const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
        [-0.06, 0.06].forEach(x => {
            const eye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            eye.position.set(x, 0, 0.12);
            headGroup.add(eye);
        });

        headGroup.position.y = 1.5;
        npcGroup.add(headGroup);

        // Add random starting position within city bounds
        const randomPosition = () => (Math.random() - 0.5) * 80; // Keep within ±40 units
        npcGroup.position.set(randomPosition(), 0, randomPosition());

        // Add to scene
        this.scene.add(npcGroup);

        return npcGroup;
    }

    createWindow() {
        const windowGroup = new THREE.Group();
        
        // Window frame with toon material
        const frameGeometry = new THREE.BoxGeometry(1, 1.5, 0.1);
        const frameMaterial = new THREE.MeshToonMaterial({ 
            color: 0xFFFFFF,
            gradientMap: this.createToonGradient()
        });
        const frame = new THREE.Mesh(frameGeometry, frameMaterial);
        windowGroup.add(frame);

        // Window glass with cartoon effect
        const glassGeometry = new THREE.BoxGeometry(0.9, 1.4, 0.05);
        const glassMaterial = new THREE.MeshToonMaterial({
            color: 0x88CCFF,
            transparent: true,
            opacity: 0.6,
            gradientMap: this.createToonGradient()
        });
        const glass = new THREE.Mesh(glassGeometry, glassMaterial);
        glass.position.z = 0.02;
        windowGroup.add(glass);

        // Window divider (horizontal)
        const dividerGeometry = new THREE.BoxGeometry(0.9, 0.05, 0.1);
        const dividerMaterial = new THREE.MeshToonMaterial({ 
            color: 0xFFFFFF,
            gradientMap: this.createToonGradient()
        });
        const horizontalDivider = new THREE.Mesh(dividerGeometry, dividerMaterial);
        horizontalDivider.position.z = 0.02;
        windowGroup.add(horizontalDivider);

        // Window divider (vertical)
        const verticalDividerGeometry = new THREE.BoxGeometry(0.05, 1.4, 0.1);
        const verticalDivider = new THREE.Mesh(verticalDividerGeometry, dividerMaterial);
        verticalDivider.position.z = 0.02;
        windowGroup.add(verticalDivider);

        // Add window sill
        const sillGeometry = new THREE.BoxGeometry(1.2, 0.1, 0.2);
        const sillMaterial = new THREE.MeshToonMaterial({ 
            color: 0xCCCCCC,
            gradientMap: this.createToonGradient()
        });
        const sill = new THREE.Mesh(sillGeometry, sillMaterial);
        sill.position.y = -0.8;
        sill.position.z = 0.05;
        windowGroup.add(sill);

        return windowGroup;
    }

    createStore(type, position) {
        const storeGroup = new THREE.Group();
        
        // Store dimensions
        const width = 8;
        const height = 4;
        const depth = 8;
        
        // Create store building
        const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
        const buildingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0xE8BEAC,
            roughness: 0.8
        });
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = height / 2;
        storeGroup.add(building);

        // Create entrance
        const doorGeometry = new THREE.BoxGeometry(2, 3, 0.2);
        const doorMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x8B4513,
            metalness: 0.3
        });
        const door = new THREE.Mesh(doorGeometry, doorMaterial);
        door.position.set(0, 1.5, depth/2);
        storeGroup.add(door);

        // Add store name sign
        const signGeometry = new THREE.BoxGeometry(width * 0.8, 0.8, 0.2);
        const signMaterial = new THREE.MeshStandardMaterial({ color: 0x4A4A4A });
        const sign = new THREE.Mesh(signGeometry, signMaterial);
        sign.position.set(0, height + 0.5, depth/2 - 0.1);
        storeGroup.add(sign);

        // Create interior
        const interiorGroup = new THREE.Group();
        
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(width - 0.2, depth - 0.2);
        const floorMaterial = new THREE.MeshStandardMaterial({ color: 0xCCCCCC });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = 0.01;
        interiorGroup.add(floor);

        // Add shelves and products based on store type
        const shelfPositions = [
            [-2, 0, -2],
            [2, 0, -2],
            [-2, 0, 0],
            [2, 0, 0]
        ];

        shelfPositions.forEach(pos => {
            const shelf = this.createShelf(type);
            shelf.position.set(...pos);
            interiorGroup.add(shelf);
        });

        // Add counter
        const counter = this.createCounter();
        counter.position.set(0, 0, -3);
        interiorGroup.add(counter);

        storeGroup.add(interiorGroup);

        // Add collision box
        const collider = new THREE.Box3(
            new THREE.Vector3(-width/2, 0, -depth/2),
            new THREE.Vector3(width/2, height, depth/2)
        );
        storeGroup.collider = collider;
        storeGroup.isStore = true;
        storeGroup.type = type;

        // Position the store
        storeGroup.position.copy(position);
        
        // Mark as building for visibility handling
        storeGroup.isBuilding = true;
        
        return storeGroup;
    }

    createShelf(storeType) {
        const shelfGroup = new THREE.Group();
        
        // Shelf structure
        const shelfGeometry = new THREE.BoxGeometry(2, 2, 0.5);
        const shelfMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const shelf = new THREE.Mesh(shelfGeometry, shelfMaterial);
        shelf.position.y = 1;
        shelfGroup.add(shelf);

        // Add products based on store type
        const products = this.createProducts(storeType);
        products.position.y = 1;
        shelfGroup.add(products);

        return shelfGroup;
    }

    createProducts(storeType) {
        const productGroup = new THREE.Group();
        
        // Create different products based on store type
        const colors = {
            grocery: [0xff0000, 0x00ff00, 0xffff00],
            clothing: [0x0000ff, 0xff00ff, 0x00ffff],
            electronics: [0x888888, 0x444444, 0xcccccc]
        };

        const productColors = colors[storeType] || colors.grocery;
        
        for (let i = 0; i < 6; i++) {
            const productGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
            const productMaterial = new THREE.MeshStandardMaterial({ 
                color: productColors[i % 3],
                metalness: 0.3
            });
            const product = new THREE.Mesh(productGeometry, productMaterial);
            product.position.set(
                (Math.random() - 0.5) * 1.5,
                0.5,
                (Math.random() - 0.5) * 0.3
            );
            productGroup.add(product);
        }

        return productGroup;
    }

    createCounter() {
        const counterGroup = new THREE.Group();
        
        const counterGeometry = new THREE.BoxGeometry(3, 1, 0.8);
        const counterMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
        const counter = new THREE.Mesh(counterGeometry, counterMaterial);
        counter.position.y = 0.5;
        counterGroup.add(counter);

        // Add cash register
        const registerGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const registerMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 });
        const register = new THREE.Mesh(registerGeometry, registerMaterial);
        register.position.set(0, 1, 0);
        counterGroup.add(register);

        return counterGroup;
    }

    setupAudio() {
        try {
            // Create an audio listener
            this.listener = new THREE.AudioListener();
            this.camera.add(this.listener);

            // Create a global audio source for background music
            this.backgroundMusic = new THREE.Audio(this.listener);

            // Create sound effects
            this.soundEffects = {
                footsteps: new THREE.Audio(this.listener),
                doorOpen: new THREE.Audio(this.listener),
                interact: new THREE.Audio(this.listener)
            };

            // Create start screen
            this.createStartScreen();

            // Load audio files with error handling
            const audioLoader = new THREE.AudioLoader();
            const loadAudioFile = (path, onSuccess) => {
                console.log(`Loading audio: ${path}`);
                audioLoader.load(
                    path,
                    (buffer) => {
                        console.log(`Successfully loaded audio: ${path}`);
                        onSuccess(buffer);
                    },
                    (progress) => {
                        console.log(`Loading ${path}: ${(progress.loaded / progress.total * 100).toFixed(2)}%`);
                    },
                    (error) => {
                        console.warn(`Could not load audio file ${path}: ${error}`);
                    }
                );
            };

            // Load background music
            loadAudioFile('sounds/background_music.mp3', (buffer) => {
                this.backgroundMusic.setBuffer(buffer);
                this.backgroundMusic.setLoop(true);
                this.backgroundMusic.setVolume(0.5);
            });

            // Load sound effects
            loadAudioFile('sounds/footsteps.mp3', (buffer) => {
                this.soundEffects.footsteps.setBuffer(buffer);
                this.soundEffects.footsteps.setLoop(true);
                this.soundEffects.footsteps.setVolume(0.3);
            });

            loadAudioFile('sounds/door_open.mp3', (buffer) => {
                this.soundEffects.doorOpen.setBuffer(buffer);
                this.soundEffects.doorOpen.setVolume(0.4);
            });

            loadAudioFile('sounds/interact.mp3', (buffer) => {
                this.soundEffects.interact.setBuffer(buffer);
                this.soundEffects.interact.setVolume(0.4);
            });

            // Add audio controls with better feedback
            this.createAudioControls();

        } catch (error) {
            console.warn('Audio setup failed:', error);
            this.soundEffects = {
                footsteps: null,
                doorOpen: null,
                interact: null
            };
        }
    }

    createStartScreen() {
        const startScreen = document.createElement('div');
        startScreen.style.position = 'fixed';
        startScreen.style.top = '0';
        startScreen.style.left = '0';
        startScreen.style.width = '100%';
        startScreen.style.height = '100%';
        startScreen.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        startScreen.style.display = 'flex';
        startScreen.style.flexDirection = 'column';
        startScreen.style.alignItems = 'center';
        startScreen.style.justifyContent = 'center';
        startScreen.style.color = 'white';
        startScreen.style.fontFamily = 'Arial, sans-serif';
        startScreen.style.zIndex = '1000';

        const title = document.createElement('h1');
        title.textContent = 'Mr. Bean 3D Game';
        title.style.marginBottom = '20px';

        const startButton = document.createElement('button');
        startButton.textContent = 'Click to Start';
        startButton.style.padding = '15px 30px';
        startButton.style.fontSize = '20px';
        startButton.style.cursor = 'pointer';
        startButton.style.backgroundColor = '#4CAF50';
        startButton.style.border = 'none';
        startButton.style.borderRadius = '5px';
        startButton.style.color = 'white';

        startButton.onclick = () => {
            // Start background music
            if (this.backgroundMusic && this.backgroundMusic.buffer) {
                this.backgroundMusic.play();
            }
            // Enable sound effects
            this.soundEffectsEnabled = true;
            // Remove start screen
            document.body.removeChild(startScreen);
            // Play a test sound to verify audio is working
            if (this.soundEffects.interact && this.soundEffects.interact.buffer) {
                this.soundEffects.interact.play();
            }
        };

        startScreen.appendChild(title);
        startScreen.appendChild(startButton);
        document.body.appendChild(startScreen);
    }

    createAudioControls() {
        // Create the options menu container
        const optionsMenu = document.createElement('div');
        optionsMenu.style.position = 'fixed';
        optionsMenu.style.top = '50%';
        optionsMenu.style.left = '50%';
        optionsMenu.style.transform = 'translate(-50%, -50%)';
        optionsMenu.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
        optionsMenu.style.padding = '20px';
        optionsMenu.style.borderRadius = '10px';
        optionsMenu.style.color = 'white';
        optionsMenu.style.fontFamily = 'Arial, sans-serif';
        optionsMenu.style.zIndex = '1000';
        optionsMenu.style.minWidth = '300px';
        optionsMenu.style.display = 'none';

        // Add title
        const title = document.createElement('h2');
        title.textContent = 'Options';
        title.style.textAlign = 'center';
        title.style.marginBottom = '20px';
        optionsMenu.appendChild(title);

        // Create volume controls
        const createVolumeControl = (label, initialValue, onChange) => {
            const container = document.createElement('div');
            container.style.marginBottom = '15px';

            const labelElement = document.createElement('div');
            labelElement.textContent = label;
            labelElement.style.marginBottom = '5px';
            container.appendChild(labelElement);

            const sliderContainer = document.createElement('div');
            sliderContainer.style.display = 'flex';
            sliderContainer.style.alignItems = 'center';
            sliderContainer.style.gap = '10px';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = '0';
            slider.max = '100';
            slider.value = initialValue * 100;
            slider.style.flex = '1';

            const valueDisplay = document.createElement('span');
            valueDisplay.textContent = `${slider.value}%`;
            valueDisplay.style.minWidth = '45px';

            slider.oninput = () => {
                valueDisplay.textContent = `${slider.value}%`;
                onChange(slider.value / 100);
            };

            sliderContainer.appendChild(slider);
            sliderContainer.appendChild(valueDisplay);
            container.appendChild(sliderContainer);

            return container;
        };

        // Add music volume control
        optionsMenu.appendChild(createVolumeControl('Background Music Volume', 0.2, (value) => {
            if (this.backgroundMusic) {
                this.backgroundMusic.setVolume(value);
            }
        }));

        // Add sound effects volume control
        optionsMenu.appendChild(createVolumeControl('Sound Effects Volume', 0.3, (value) => {
            if (this.soundEffects) {
                Object.values(this.soundEffects).forEach(sound => {
                    if (sound) {
                        sound.setVolume(value);
                    }
                });
            }
        }));

        // Add close button
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.display = 'block';
        closeButton.style.margin = '20px auto 0';
        closeButton.style.padding = '8px 20px';
        closeButton.style.backgroundColor = '#4CAF50';
        closeButton.style.border = 'none';
        closeButton.style.borderRadius = '5px';
        closeButton.style.color = 'white';
        closeButton.style.cursor = 'pointer';
        closeButton.onclick = () => {
            optionsMenu.style.display = 'none';
        };
        optionsMenu.appendChild(closeButton);

        // Add to document
        document.body.appendChild(optionsMenu);
        this.optionsMenu = optionsMenu;

        // Add minimal audio controls to top-right
        const audioControls = document.createElement('div');
        audioControls.style.position = 'fixed';
        audioControls.style.top = '10px';
        audioControls.style.right = '10px';
        audioControls.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        audioControls.style.padding = '10px';
        audioControls.style.borderRadius = '5px';
        audioControls.style.color = 'white';
        audioControls.style.fontFamily = 'Arial, sans-serif';
        audioControls.style.zIndex = '1000';

        // Music toggle button
        const musicButton = document.createElement('button');
        musicButton.textContent = '🎵 Music: Off';
        musicButton.style.marginRight = '10px';
        musicButton.style.padding = '5px 10px';
        musicButton.onclick = () => {
            if (this.backgroundMusic && this.backgroundMusic.buffer) {
                if (this.backgroundMusic.isPlaying) {
                    this.backgroundMusic.pause();
                    musicButton.textContent = '🎵 Music: Off';
                    musicButton.style.backgroundColor = '#666';
                } else {
                    this.backgroundMusic.play();
                    musicButton.textContent = '🎵 Music: On';
                    musicButton.style.backgroundColor = '#4CAF50';
                }
            }
        };

        // Sound effects toggle button
        const sfxButton = document.createElement('button');
        sfxButton.textContent = '🔊 SFX: Off';
        sfxButton.style.padding = '5px 10px';
        sfxButton.onclick = () => {
            this.soundEffectsEnabled = !this.soundEffectsEnabled;
            sfxButton.textContent = this.soundEffectsEnabled ? '🔊 SFX: On' : '🔊 SFX: Off';
            sfxButton.style.backgroundColor = this.soundEffectsEnabled ? '#4CAF50' : '#666';
            if (this.soundEffectsEnabled && this.soundEffects.interact && this.soundEffects.interact.buffer) {
                this.soundEffects.interact.play();
            }
        };

        audioControls.appendChild(musicButton);
        audioControls.appendChild(sfxButton);
        document.body.appendChild(audioControls);
    }

    showInteractionMessage(name, message) {
        if (!this.dialogElement) return;

        this.dialogName.textContent = name;
        this.dialogMessage.textContent = message;
        this.dialogElement.style.display = 'block';
        
        // Hide the message after 2 seconds
        setTimeout(() => {
            this.hideDialog();
        }, 2000);
    }
}

// Start the game
new MrBeanGame(); 