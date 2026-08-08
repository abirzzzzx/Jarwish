/**
 * JARVIS AI Assistant - Interactive 3D Sphere
 * Using Three.js for WebGL rendering
 */

class JarvisSphere {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.options = {
            particleCount: options.particleCount || 1500,
            ringCount: options.ringCount || 3,
            performanceMode: options.performanceMode || 'balanced',
            reducedMotion: options.reducedMotion || false
        };
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.sphere = null;
        this.particles = null;
        this.rings = [];
        this.core = null;
        
        this.state = 'IDLE'; // IDLE, LISTENING, THINKING, SPEAKING
        this.mouseX = 0;
        this.mouseY = 0;
        this.targetRotationX = 0;
        this.targetRotationY = 0;
        this.isDragging = false;
        this.previousMouseX = 0;
        this.previousMouseY = 0;
        
        this.animationFrame = null;
        this.clock = new THREE.Clock();
        
        this.init();
        this.createSphere();
        this.createParticles();
        this.createRings();
        this.createCore();
        this.setupInteractions();
        this.animate();
    }
    
    init() {
        // Scene
        this.scene = new THREE.Scene();
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 3;
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        const pointLight1 = new THREE.PointLight(0x00d4ff, 1, 100);
        pointLight1.position.set(5, 5, 5);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0x0099cc, 0.8, 100);
        pointLight2.position.set(-5, -5, 5);
        this.scene.add(pointLight2);
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }
    
    createSphere() {
        // Main sphere geometry - higher detail for smoother appearance
        const geometry = new THREE.IcosahedronGeometry(1, 6);
        
        // Create a custom shader material for the sphere with advanced effects
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                color: { value: new THREE.Color(0x00d4ff) },
                glowColor: { value: new THREE.Color(0x0099cc) },
                intensity: { value: 0.5 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                uniform float time;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    
                    // Smooth wave displacement
                    float displacement = sin(time * 1.5 + position.y * 2.0) * 0.015;
                    displacement += cos(time * 0.8 + position.x * 1.5) * 0.01;
                    vec3 newPosition = position + normal * displacement;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                uniform float time;
                uniform vec3 color;
                uniform vec3 glowColor;
                uniform float intensity;
                
                void main() {
                    // Advanced fresnel effect
                    vec3 viewDirection = normalize(vec3(0.0, 0.0, 1.0));
                    float fresnel = dot(vNormal, viewDirection);
                    fresnel = clamp(1.0 - fresnel, 0.0, 1.0);
                    fresnel = pow(fresnel, 1.5);
                    
                    // Animated color shift
                    vec3 animatedColor = mix(color, glowColor, sin(time * 0.5) * 0.2 + 0.5);
                    vec3 finalColor = mix(animatedColor, glowColor, fresnel * 0.6);
                    float alpha = 0.25 + fresnel * intensity;
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.sphere = new THREE.Mesh(geometry, material);
        this.scene.add(this.sphere);
        
        // Multiple glass layers for depth
        for (let i = 0; i < 3; i++) {
            const glassGeometry = new THREE.IcosahedronGeometry(1.15 + i * 0.1, 4);
            const glassMaterial = new THREE.MeshPhongMaterial({
                color: i === 0 ? 0x00d4ff : 0x0099cc,
                transparent: true,
                opacity: 0.08 - i * 0.02,
                shininess: 100,
                specular: 0x00d4ff,
                side: THREE.DoubleSide
            });
            
            const glassSphere = new THREE.Mesh(glassGeometry, glassMaterial);
            glassSphere.rotation.x = i * 0.3;
            this.sphere.add(glassSphere);
        }
    }
    
    createParticles() {
        const count = this.getParticleCount();
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        const sizes = new Float32Array(count);
        
        for (let i = 0; i < count; i++) {
            // Distribute particles in a spherical shell
            const radius = 1.5 + Math.random() * 2;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Colors
            const colorChoice = Math.random();
            if (colorChoice > 0.5) {
                colors[i * 3] = 0;
                colors[i * 3 + 1] = 0.83;
                colors[i * 3 + 2] = 1;
            } else {
                colors[i * 3] = 0;
                colors[i * 3 + 1] = 0.6;
                colors[i * 3 + 2] = 0.8;
            }
            
            sizes[i] = Math.random() * 2;
        }
        
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    getParticleCount() {
        switch (this.options.performanceMode) {
            case 'high': return 2500;
            case 'low': return 500;
            default: return 1500;
        }
    }
    
    createRings() {
        const ringColors = [0x00d4ff, 0x0099cc, 0x006699];
        
        for (let i = 0; i < this.options.ringCount; i++) {
            const ringGeometry = new THREE.TorusGeometry(
                1.3 + i * 0.15,
                0.01,
                16,
                100
            );
            
            const ringMaterial = new THREE.MeshBasicMaterial({
                color: ringColors[i % ringColors.length],
                transparent: true,
                opacity: 0.3,
                blending: THREE.AdditiveBlending
            });
            
            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2 + (i * 0.3);
            ring.rotation.y = i * 0.5;
            
            this.rings.push(ring);
            this.scene.add(ring);
        }
    }
    
    createCore() {
        const coreGeometry = new THREE.SphereGeometry(0.3, 32, 32);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: 0x00d4ff,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.core = new THREE.Mesh(coreGeometry, coreMaterial);
        this.scene.add(this.core);
    }
    
    setupInteractions() {
        // Mouse/Touch events for rotation
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.onMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.onMouseUp());
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', () => this.onMouseUp());
        
        // Scroll to zoom
        this.canvas.addEventListener('wheel', (e) => this.onScroll(e), { passive: false });
    }
    
    onMouseDown(event) {
        this.isDragging = true;
        this.previousMouseX = event.clientX;
        this.previousMouseY = event.clientY;
    }
    
    onMouseMove(event) {
        if (!this.isDragging) return;
        
        const deltaX = event.clientX - this.previousMouseX;
        const deltaY = event.clientY - this.previousMouseY;
        
        this.targetRotationY += deltaX * 0.005;
        this.targetRotationX += deltaY * 0.005;
        
        this.previousMouseX = event.clientX;
        this.previousMouseY = event.clientY;
    }
    
    onMouseUp() {
        this.isDragging = false;
    }
    
    onTouchStart(event) {
        if (event.touches.length === 1) {
            this.isDragging = true;
            this.previousMouseX = event.touches[0].clientX;
            this.previousMouseY = event.touches[0].clientY;
        }
        event.preventDefault();
    }
    
    onTouchMove(event) {
        if (!this.isDragging || event.touches.length !== 1) return;
        
        const deltaX = event.touches[0].clientX - this.previousMouseX;
        const deltaY = event.touches[0].clientY - this.previousMouseY;
        
        this.targetRotationY += deltaX * 0.005;
        this.targetRotationX += deltaY * 0.005;
        
        this.previousMouseX = event.touches[0].clientX;
        this.previousMouseY = event.touches[0].clientY;
        
        event.preventDefault();
    }
    
    onScroll(event) {
        event.preventDefault();
        
        this.camera.position.z += event.deltaY * 0.005;
        this.camera.position.z = Math.max(2, Math.min(6, this.camera.position.z));
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    setState(state) {
        this.state = state;
        
        // Update sphere appearance based on state
        if (this.sphere && this.sphere.material) {
            const uniforms = this.sphere.material.uniforms;
            
            switch (state) {
                case 'IDLE':
                    uniforms.intensity.value = 0.5;
                    break;
                case 'LISTENING':
                    uniforms.intensity.value = 0.8;
                    break;
                case 'THINKING':
                    uniforms.intensity.value = 1.0;
                    break;
                case 'SPEAKING':
                    uniforms.intensity.value = 0.9;
                    break;
            }
        }
        
        // Update status indicator
        this.updateStatusIndicator(state);
    }
    
    updateStatusIndicator(state) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const statusSubtitle = document.getElementById('status-subtitle');
        
        if (!statusDot) return;
        
        statusDot.className = 'status-dot';
        
        switch (state) {
            case 'IDLE':
                statusText.textContent = 'ONLINE';
                statusSubtitle.textContent = 'How can I help?';
                break;
            case 'LISTENING':
                statusDot.classList.add('listening');
                statusText.textContent = 'LISTENING';
                statusSubtitle.textContent = 'Speak now...';
                break;
            case 'THINKING':
                statusDot.classList.add('thinking');
                statusText.textContent = 'THINKING';
                statusSubtitle.textContent = 'Processing...';
                break;
            case 'SPEAKING':
                statusDot.classList.add('speaking');
                statusText.textContent = 'SPEAKING';
                statusSubtitle.textContent = '';
                break;
            case 'ERROR':
                statusDot.classList.add('error');
                statusText.textContent = 'ERROR';
                statusSubtitle.textContent = 'Connection issue';
                break;
        }
    }
    
    animate() {
        this.animationFrame = requestAnimationFrame(() => this.animate());
        
        const elapsed = this.clock.getElapsedTime();
        
        if (this.options.reducedMotion) {
            this.renderer.render(this.scene, this.camera);
            return;
        }
        
        // Update sphere shader time
        if (this.sphere && this.sphere.material.uniforms) {
            this.sphere.material.uniforms.time.value = elapsed;
        }
        
        // Smooth rotation
        if (!this.isDragging) {
            const baseSpeed = this.getStateSpeed();
            this.sphere.rotation.y += baseSpeed * 0.01;
            this.sphere.rotation.x += baseSpeed * 0.005;
        }
        
        // Apply drag rotation with smoothing
        this.sphere.rotation.y += (this.targetRotationY - this.sphere.rotation.y) * 0.05;
        this.sphere.rotation.x += (this.targetRotationX - this.sphere.rotation.x) * 0.05;
        
        // Animate rings
        this.rings.forEach((ring, index) => {
            const speed = this.getStateSpeed() * (index + 1) * 0.2;
            ring.rotation.z += speed * 0.01;
            ring.rotation.x += speed * 0.005;
        });
        
        // Animate particles
        if (this.particles) {
            this.particles.rotation.y += 0.001;
            this.particles.rotation.x += 0.0005;
            
            // Pulse particles based on state
            const pulse = Math.sin(elapsed * this.getStatePulseSpeed()) * 0.2 + 0.8;
            this.particles.scale.setScalar(pulse);
        }
        
        // Animate core
        if (this.core) {
            this.core.rotation.y += 0.02;
            const coreScale = 1 + Math.sin(elapsed * 3) * 0.1 * this.getStateIntensity();
            this.core.scale.setScalar(coreScale);
        }
        
        this.renderer.render(this.scene, this.camera);
    }
    
    getStateSpeed() {
        switch (this.state) {
            case 'LISTENING': return 2;
            case 'THINKING': return 3;
            case 'SPEAKING': return 2.5;
            default: return 1;
        }
    }
    
    getStatePulseSpeed() {
        switch (this.state) {
            case 'LISTENING': return 2;
            case 'THINKING': return 4;
            case 'SPEAKING': return 3;
            default: return 1;
        }
    }
    
    getStateIntensity() {
        switch (this.state) {
            case 'LISTENING': return 1.2;
            case 'THINKING': return 1.5;
            case 'SPEAKING': return 1.3;
            default: return 1;
        }
    }
    
    setPerformanceMode(mode) {
        this.options.performanceMode = mode;
        this.rebuildParticles();
    }
    
    setReducedMotion(enabled) {
        this.options.reducedMotion = enabled;
    }
    
    rebuildParticles() {
        if (this.particles) {
            this.scene.remove(this.particles);
            this.particles.geometry.dispose();
        }
        this.createParticles();
    }
    
    dispose() {
        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }
        
        this.scene.traverse((object) => {
            if (object.geometry) {
                object.geometry.dispose();
            }
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(m => m.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        this.renderer.dispose();
    }
}

// Export for use in app.js
window.JarvisSphere = JarvisSphere;
