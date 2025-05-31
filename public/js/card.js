 // Math utilities - exact from repo
 const round = (value, precision = 3) => parseFloat(value.toFixed(precision));
 const clamp = (value, min = 0, max = 100) => Math.min(Math.max(value, min), max);
 const adjust = (value, fromMin, fromMax, toMin, toMax) => {
     return round(toMin + (toMax - toMin) * (value - fromMin) / (fromMax - fromMin));
 };

 // Spring animation system - simplified version of Svelte springs
 class Spring {
     constructor(initialValue, config = {}) {
         this.value = initialValue;
         this.target = initialValue;
         this.velocity = typeof initialValue === 'object' ? 
             Object.keys(initialValue).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}) : 0;
         this.stiffness = config.stiffness || 0.066;
         this.damping = config.damping || 0.25;
         this.precision = config.precision || 0.001;
         this.subscribers = [];
         this.running = false;
     }

     set(target, options = {}) {
         this.target = target;
         if (options.hard) {
             this.value = target;
             this.velocity = typeof target === 'object' ? 
                 Object.keys(target).reduce((acc, key) => ({ ...acc, [key]: 0 }), {}) : 0;
             this.notify();
             return;
         }
         
         if (options.stiffness) this.stiffness = options.stiffness;
         if (options.damping) this.damping = options.damping;
         
         if (!this.running) {
             this.running = true;
             this.tick();
         }
     }

     tick() {
         if (typeof this.value === 'object') {
             let settled = true;
             const newValue = {};
             const newVelocity = {};
             
             for (const key in this.value) {
                 const spring_force = (this.target[key] - this.value[key]) * this.stiffness;
                 const damping_force = this.velocity[key] * this.damping;
                 const acceleration = spring_force - damping_force;
                 
                 newVelocity[key] = this.velocity[key] + acceleration;
                 newValue[key] = this.value[key] + newVelocity[key];
                 
                 if (Math.abs(newVelocity[key]) > this.precision || 
                     Math.abs(this.target[key] - newValue[key]) > this.precision) {
                     settled = false;
                 }
             }
             
             this.value = newValue;
             this.velocity = newVelocity;
             
             if (settled) {
                 this.value = { ...this.target };
                 this.velocity = Object.keys(this.target).reduce((acc, key) => ({ ...acc, [key]: 0 }), {});
                 this.running = false;
             }
         } else {
             const spring_force = (this.target - this.value) * this.stiffness;
             const damping_force = this.velocity * this.damping;
             const acceleration = spring_force - damping_force;
             
             this.velocity += acceleration;
             this.value += this.velocity;
             
             if (Math.abs(this.velocity) <= this.precision && 
                 Math.abs(this.target - this.value) <= this.precision) {
                 this.value = this.target;
                 this.velocity = 0;
                 this.running = false;
             }
         }
         
         this.notify();
         
         if (this.running) {
             requestAnimationFrame(() => this.tick());
         }
     }

     subscribe(callback) {
         this.subscribers.push(callback);
         callback(this.value);
         return () => {
             const index = this.subscribers.indexOf(callback);
             if (index !== -1) this.subscribers.splice(index, 1);
         };
     }

     notify() {
         this.subscribers.forEach(callback => callback(this.value));
     }
 }

 // Card interaction system
 class CardInteraction {
     constructor(cardElement) {
         this.card = cardElement;
         this.rotator = cardElement.querySelector('.card__rotator');
         this.isInteracting = false;
         this.isActive = false;
         
         // Spring configurations - exact from repo
         const springInteractSettings = { stiffness: 0.066, damping: 0.25 };
         const springPopoverSettings = { stiffness: 0.033, damping: 0.45 };
         
         // Initialize springs
         this.springRotate = new Spring({ x: 0, y: 0 }, springInteractSettings);
         this.springGlare = new Spring({ x: 50, y: 50, o: 0 }, springInteractSettings);
         this.springBackground = new Spring({ x: 50, y: 50 }, springInteractSettings);
         this.springRotateDelta = new Spring({ x: 0, y: 0 }, springPopoverSettings);
         this.springTranslate = new Spring({ x: 0, y: 0 }, springPopoverSettings);
         this.springScale = new Spring(1, springPopoverSettings);
         
         this.setupEventListeners();
         this.setupSpringSubscriptions();
     }
     
     setupEventListeners() {
         this.rotator.addEventListener('pointermove', (e) => this.interact(e));
         this.rotator.addEventListener('mousemove', (e) => this.interact(e));
         this.rotator.addEventListener('mouseout', () => this.interactEnd());
         this.rotator.addEventListener('mouseleave', () => this.interactEnd());
         this.rotator.addEventListener('touchmove', (e) => this.interact(e));
         this.rotator.addEventListener('touchend', () => this.interactEnd());
     }
     
     setupSpringSubscriptions() {
         // Subscribe to spring changes and update CSS variables
         this.springRotate.subscribe(value => {
             this.updateCSSVar('--rotate-x', `${value.x}deg`);
             this.updateCSSVar('--rotate-y', `${value.y}deg`);
         });
         
         this.springGlare.subscribe(value => {
             this.updateCSSVar('--pointer-x', `${value.x}%`);
             this.updateCSSVar('--pointer-y', `${value.y}%`);
             this.updateCSSVar('--card-opacity', value.o);
         });
         
         this.springBackground.subscribe(value => {
             this.updateCSSVar('--background-x', `${value.x}%`);
             this.updateCSSVar('--background-y', `${value.y}%`);
         });
         
         this.springScale.subscribe(value => {
             this.updateCSSVar('--card-scale', value);
         });
         
         this.springTranslate.subscribe(value => {
             this.updateCSSVar('--translate-x', `${value.x}px`);
             this.updateCSSVar('--translate-y', `${value.y}px`);
         });
     }
     
     updateCSSVar(property, value) {
         this.card.style.setProperty(property, value);
     }
     
     interact(e) {
         if (!this.card.classList.contains('interactive')) return;
         
         this.isInteracting = true;
         this.card.classList.add('interacting');
         
         if (e.type === "touchmove") {
             e.clientX = e.touches[0].clientX;
             e.clientY = e.touches[0].clientY;
         }

         const rect = this.rotator.getBoundingClientRect();
         const absolute = {
             x: e.clientX - rect.left,
             y: e.clientY - rect.top,
         };
         
         const percent = {
             x: clamp(round((100 / rect.width) * absolute.x)),
             y: clamp(round((100 / rect.height) * absolute.y)),
         };
         
         const center = {
             x: percent.x - 50,
             y: percent.y - 50,
         };

         // Calculate pointer from center - exact formula from repo
         const pointerFromCenter = clamp(Math.sqrt(
             (percent.y - 50) * (percent.y - 50) + 
             (percent.x - 50) * (percent.x - 50)
         ) / 50, 0, 1);

         // Update CSS variables immediately for smooth interaction
         this.updateCSSVar('--pointer-from-center', pointerFromCenter);
         this.updateCSSVar('--pointer-from-top', percent.y / 100);
         this.updateCSSVar('--pointer-from-left', percent.x / 100);

         // Update springs with exact calculations from repo
         this.springBackground.set({
             x: adjust(percent.x, 0, 100, 37, 63),
             y: adjust(percent.y, 0, 100, 33, 67),
         });
         
         this.springRotate.set({
             x: round(-(center.x / 3.5)),
             y: round(center.y / 2),
         });
         
         this.springGlare.set({
             x: round(percent.x),
             y: round(percent.y),
             o: 1,
         });
     }
     
     interactEnd(delay = 500) {
         setTimeout(() => {
             this.isInteracting = false;
             this.card.classList.remove('interacting');
             
             const snapStiff = 0.01;
             const snapDamp = 0.06;
             
             // Reset springs with snap settings - exact from repo
             this.springRotate.stiffness = snapStiff;
             this.springRotate.damping = snapDamp;
             this.springRotate.set({ x: 0, y: 0 }, { soft: 1 });

             this.springGlare.stiffness = snapStiff;
             this.springGlare.damping = snapDamp;
             this.springGlare.set({ x: 50, y: 50, o: 0 }, { soft: 1 });

             this.springBackground.stiffness = snapStiff;
             this.springBackground.damping = snapDamp;
             this.springBackground.set({ x: 50, y: 50 }, { soft: 1 });
             
             // Reset CSS variables
             this.updateCSSVar('--pointer-from-center', 0);
             this.updateCSSVar('--pointer-from-top', 0.5);
             this.updateCSSVar('--pointer-from-left', 0.5);
         }, delay);
     }
 }

 // Auto demo system
 class AutoDemo {
     constructor(cards) {
         this.cards = cards;
         this.isRunning = false;
         this.intervals = [];
     }
     
     start() {
         if (this.isRunning) return;
         this.isRunning = true;
         
         this.cards.forEach((cardInteraction, index) => {
             const card = cardInteraction.card;
             card.classList.remove('interactive');
             
             // Create unique animation for each card
             const interval = setInterval(() => {
                 const time = Date.now() * 0.001 + index * 2; // Offset each card
                 const x = 50 + Math.sin(time * 0.5) * 40;
                 const y = 50 + Math.cos(time * 0.7) * 40;
                 const rotateX = Math.sin(time * 0.3) * 20;
                 const rotateY = Math.cos(time * 0.4) * 15;
                 
                 const pointerFromCenter = Math.abs(Math.sin(time * 0.6)) * 0.8 + 0.2;
                 
                 cardInteraction.updateCSSVar('--pointer-x', `${x}%`);
                 cardInteraction.updateCSSVar('--pointer-y', `${y}%`);
                 cardInteraction.updateCSSVar('--background-x', `${x}%`);
                 cardInteraction.updateCSSVar('--background-y', `${y}%`);
                 cardInteraction.updateCSSVar('--rotate-x', `${rotateX}deg`);
                 cardInteraction.updateCSSVar('--rotate-y', `${rotateY}deg`);
                 cardInteraction.updateCSSVar('--card-opacity', 0.8);
                 cardInteraction.updateCSSVar('--pointer-from-center', pointerFromCenter);
                 cardInteraction.updateCSSVar('--pointer-from-top', y / 100);
                 cardInteraction.updateCSSVar('--pointer-from-left', x / 100);
             }, 16); // ~60fps
             
             this.intervals.push(interval);
         });
     }
     
     stop() {
         if (!this.isRunning) return;
         this.isRunning = false;
         
         this.intervals.forEach(clearInterval);
         this.intervals = [];
         
         this.cards.forEach(cardInteraction => {
             const card = cardInteraction.card;
             card.classList.add('interactive');
             cardInteraction.interactEnd(0);
         });
     }
 }

 // Initialize everything
 document.addEventListener('DOMContentLoaded', () => {
     const cardElements = document.querySelectorAll('.card');
     const cardInteractions = Array.from(cardElements).map(card => new CardInteraction(card));
     const autoDemo = new AutoDemo(cardInteractions);
     
     const interactiveBtn = document.getElementById('interactiveBtn');
     const autoBtn = document.getElementById('autoBtn');
     
     interactiveBtn.addEventListener('click', () => {
         autoDemo.stop();
         interactiveBtn.classList.add('active');
         autoBtn.classList.remove('active');
     });
     
     autoBtn.addEventListener('click', () => {
         autoDemo.start();
         autoBtn.classList.add('active');
         interactiveBtn.classList.remove('active');
     });

     // Initial state
     console.log('🎴 Pokemon Cards CSS Demo Loaded!');
     console.log('💫 Hover over cards for holographic effects');
     console.log('🎮 Toggle between Interactive and Auto Demo modes');
 });