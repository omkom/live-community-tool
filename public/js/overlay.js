// public/js/overlay.js - Version avec effets quantiques
let ws = null;
let confetti = null;
let messageQueue = [];
let effectQueue = [];
let isProcessingMessage = false;
let isProcessingEffect = false;

// Variables pour les effets quantiques
let butterflyEffectTimeout = null;
let currentButterflyStage = 0;

document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  setupConfetti();
  setupQuantumEffects();
});

function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?type=overlay`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('🔮 Connexion WebSocket quantique établie');
  };
  
  ws.onclose = () => {
    console.log('⚡ Connexion WebSocket perdue. Reconnexion quantique...');
    setTimeout(initWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('❌ Erreur WebSocket quantique:', error);
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('📡 Message quantique reçu:', data);
      
      if (data.type === 'effect') {
        queueEffect(data.value, data.data);
      } else if (data.type === 'message') {
        queueMessage(data.value);
      }
    } catch (e) {
      console.error('💥 Erreur parsing WebSocket quantique:', e, event.data);
    }
  };
}

function setupConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  
  if (typeof ConfettiGenerator === 'undefined') {
    console.warn('⚠️ ConfettiGenerator non trouvé. Effets confetti désactivés.');
    confetti = {
      render: () => console.log('🎊 Confetti render appelé mais librairie non chargée'),
      clear: () => {}
    };
    return;
  }
  
  const confettiSettings = {
    target: canvas,
    max: 200,
    size: 1.8,
    animate: true,
    respawn: false,
    props: ['circle', 'square', 'triangle', 'line'],
    colors: [[0, 255, 204], [255, 107, 107], [138, 43, 226], [255, 215, 0]],
    clock: 25
  };
  
  confetti = new ConfettiGenerator(confettiSettings);
}

function setupQuantumEffects() {
  // Initialiser les éléments pour les effets quantiques
  const container = document.getElementById('overlay-container');
  
  // Zone de texte quantique pour les citations et questions
  const quantumText = document.createElement('div');
  quantumText.id = 'quantum-text-zone';
  quantumText.className = 'quantum-text-zone';
  container.appendChild(quantumText);
  
  // Zone de notification quantique
  const quantumNotif = document.createElement('div');
  quantumNotif.id = 'quantum-notification';
  quantumNotif.className = 'quantum-notification';
  container.appendChild(quantumNotif);
  
  console.log('🔮 Effets quantiques initialisés');
}

function queueMessage(message) {
  messageQueue.push(message);
  processMessageQueue();
}

function queueEffect(effectType, effectData = null) {
  effectQueue.push({ type: effectType, data: effectData });
  processEffectQueue();
}

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
  }, 5000);
}

function processEffectQueue() {
  if (isProcessingEffect || effectQueue.length === 0) {
    return;
  }
  
  isProcessingEffect = true;
  const effect = effectQueue.shift();
  triggerEffect(effect.type, effect.data);
  
  // Délai adaptatif selon le type d'effet
  const delays = {
    quantum_collapse: 8000,
    temporal_rewind: 6000,
    cognitive_collapse: 10000,
    butterfly_effect: 2000, // Plus court car effet de 5 minutes
    quantum_consciousness: 7000
  };
  
  const delay = delays[effect.type] || 3000;
  
  setTimeout(() => {
    isProcessingEffect = false;
    processEffectQueue();
  }, delay);
}

function showMessage(text) {
  const messageBox = document.getElementById('messageBox');
  
  messageBox.classList.remove('message-show');
  void messageBox.offsetWidth;
  
  messageBox.textContent = text;
  messageBox.classList.add('message-show');
  
  setTimeout(() => {
    messageBox.classList.remove('message-show');
    messageBox.textContent = '';
  }, 5000);
}

function triggerEffect(type, data = null) {
  console.log(`🎭 Déclenchement effet quantique: ${type}`, data);
  
  switch (type) {
    // NOUVEAUX EFFETS QUANTIQUES
    case 'quantum_collapse':
      triggerQuantumCollapse(data);
      break;
      
    case 'temporal_rewind':
      triggerTemporalRewind(data);
      break;
      
    case 'cognitive_collapse':
      triggerCognitiveCollapse(data);
      break;
      
    case 'butterfly_effect':
      triggerButterflyEffect(data);
      break;
      
    case 'quantum_consciousness':
      triggerQuantumConsciousness(data);
      break;
    
    // EFFETS CLASSIQUES CONSERVÉS
    case 'perturbation':
      triggerPerturbationEffect();
      break;
      
    case 'tada':
      triggerTadaEffect();
      break;
      
    case 'flash':
      triggerFlashEffect();
      break;
      
    case 'pulse':
      triggerPulseEffect();
      break;
      
    default:
      triggerDefaultEffect(type);
  }
}

// ===== NOUVEAUX EFFETS QUANTIQUES =====

function triggerQuantumCollapse(data) {
  const quantumNotif = document.getElementById('quantum-notification');
  const quantumText = document.getElementById('quantum-text-zone');
  
  // Animation d'effondrement de la fonction d'onde
  quantumNotif.innerHTML = `
    <div class="quantum-wave-collapse">
      <div class="wave-equation">Ψ = Σ|n⟩</div>
      <div class="collapse-arrow">⬇️</div>
      <div class="collapsed-state">📡 QUESTION INSTANTANÉE</div>
    </div>
  `;
  
  quantumNotif.classList.add('quantum-collapse-animation');
  
  // Afficher la demande
  setTimeout(() => {
    quantumText.innerHTML = `
      <div class="quantum-question-demand">
        <h2>🔮 EFFONDREMENT DE LA FONCTION D'ONDE</h2>
        <p class="urgent-demand">RÉPONSE INSTANTANÉE REQUISE !</p>
        <p class="question-prompt">Une question va être posée dans le chat...</p>
        <div class="quantum-timer">⏰ 3... 2... 1...</div>
      </div>
    `;
    quantumText.classList.add('quantum-text-active');
  }, 1500);
  
  // Nettoyage
  setTimeout(() => {
    quantumNotif.classList.remove('quantum-collapse-animation');
    quantumText.classList.remove('quantum-text-active');
    quantumNotif.innerHTML = '';
    quantumText.innerHTML = '';
  }, 8000);
}

function triggerTemporalRewind(data) {
  const effectBox = document.getElementById('effectBox');
  const effectContent = document.getElementById('effectContent');
  
  // Effet de rewind temporel
  effectContent.innerHTML = `
    <div class="temporal-rewind-effect">
      <div class="time-symbols">⏳ 🌀 ⏰</div>
      <div class="rewind-text">RECUL TEMPOREL LOCALISÉ</div>
      <div class="rewind-instruction">Répète ta dernière phrase !</div>
      <div class="time-wave">〰️〰️〰️</div>
    </div>
  `;
  
  effectBox.style.opacity = '1';
  effectBox.classList.add('temporal-rewind');
  
  // Animation spéciale de rewind
  document.body.style.filter = 'hue-rotate(180deg)';
  
  setTimeout(() => {
    document.body.style.filter = 'hue-rotate(0deg)';
  }, 1000);
  
  setTimeout(() => {
    effectBox.classList.remove('temporal-rewind');
    effectBox.style.opacity = '0';
    effectContent.innerHTML = '';
  }, 6000);
}

function triggerCognitiveCollapse(data) {
  const quantumText = document.getElementById('quantum-text-zone');
  
  quantumText.innerHTML = `
    <div class="cognitive-collapse-effect">
      <div class="brain-icon">🧠</div>
      <h2 class="collapse-title">COLLAPSE COGNITIF</h2>
      <div class="instruction">
        <p>📚➡️👶 Explique un concept complexe</p>
        <p class="detail">comme si tu parlais à un enfant de 5 ans</p>
      </div>
      <div class="concept-examples">
        💫 Physique quantique • 🌌 Relativité • 🧬 ADN • 🤖 IA
      </div>
    </div>
  `;
  
  quantumText.classList.add('cognitive-collapse-active');
  
  setTimeout(() => {
    quantumText.classList.remove('cognitive-collapse-active');
    quantumText.innerHTML = '';
  }, 10000);
}

function triggerButterflyEffect(data) {
  const container = document.getElementById('overlay-container');
  
  // Annonce de l'effet papillon
  const notification = document.getElementById('quantum-notification');
  notification.innerHTML = `
    <div class="butterfly-announcement">
      🦋 EFFET PAPILLON ACTIVÉ 🦋
      <div class="mutation-text">Mutation visuelle en cours...</div>
    </div>
  `;
  notification.classList.add('butterfly-notification');
  
  // Démarrer les mutations visuelles pour 5 minutes
  startButterflyMutations();
  
  setTimeout(() => {
    notification.classList.remove('butterfly-notification');
    notification.innerHTML = '';
  }, 5000);
}

function startButterflyMutations() {
  currentButterflyStage = 1;
  const duration = 5 * 60 * 1000; // 5 minutes
  const stages = 15; // 15 changements sur 5 minutes
  const stageInterval = duration / stages;
  
  const mutations = [
    () => document.body.style.filter = 'hue-rotate(45deg)',
    () => document.body.style.filter = 'sepia(0.5) hue-rotate(180deg)',
    () => document.body.style.filter = 'invert(0.1) saturate(1.5)',
    () => document.body.style.filter = 'contrast(1.2) brightness(1.1)',
    () => document.body.style.filter = 'hue-rotate(270deg) saturate(0.8)',
    () => document.body.style.transform = 'scale(1.02) rotate(0.5deg)',
    () => document.body.style.filter = 'blur(0.5px) hue-rotate(90deg)',
    () => document.body.style.filter = 'grayscale(0.3) hue-rotate(315deg)',
    () => { 
      document.body.style.filter = 'none';
      document.body.style.transform = 'none';
    }
  ];
  
  butterflyEffectTimeout = setInterval(() => {
    if (currentButterflyStage <= stages) {
      const mutationIndex = (currentButterflyStage - 1) % mutations.length;
      mutations[mutationIndex]();
      currentButterflyStage++;
    } else {
      // Retour à la normale
      document.body.style.filter = 'none';
      document.body.style.transform = 'none';
      clearInterval(butterflyEffectTimeout);
      
      // Notification de fin
      const notification = document.getElementById('quantum-notification');
      notification.innerHTML = '🦋 Effet Papillon terminé - Retour à la normale';
      notification.classList.add('butterfly-end');
      
      setTimeout(() => {
        notification.classList.remove('butterfly-end');
        notification.innerHTML = '';
      }, 3000);
    }
  }, stageInterval);
}

function triggerQuantumConsciousness(data) {
  const quantumText = document.getElementById('quantum-text-zone');
  
  // Citations mystérieuses prédéfinies en cas de données manquantes
  const mysticalQuotes = [
    "« Dans le silence des étoiles, l'âme trouve sa vraie voix. »",
    "« Nous sommes tous des poussières d'étoiles cherchant la lumière. »",
    "« Le temps n'est qu'une illusion, l'éternité est notre vraie demeure. »",
    "« Dans chaque goutte d'eau se reflète l'océan infini. »",
    "« La conscience est le miroir dans lequel l'univers se contemple. »"
  ];
  
  const randomQuote = mysticalQuotes[Math.floor(Math.random() * mysticalQuotes.length)];
  const displayQuote = data?.userInput || randomQuote;
  
  quantumText.innerHTML = `
    <div class="quantum-consciousness-effect">
      <div class="consciousness-symbols">🧿 ✨ 🌌</div>
      <h2 class="consciousness-title">CONSCIENCE QUANTIQUE</h2>
      <div class="mystical-quote">
        <div class="quote-marks">❝</div>
        <p class="quote-text">${displayQuote}</p>
        <div class="quote-marks">❞</div>
      </div>
      <div class="cosmic-elements">⭐ 🌙 ♾️ 🔮</div>
    </div>
  `;
  
  quantumText.classList.add('quantum-consciousness-active');
  
  setTimeout(() => {
    quantumText.classList.remove('quantum-consciousness-active');
    quantumText.innerHTML = '';
  }, 7000);
}

// ===== EFFETS CLASSIQUES SIMPLIFIÉS =====

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

  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);

    const entranceEased = 1 - Math.cos(progress * Math.PI / 2);
    effectImage.style.opacity = entranceEased * 0.3;

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      effectImage.style.opacity = '0';
      noise.style.opacity = '0';
      waveOverlay1.style.opacity = '0';
      waveOverlay2.style.opacity = '0';
      waveOverlay3.style.opacity = '0';
    }
  }

  requestAnimationFrame(animate);
}

function triggerTadaEffect() {
  const effectBox = document.getElementById('effectBox');
  const effectContent = document.getElementById('effectContent');
  
  effectContent.textContent = '✨ TADA ✨';
  effectBox.style.opacity = '1';
  effectContent.classList.add('tada');
  
  if (confetti) {
    confetti.render();
    setTimeout(() => confetti.clear(), 3000);
  }
  
  setTimeout(() => {
    effectBox.style.opacity = '0';
    effectContent.classList.remove('tada');
    effectContent.textContent = '';
  }, 3000);
}

function triggerFlashEffect() {
  const effectBox = document.getElementById('effectBox');
  effectBox.classList.add('flash');
  
  setTimeout(() => {
    effectBox.classList.remove('flash');
  }, 1000);
}

function triggerPulseEffect() {
  const effectBox = document.getElementById('effectBox');
  const effectContent = document.getElementById('effectContent');
  
  effectContent.textContent = '💓 PULSE 💓';
  effectBox.style.opacity = '1';
  effectContent.classList.add('pulse');
  
  setTimeout(() => {
    effectBox.style.opacity = '0';
    effectContent.classList.remove('pulse');
    effectContent.textContent = '';
  }, 3000);
}

function triggerDefaultEffect(type) {
  const effectBox = document.getElementById('effectBox');
  const effectContent = document.getElementById('effectContent');
  
  effectContent.textContent = `✨ ${type.toUpperCase()} ✨`;
  effectBox.style.opacity = '1';
  effectContent.classList.add('fade');
  
  setTimeout(() => {
    effectBox.style.opacity = '0';
    effectContent.classList.remove('fade');
    effectContent.textContent = '';
  }, 3000);
}