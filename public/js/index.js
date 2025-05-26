// public/js/index.js - Optimized for the 24h stream timeline
// Variables globales
let ws = null;
let planningData = [];
let statusData = null;
let streamStartTime = null;
let lastRenderTime = 0;
const RENDER_THROTTLE_MS = 5000;
let userScrollTimeout;
let isUserScrolling = false;

// Types d'événements et leurs couleurs
const EVENT_TYPES = {
  'Sport': { color: '#4CAF50', icon: 'fas fa-running' },
  'Cuisine': { color: '#FF9800', icon: 'fas fa-utensils' },
  'Jeu': { color: '#9C27B0', icon: 'fas fa-gamepad' },
  'Talk': { color: '#2196F3', icon: 'fas fa-comments' },
  'SIESTE': { color: '#795548', icon: 'fas fa-bed' },
  'Création': { color: '#E91E63', icon: 'fas fa-paint-brush' },
  'Podcast': { color: '#607D8B', icon: 'fas fa-microphone' },
  'Radio': { color: '#00BCD4', icon: 'fas fa-broadcast-tower' },
  'Défi': { color: '#F44336', icon: 'fas fa-trophy' },
  'Discussion': { color: '#3F51B5', icon: 'fas fa-users' },
  'Réveil': { color: '#FFEB3B', icon: 'fas fa-coffee' },
  'Clôture': { color: '#9E9E9E', icon: 'fas fa-flag-checkered' },
  'default': { color: '#00ffcc', icon: 'fas fa-calendar-check' }
};

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
  initWebSocket();
  loadPlanning();
  loadStatus();
  startClock();
  initScrollHandlers();
  
  // Gestion du redimensionnement pour responsive design
  window.addEventListener('resize', debounce(() => {
    renderTimeline(false);
  }, 250));
});

// Initialisation des gestionnaires de scroll
function initScrollHandlers() {
  const timeline = document.getElementById('timeline');
  
  if (timeline) {
    // Détecter quand l'utilisateur scrolle
    timeline.addEventListener('scroll', () => {
      isUserScrolling = true;
      
      // Réinitialiser le flag après 10 secondes d'inactivité
      clearTimeout(userScrollTimeout);
      userScrollTimeout = setTimeout(() => {
        isUserScrolling = false;
        // Revenir à l'élément actuel après l'inactivité
        autoScrollToCurrentItem();
      }, 10000);
    });
  }
}

// Fonction pour gérer le scroll automatique de la timeline
function autoScrollToCurrentItem() {
  if (isUserScrolling) return;
  
  const timeline = document.getElementById('timeline');
  const currentItem = document.querySelector('.timeline-item.current');
  
  if (!timeline || !currentItem) return;
  
  // Récupérer les positions
  const timelineRect = timeline.getBoundingClientRect();
  const itemRect = currentItem.getBoundingClientRect();
  
  // Calculer la position relative de l'élément dans le conteneur
  const itemTop = currentItem.offsetTop;
  const timelineHeight = timeline.clientHeight;
  
  // Position cible : garder l'élément actuel à 30% du haut de la zone visible
  const targetPosition = itemTop - (timelineHeight * 0.3);
  
  // Vérifier si l'élément est déjà dans la zone visible optimale
  const itemRelativeTop = itemRect.top - timelineRect.top;
  const isInOptimalZone = itemRelativeTop > (timelineHeight * 0.2) && 
                          itemRelativeTop < (timelineHeight * 0.4);
  
  // Ne scroller que si nécessaire
  if (!isInOptimalZone) {
    timeline.scrollTo({
      top: targetPosition,
      behavior: 'smooth'
    });
  }
}

// Fonction debounce pour éviter trop d'appels
function debounce(func, wait) {
  let timeout;
  return function() {
    const context = this, args = arguments;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

// Détecter le type d'événement à partir du libellé
function detectEventType(label) {
  const labelLower = label.toLowerCase();
  for (const [type, config] of Object.entries(EVENT_TYPES)) {
    if (labelLower.includes(type.toLowerCase())) {
      return type;
    }
  }
  return 'default';
}

// Obtenir la configuration pour un type d'événement
function getEventConfig(label) {
  const type = detectEventType(label);
  return EVENT_TYPES[type] || EVENT_TYPES.default;
}

// Initialisation WebSocket avec reconnexion automatique
function initWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}?type=viewer`;
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('Connexion WebSocket établie');
    updateConnectionStatus('connected');
  };
  
  ws.onclose = () => {
    console.log('Connexion WebSocket perdue. Tentative de reconnexion...');
    updateConnectionStatus('disconnected');
    setTimeout(initWebSocket, 3000);
  };
  
  ws.onerror = (error) => {
    console.error('Erreur WebSocket:', error);
    updateConnectionStatus('error');
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Message reçu:', data);
      
      if (data.type === 'update') {
        if (data.target === 'planning') {
          loadPlanning();
        } else if (data.target === 'status') {
          loadStatus();
        }
      } else if (data.type === 'effect') {
        triggerEffect(data.value);
      } else if (data.type === 'message') {
        showMessage(data.value);
      }
    } catch (e) {
      console.error('Erreur de parsing WebSocket:', e, event.data);
    }
  };
}

// Mise à jour visuelle de l'état de la connexion
function updateConnectionStatus(status) {
  const statusIndicator = document.getElementById('connection-status');
  if (!statusIndicator) return;
  
  statusIndicator.className = `connection-status ${status}`;
  
  switch (status) {
    case 'connected':
      statusIndicator.title = 'Connecté au serveur';
      break;
    case 'disconnected':
      statusIndicator.title = 'Déconnecté du serveur';
      break;
    case 'error':
      statusIndicator.title = 'Erreur de connexion';
      break;
  }
}

// Chargement du planning
function loadPlanning() {
  fetch('/api/planning')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      planningData = data.planning || [];
      renderTimeline(true);
    })
    .catch(error => {
      console.error('Erreur lors du chargement du planning:', error);
      showMessage('Erreur de chargement du planning. Rechargez la page.', 'error');
    });
}

// Rendu de la timeline avec optimisation de performances
function renderTimeline(forceRender = false) {
  const now = Date.now();
  
  // Ne pas redessiner la timeline complète trop souvent sauf si forcé
  if (!forceRender && now - lastRenderTime < RENDER_THROTTLE_MS) {
    updateTimeIndicator();
    updateCurrentStatus();
    return;
  }
  
  lastRenderTime = now;
  
  const timeline = document.getElementById('timeline');
  if (!timeline) return;
  
  // Sauvegarder la position de scroll actuelle
  const currentScroll = timeline.scrollTop;
  
  timeline.innerHTML = '<div class="timeline-line"></div>';
  
  if (planningData.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'timeline-empty';
    empty.textContent = 'Aucun élément dans le planning pour le moment.';
    timeline.appendChild(empty);
    return;
  }
  
  // Trier les éléments par heure
  const sortedData = [...planningData].sort((a, b) => a.time.localeCompare(b.time));
  
  // Déterminer les bornes de temps pour la journée (min et max)
  let minTimeInMinutes = 24 * 60;
  let maxTimeInMinutes = 0;
  
  sortedData.forEach(item => {
    const [hours, minutes] = item.time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    
    if (timeInMinutes < minTimeInMinutes) minTimeInMinutes = timeInMinutes;
    if (timeInMinutes > maxTimeInMinutes) maxTimeInMinutes = timeInMinutes;
  });
  
  // Ajouter des marges pour éviter que le premier et le dernier événement soient collés aux bords
  minTimeInMinutes = Math.max(0, minTimeInMinutes - 60);
  maxTimeInMinutes = Math.min(24 * 60, maxTimeInMinutes + 240);
  
  // Durée totale en minutes
  const totalDurationInMinutes = maxTimeInMinutes - minTimeInMinutes;
  
  // Créer le conteneur des marqueurs d'heures
  const hourMarkers = document.createElement('div');
  hourMarkers.className = 'hour-markers';
  timeline.appendChild(hourMarkers);
  
  // Ajouter les marqueurs d'heures pour chaque heure
  for (let hour = 0; hour <= 24; hour++) {
    const hourInMinutes = hour * 60;
    
    // Ne pas afficher les heures hors de la plage visible
    if (hourInMinutes < minTimeInMinutes || hourInMinutes > maxTimeInMinutes) continue;
    
    // Calculer la position verticale en pourcentage
    const positionPercentage = ((hourInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
    
    // Créer le marqueur d'heure
    const hourMarker = document.createElement('div');
    hourMarker.className = 'hour-marker';
    hourMarker.style.top = `${positionPercentage}%`;
    
    // Créer l'étiquette d'heure
    const hourLabel = document.createElement('div');
    hourLabel.className = 'hour-marker-label';
    hourLabel.textContent = `${hour.toString().padStart(2, '0')}:00`;
    hourMarker.appendChild(hourLabel);
    
    hourMarkers.appendChild(hourMarker);
  }
  
  // Calculer l'heure actuelle
  const dateNow = new Date();
  const currentHour = dateNow.getHours();
  const currentMinute = dateNow.getMinutes();
  const currentTimeInMinutes = currentHour * 60 + currentMinute;
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  // Ajouter l'indicateur d'heure actuelle avec animation fluide
  if (currentTimeInMinutes >= minTimeInMinutes && currentTimeInMinutes <= maxTimeInMinutes) {
    // Calculer la position verticale en pourcentage
    const positionPercentage = ((currentTimeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
    
    // Créer l'indicateur de temps actuel
    const timeIndicator = document.createElement('div');
    timeIndicator.className = 'current-time-indicator';
    timeIndicator.id = 'current-time-indicator';
    timeIndicator.style.top = `${positionPercentage}%`;
    
    // Créer le label de temps actuel
    const timeLabel = document.createElement('div');
    timeLabel.className = 'current-time-label';
    timeLabel.id = 'current-time-label';
    timeLabel.textContent = currentTimeStr;
    timeLabel.style.top = `${positionPercentage}%`;
    
    timeline.appendChild(timeIndicator);
    timeline.appendChild(timeLabel);
  }
  
  // Trouver l'élément actuel ou prochain
  let currentIndex = -1;
  let nextIndex = -1;
  
  for (let i = 0; i < sortedData.length; i++) {
    const itemTime = sortedData[i].time;
    
    if (itemTime <= currentTimeStr) {
      if (!sortedData[i].checked) {
        currentIndex = i;
      }
    } else if (nextIndex === -1) {
      nextIndex = i;
    }
  }
  
  // Afficher les éléments du planning avec coloration selon le type
  sortedData.forEach((item, index) => {
    // Calculer la position verticale en pourcentage
    const [hours, minutes] = item.time.split(':').map(Number);
    const timeInMinutes = hours * 60 + minutes;
    const positionPercentage = ((timeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
    
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    timelineItem.dataset.index = index;
    
    // Détecter le type d'événement et appliquer coloration
    const eventConfig = getEventConfig(item.label);
    
    // Ajouter la classe gauche/droite en alternance
    if (index % 2 === 0) {
      timelineItem.classList.add('left');
    } else {
      timelineItem.classList.add('right');
    }
    
    // Ajouter les classes d'état
    if (item.checked) {
      timelineItem.classList.add('done');
    } else if (index === currentIndex) {
      timelineItem.classList.add('current');
    } else if (index === nextIndex) {
      timelineItem.classList.add('next');
    }
    
    // Positionner l'élément par le haut à l'horaire exact
    timelineItem.style.top = `${positionPercentage}%`;
    
    // Créer le contenu de l'élément
    const timelineContent = document.createElement('div');
    timelineContent.className = 'timeline-content';
    
    // Appliquer la couleur spécifique au type d'événement
    if (index === currentIndex) {
      timelineContent.style.borderColor = '#ff3300';
      timelineContent.style.boxShadow = `0 0 15px ${eventConfig.color}`;
    } else {
      if (timelineItem.classList.contains('left')) {
        timelineContent.style.borderRightColor = eventConfig.color;
      } else {
        timelineContent.style.borderLeftColor = eventConfig.color;
      }
    }
    
    // Créer un conteneur pour l'heure et le titre (sur la même ligne)
    const contentHeader = document.createElement('div');
    contentHeader.className = 'timeline-content-header';
    
    // Créer l'icône d'heure avec le bon type d'événement
    const timeSpan = document.createElement('span');
    timeSpan.className = 'timeline-time';
    
    // Ajouter une icône selon le statut et le type
    const icon = document.createElement('i');
    if (item.checked) {
      icon.className = 'fas fa-check-circle';
    } else if (index === currentIndex) {
      icon.className = 'fas fa-play-circle';
    } else {
      icon.className = eventConfig.icon;
    }
    
    icon.style.color = eventConfig.color;
    
    timeSpan.appendChild(icon);
    timeSpan.appendChild(document.createTextNode(` ${item.time}`));
    
    // Créer le titre de l'événement
    const titleSpan = document.createElement('span');
    titleSpan.className = 'timeline-title';
    titleSpan.textContent = item.label;
    
    // Ajouter un badge d'état si nécessaire
    if (index === currentIndex) {
      const badge = document.createElement('span');
      badge.className = 'badge current';
      badge.textContent = 'EN COURS';
      titleSpan.appendChild(document.createTextNode(' '));
      titleSpan.appendChild(badge);
    } else if (index === nextIndex) {
      const badge = document.createElement('span');
      badge.className = 'badge next';
      badge.textContent = 'À SUIVRE';
      titleSpan.appendChild(document.createTextNode(' '));
      titleSpan.appendChild(badge);
    }
    
    // Assembler le header (heure + titre)
    contentHeader.appendChild(timeSpan);
    contentHeader.appendChild(titleSpan);
    
    // Assembler le contenu
    timelineContent.appendChild(contentHeader);
    
    timelineItem.appendChild(timelineContent);
    timeline.appendChild(timelineItem);
  });
  
  // Stocker les informations de temps pour les mises à jour
  timeline.dataset.minTime = minTimeInMinutes;
  timeline.dataset.maxTime = maxTimeInMinutes;
  timeline.dataset.duration = totalDurationInMinutes;
  
  // Mettre à jour le statut actuel/à venir
  updateCurrentStatus(sortedData, currentIndex, nextIndex);
  
  // Restaurer la position de scroll ou auto-scroll vers l'élément actuel
  if (forceRender && !isUserScrolling) {
    setTimeout(autoScrollToCurrentItem, 100);
  } else {
    timeline.scrollTop = currentScroll;
  }
}

// Fonction pour mettre à jour uniquement l'indicateur de temps
function updateTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSecond / 60);
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  const timeIndicator = document.getElementById('current-time-indicator');
  const timeLabel = document.getElementById('current-time-label');
  
  if (timeIndicator && timeLabel) {
    // Récupérer les bornes de temps depuis data attributes
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    
    const minTimeInMinutes = parseInt(timeline.dataset.minTime || 0);
    const totalDurationInMinutes = parseInt(timeline.dataset.duration || (24 * 60));
    
    if (totalDurationInMinutes > 0) {
      const positionPercentage = ((currentTimeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
      
      // Ne mettre à jour que si l'indicateur est dans la plage visible
      if (positionPercentage >= 0 && positionPercentage <= 100) {
        // Utiliser CSS transition pour une animation fluide
        timeIndicator.style.transition = 'top 1s linear';
        timeLabel.style.transition = 'top 1s linear';
        
        timeIndicator.style.top = `${positionPercentage}%`;
        timeLabel.style.top = `${positionPercentage}%`;
        timeLabel.textContent = currentTimeStr;
      }
    }
  }
}

// Fonction pour mettre à jour uniquement l'indicateur de temps
function updateTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentSecond = now.getSeconds();
  const currentTimeInMinutes = currentHour * 60 + currentMinute + (currentSecond / 60);
  const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
  
  const timeIndicator = document.getElementById('current-time-indicator');
  const timeLabel = document.getElementById('current-time-label');
  
  if (timeIndicator && timeLabel) {
    // Récupérer les bornes de temps depuis data attributes
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    
    const minTimeInMinutes = parseInt(timeline.dataset.minTime || 0);
    const totalDurationInMinutes = parseInt(timeline.dataset.duration || (24 * 60));
    
    if (totalDurationInMinutes > 0) {
      const positionPercentage = ((currentTimeInMinutes - minTimeInMinutes) / totalDurationInMinutes) * 100;
      
      // Ne mettre à jour que si l'indicateur est dans la plage visible
      if (positionPercentage >= 0 && positionPercentage <= 100) {
        // Utiliser CSS transition pour une animation fluide
        timeIndicator.style.transition = 'top 1s linear';
        timeLabel.style.transition = 'top 1s linear';
        
        timeIndicator.style.top = `${positionPercentage}%`;
        timeLabel.style.top = `${positionPercentage}%`;
        timeLabel.textContent = currentTimeStr;
      }
    }
  }
  
  // Vérifier si on doit mettre à jour l'élément actuel
  checkAndUpdateCurrentItem();
}

// Fonction pour vérifier et mettre à jour l'élément actuel
function checkAndUpdateCurrentItem() {
  const now = new Date();
  const currentTimeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  let hasChanged = false;
  
  // Parcourir tous les éléments pour mettre à jour les classes
  document.querySelectorAll('.timeline-item').forEach((item, index) => {
    const wasCurrentOrNext = item.classList.contains('current') || item.classList.contains('next');
    
    // Retirer les classes actuelles
    item.classList.remove('current', 'next');
    
    // Réappliquer les bonnes classes selon l'heure
    const itemTime = planningData[item.dataset.index]?.time;
    if (itemTime && !planningData[item.dataset.index].checked) {
      if (itemTime <= currentTimeStr) {
        // C'est potentiellement l'élément actuel
        let isCurrentItem = true;
        
        // Vérifier s'il n'y a pas d'élément non-coché plus récent
        for (let i = index + 1; i < planningData.length; i++) {
          if (planningData[i].time <= currentTimeStr && !planningData[i].checked) {
            isCurrentItem = false;
            break;
          }
        }
        
        if (isCurrentItem) {
          item.classList.add('current');
          if (!wasCurrentOrNext) hasChanged = true;
        }
      } else {
        // Vérifier si c'est le prochain élément
        let isNextItem = true;
        
        // Vérifier qu'il n'y a pas d'élément non-coché avant
        for (let i = 0; i < index; i++) {
          if (planningData[i].time > currentTimeStr && !planningData[i].checked) {
            isNextItem = false;
            break;
          }
        }
        
        if (isNextItem) {
          // C'est le premier élément après l'heure actuelle
          item.classList.add('next');
          if (!wasCurrentOrNext) hasChanged = true;
          return; // On a trouvé le prochain, on peut arrêter
        }
      }
    }
  });
  
  // Si l'élément actuel a changé, faire un auto-scroll
  if (hasChanged) {
    setTimeout(autoScrollToCurrentItem, 100);
    updateCurrentStatus();
  }
}

// Mettre à jour le statut actuel/à venir
function updateCurrentStatus(sortedData, currentIndex, nextIndex) {
  if (!sortedData) {
    if (!planningData || planningData.length === 0) return;
    
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeStr = `${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}`;
    
    // Trier les éléments par heure
    sortedData = [...planningData].sort((a, b) => a.time.localeCompare(b.time));
    
    // Trouver l'élément actuel ou prochain
    currentIndex = -1;
    nextIndex = -1;
    
    for (let i = 0; i < sortedData.length; i++) {
      const itemTime = sortedData[i].time;
      
      if (itemTime <= currentTimeStr) {
        if (!sortedData[i].checked) {
          currentIndex = i;
        }
      } else if (nextIndex === -1) {
        nextIndex = i;
      }
    }
  }

  // Mettre à jour le bloc "En cours" et "À suivre"
  const statusBlock = document.getElementById('status-block');
  if (statusBlock) {
    statusBlock.innerHTML = ''; // Réinitialiser le contenu

    if (currentIndex !== -1) {
      const nowPlaying = document.createElement('div');
      nowPlaying.className = 'now-playing';
      const eventConfig = getEventConfig(sortedData[currentIndex].label);

      nowPlaying.innerHTML = `
        <i class="${eventConfig.icon}" style="color: ${eventConfig.color};"></i>
        <span>EN COURS : ${sortedData[currentIndex].label}</span>
      `;
      statusBlock.appendChild(nowPlaying);
    }

    if (nextIndex !== -1) {
      const comingUp = document.createElement('div');
      comingUp.className = 'coming-up';
      const eventConfig = getEventConfig(sortedData[nextIndex].label);

      comingUp.innerHTML = `
        <i class="${eventConfig.icon}" style="color: ${eventConfig.color};"></i>
        <span>À SUIVRE : ${sortedData[nextIndex].label} (${sortedData[nextIndex].time})</span>
      `;
      statusBlock.appendChild(comingUp);
    }
  }
}

// Chargement du statut
function loadStatus() {
  fetch('/api/status')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Erreur HTTP ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      statusData = data;
      updateStatusDisplay();
    })
    .catch(error => {
      console.error('Erreur lors du chargement du statut:', error);
    });
}

/*
// Mise à jour de l'affichage du statut
function updateStatusDisplay() {
  if (!statusData) return;
  
  // Récupérer les éléments DOM
  const donationCurrent = document.getElementById('donation-current');
  const donationGoal = document.getElementById('donation-goal');
  const donationProgress = document.getElementById('donation-progress');
  const subsCurrent = document.getElementById('subs-current');
  const subsGoal = document.getElementById('subs-goal');
  const subsProgress = document.getElementById('subs-progress');
  
  if (!donationCurrent || !donationGoal || !donationProgress || !subsCurrent || !subsGoal || !subsProgress) {
    return;
  }
  
  // Animation des changements de valeur
  const animateDonationChange = donationCurrent.textContent !== statusData.donation_total.toString();
  const animateSubsChange = subsCurrent.textContent !== statusData.subs_total.toString();
  
  // Mettre à jour les valeurs avec animations
  if (animateDonationChange) {
    animateValue(donationCurrent, parseInt(donationCurrent.textContent) || 0, statusData.donation_total, 1000);
  } else {
    donationCurrent.textContent = statusData.donation_total;
  }
  
  if (animateSubsChange) {
    animateValue(subsCurrent, parseInt(subsCurrent.textContent) || 0, statusData.subs_total, 1000);
  } else {
    subsCurrent.textContent = statusData.subs_total;
  }
  
  donationGoal.textContent = statusData.donation_goal;
  subsGoal.textContent = statusData.subs_goal;
  
  // Calculer les pourcentages
  const donationPercent = Math.min(100, Math.round((statusData.donation_total / statusData.donation_goal) * 100));
  const subsPercent = Math.min(100, Math.round((statusData.subs_total / statusData.subs_goal) * 100));
  
  // Mettre à jour les barres de progression avec animation
  donationProgress.style.width = `${donationPercent}%`;
  subsProgress.style.width = `${subsPercent}%`;
  
  // Ajouter une animation si changement
  if (animateDonationChange) {
    const section = donationProgress.closest('.progress-section');
    section.classList.remove('pulse-animation');
    void section.offsetWidth; // Force reflow
    section.classList.add('pulse-animation');
  }
  
  if (animateSubsChange) {
    const section = subsProgress.closest('.progress-section');
    section.classList.remove('pulse-animation');
    void section.offsetWidth; // Force reflow
    section.classList.add('pulse-animation');
  }
  
  // Mettre à jour l'heure de début du stream si elle existe
  if (statusData.stream_start_time) {
    streamStartTime = new Date(statusData.stream_start_time);
  } else if (!streamStartTime) {
    // Si pas d'heure de début dans le fichier de statut, utiliser minuit du jour actuel
    streamStartTime = new Date();
    streamStartTime.setHours(0, 0, 0, 0);
  }
}
*/

// Mise à jour de l'affichage du statut
function updateStatusDisplay() {
  if (!statusData) return;
  
  // Mettre à jour l'heure de début du stream si elle existe
  if (statusData.stream_start_time) {
    streamStartTime = new Date(statusData.stream_start_time);
  } else if (!streamStartTime) {
    // Si pas d'heure de début dans le fichier de statut, utiliser minuit du jour actuel
    streamStartTime = new Date();
    streamStartTime.setHours(0, 0, 0, 0);
  }
}

/*
// Animation des valeurs numériques
function animateValue(obj, start, end, duration) {
  if (start === end) return;
  const range = end - start;
  const minFrames = 20;
  let stepCount = Math.abs(Math.floor(duration / 16));
  stepCount = Math.max(stepCount, minFrames);
  const step = range / stepCount;
  const increment = end > start ? step : -step;
  const startTimestamp = performance.now();
  
  function animate(timestamp) {
    const elapsed = timestamp - startTimestamp;
    const progress = Math.min(elapsed / duration, 1);
    const currentValue = Math.floor(start + (range * progress));
    
    obj.textContent = currentValue;
    if (progress < 1) {
      window.requestAnimationFrame(animate);
    } else {
      obj.textContent = end;
    }
  }
  
  window.requestAnimationFrame(animate);
}
*/

// Horloge du stream avec animation fluide
function startClock() {
  const updateClock = () => {
    const now = new Date();
    
    // Si l'heure de début du stream n'est pas définie, l'initialiser à minuit
    if (!streamStartTime) {
      streamStartTime = new Date();
      streamStartTime.setHours(0, 0, 0, 0);
    }
    
    // Calculer la différence entre maintenant et l'heure de début du stream
    const diff = now - streamStartTime;
    
    // Calculer heures, minutes, secondes écoulées
    const hours = Math.floor(diff / (1000 * 60 * 60)).toString().padStart(2, '0');
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
    const seconds = Math.floor((diff % (1000 * 60)) / 1000).toString().padStart(2, '0');
    
    const streamTimeElement = document.getElementById('stream-time');
    if (streamTimeElement) {
      streamTimeElement.textContent = `${hours}:${minutes}:${seconds}`;
    }
    
    // Mettre à jour l'indicateur de temps chaque seconde pour une animation fluide
    updateTimeIndicator();
    
    // Mettre à jour le statut actuel/à venir toutes les 10 secondes
    if (parseInt(seconds) % 10 === 0) {
      updateCurrentStatus();
    }
    
    // Auto-scroll toutes les 30 secondes
    if (parseInt(seconds) % 30 === 0) {
      autoScrollToCurrentItem();
    }
    
    // Rendez complet de la timeline chaque minute pour être sûr
    if (seconds === '00') {
      renderTimeline(true);
    }
  };
  
  updateClock();
  setInterval(updateClock, 1000);
  
  // Auto-scroll initial après un court délai
  setTimeout(autoScrollToCurrentItem, 500);
}

// Déclencher un effet visuel (appelé via WebSocket)
function triggerEffect(type) {
  // Créer un élément d'effet
  const effectBox = document.createElement('div');
  effectBox.className = `effect-box effect-${type}`;
  
  // Contenu de l'effet selon le type
  const content = document.createElement('div');
  content.className = 'effect-content';
  
  switch (type) {
    case 'tada':
      content.innerHTML = '<i class="fas fa-star"></i> TADA <i class="fas fa-star"></i>';
      break;
    case 'flash':
      content.innerHTML = '<i class="fas fa-bolt"></i> FLASH';
      break;
    case 'zoom':
      content.innerHTML = '<i class="fas fa-search-plus"></i> ZOOM';
      break;
    case 'shake':
      content.innerHTML = '<i class="fas fa-dizzy"></i> SHAKE';
      break;
    case 'bounce':
      content.innerHTML = '<i class="fas fa-basketball-ball"></i> BOUNCE';
      break;
    case 'pulse':
      content.innerHTML = '<i class="fas fa-heartbeat"></i> PULSE';
      break;
    default:
      content.innerHTML = `<i class="fas fa-magic"></i> ${type.toUpperCase()}`;
  }
  
  effectBox.appendChild(content);
  document.body.appendChild(effectBox);
  
  // Retirer l'effet après l'animation
  setTimeout(() => {
    effectBox.classList.add('effect-out');
    setTimeout(() => {
      document.body.removeChild(effectBox);
    }, 500);
  }, 3000);
}

// Afficher un message (appelé via WebSocket)
function showMessage(text, type = 'info') {
  // Créer un élément de message
  const messageBox = document.createElement('div');
  messageBox.className = `message-box message-${type}`;
  messageBox.textContent = text;
  
  document.body.appendChild(messageBox);
  
  // Retirer le message après un délai
  setTimeout(() => {
    messageBox.classList.add('message-out');
    setTimeout(() => {
      document.body.removeChild(messageBox);
    }, 500);
  }, 5000);
}

// Mise à jour périodique du statut (dons, abonnements)
setInterval(() => {
  loadStatus();
}, 30000);