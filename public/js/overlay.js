// public/js/overlay.js
// Variables globales
let ws = null;
let confetti = null;
let messageQueue = [];
let effectQueue = [];
let isProcessingMessage = false;
let isProcessingEffect = false;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  setupConfetti();
});

// Initialisation WebSocket
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?type=overlay`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('Connexion WebSocket établie');
  };
  
  ws.onclose = () => {
    console.log('Connexion WebSocket perdue. Tentative de reconnexion...');
    setTimeout(initWebSocket, 3000); // Tentative de reconnexion après 3s
  };
  
  ws.onerror = (error) => {
    console.error('Erreur WebSocket:', error);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Message reçu:', data);
      
      if (data.type === 'effect') {
        queueEffect(data.value);
      } else if (data.type === 'message') {
        queueMessage(data.value);
      }
    } catch (e) {
      console.error('Erreur de parsing WebSocket:', e, event.data);
    }
  };
}

// Configuration du confetti
// Configuration du confetti
function setupConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  
  // Check if ConfettiGenerator exists
  if (typeof ConfettiGenerator === 'undefined') {
    console.warn('ConfettiGenerator not found. Confetti effects will be disabled.');
    confetti = {
      render: () => console.log('Confetti render called but library not loaded'),
      clear: () => {}
    };
    return;
  }
  
  const confettiSettings = {
    target: canvas,
    max: 150,
    size: 1.5,
    animate: true,
    respawn: false,
    props: ['circle', 'square', 'triangle', 'line'],
    colors: [[165, 104, 246], [230, 61, 135], [0, 199, 228], [253, 214, 126]],
    clock: 25
  };
  
  confetti = new ConfettiGenerator(confettiSettings);
}

// Ajouter un message à la file d'attente
function queueMessage(message) {
  messageQueue.push(message);
  processMessageQueue();
}

// Ajouter un effet à la file d'attente
function queueEffect(effectType) {
  effectQueue.push(effectType);
  processEffectQueue();
}

// Traiter la file d'attente de messages
function processMessageQueue() {
  if (isProcessingMessage || messageQueue.length === 0) {
    return;
  }
  
  isProcessingMessage = true;
  const message = messageQueue.shift();
  showMessage(message);
  
  setTimeout(() => {
    isProcessingMessage = false;
    processMessageQueue();
  }, 5000); // Attendre 5 secondes entre les messages
}

// Traiter la file d'attente d'effets
function processEffectQueue() {
  if (isProcessingEffect || effectQueue.length === 0) {
    return;
  }
  
  isProcessingEffect = true;
  const effectType = effectQueue.shift();
  triggerEffect(effectType);
  
  setTimeout(() => {
    isProcessingEffect = false;
    processEffectQueue();
  }, 3000); // Attendre 3 secondes entre les effets
}

// Afficher un message
function showMessage(text) {
  const messageBox = document.getElementById('messageBox');
  
  // Réinitialiser les animations
  messageBox.classList.remove('message-show');
  void messageBox.offsetWidth; // Force reflow
  
  // Définir le contenu et lancer l'animation
  messageBox.textContent = text;
  messageBox.classList.add('message-show');
  
  // Supprimer l'animation après son exécution
  setTimeout(() => {
    messageBox.classList.remove('message-show');
    messageBox.textContent = '';
  }, 5000);
}

// Déclencher un effet
function triggerEffect(type) {
  const effectBox = document.getElementById('effectBox');
  const effectContent = document.getElementById('effectContent');
  
  // Réinitialiser les animations
  effectBox.className = '';
  void effectBox.offsetWidth; // Force reflow
  
  // Appliquer l'effet approprié
  switch (type) {
    case 'perturbation':
      triggerPerturbationEffect();
      break;
    case 'tada':
      effectContent.textContent = '✨ TADA ✨';
      effectBox.style.opacity = '1';
      effectContent.style.transform = 'scale(1)';
      effectContent.classList.add('tada');
      break;
      
    case 'flash':
      effectBox.classList.add('flash');
      break;
      
    case 'zoom':
      effectContent.textContent = '🔍 ZOOM 🔍';
      effectBox.style.opacity = '1';
      effectContent.classList.add('zoom');
      break;
      
    case 'shake':
      effectContent.textContent = '📳 SHAKE 📳';
      effectBox.style.opacity = '1';
      effectContent.classList.add('shake');
      break;
      
    case 'bounce':
      effectContent.textContent = '🏀 BOUNCE 🏀';
      effectBox.style.opacity = '1';
      effectContent.classList.add('bounce');
      break;
      
    case 'pulse':
      effectContent.textContent = '💓 PULSE 💓';
      effectBox.style.opacity = '1';
      effectContent.classList.add('pulse');
      break;
      
    default:
      effectContent.textContent = `✨ ${type.toUpperCase()} ✨`;
      effectBox.style.opacity = '1';
      effectContent.classList.add('fade');
  }
  
  // Si c'est un effet avec confetti
  if (type === 'tada') {
    confetti.render();
    
    setTimeout(() => {
      confetti.clear();
    }, 3000);
  }
  
  // Réinitialiser après la fin de l'animation
  setTimeout(() => {
    effectBox.className = '';
    effectBox.style.opacity = '0';
    effectContent.className = '';
    effectContent.textContent = '';
  }, 3000);
}

function triggerPerturbationEffect() {
  const effectImage = document.querySelector('.effect-image');
  const noise = document.querySelector('.noise');
  const waveOverlay1 = document.getElementById('waveOverlay1');
  const waveOverlay2 = document.getElementById('waveOverlay2');
  const waveOverlay3 = document.getElementById('waveOverlay3');

  noise.style.opacity = '0.15';
  waveOverlay1.style.opacity = '1';
  waveOverlay2.style.opacity = '1';
  waveOverlay3.style.opacity = '1';

  let startTime = Date.now();
  const duration = 5000;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const viewportDiagonal = Math.sqrt(vw * vw + vh * vh);
  const scaleBase = viewportDiagonal / Math.min(vw, vh);

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const entranceEased = 1 - Math.cos(progress * Math.PI / 2);
    const zTranslate = -3000 + entranceEased * 3000;

    effectImage.style.opacity = entranceEased * 0.3;

    const rotation = entranceEased * 90;

    const chaosTime = Date.now() * 0.005;
    const chaosScale = 1 + Math.sin(chaosTime * 3.3) * 0.05;
    const scale = scaleBase * (1.1 + chaosScale * 0.1);

    effectImage.style.transform = `
      scale(${scale})
      rotate(${rotation}deg)
      translateZ(${zTranslate}px)
    `;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      let fadeProgress = 1;
      const fadeInterval = setInterval(() => {
        fadeProgress -= 0.02;
        if (fadeProgress <= 0) {
          effectImage.style.opacity = '0';
          noise.style.opacity = '0';
          waveOverlay1.style.opacity = '0';
          waveOverlay2.style.opacity = '0';
          waveOverlay3.style.opacity = '0';
          clearInterval(fadeInterval);
        } else {
          effectImage.style.opacity = (fadeProgress * 0.3).toFixed(3);
          noise.style.opacity = (fadeProgress * 0.15).toFixed(3);
        }
      }, 30);
    }
  }

  requestAnimationFrame(animate);
}