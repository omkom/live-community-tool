// public/js/timeline-manager.js - Version corrigée avec centrage fiable
class TimelineManager {
  constructor() {
    this.planningData = [];
    this.lastRenderTime = 0;
    this.RENDER_THROTTLE_MS = 1000;
    this.isScrolling = false;
    this.scrollTimeout = null;
    this.centeringTimeout = null;
    
    // Configuration du centrage
    this.AUTO_CENTER_ENABLED = true;
    this.CENTER_INTERVAL = 8000; // Centrage automatique toutes les 8 secondes
    this.SCROLL_OFFSET_THRESHOLD = 100; // Seuil pour déclencher le centrage
    
    // Types d'événements et leurs couleurs
    this.EVENT_TYPES = {
      'sport': { color: '#667eea', icon: 'fas fa-running' },
      'cuisine': { color: '#f093fb', icon: 'fas fa-utensils' },
      'jeu': { color: '#4facfe', icon: 'fas fa-gamepad' },
      'talk': { color: '#43e97b', icon: 'fas fa-comments' },
      'sieste': { color: '#fa709a', icon: 'fas fa-bed' },
      'création': { color: '#a8edea', icon: 'fas fa-paint-brush' },
      'podcast': { color: '#d299c2', icon: 'fas fa-microphone' },
      'radio': { color: '#89f7fe', icon: 'fas fa-broadcast-tower' },
      'défi': { color: '#fdbb2d', icon: 'fas fa-trophy' },
      'discussion': { color: '#e14fad', icon: 'fas fa-users' },
      'réveil': { color: '#ff9a9e', icon: 'fas fa-coffee' },
      'clôture': { color: '#a1c4fd', icon: 'fas fa-flag-checkered' },
      'default': { color: '#667eea', icon: 'fas fa-calendar-check' }
    };
    
    // Démarrer le centrage automatique
    this.startAutoCentering();
  }
  
  // === MÉTHODES UTILITAIRES ===
  
  detectEventType(label) {
    const labelLower = label.toLowerCase();
    for (const [type] of Object.entries(this.EVENT_TYPES)) {
      if (labelLower.includes(type)) return type;
    }
    return 'default';
  }
  
  getEventConfig(label) {
    const type = this.detectEventType(label);
    return this.EVENT_TYPES[type] || this.EVENT_TYPES.default;
  }
  
  timeToStreamMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  getCurrentStreamMinutes() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Si on est après minuit et avant 10h, on est au jour 2 du stream
    return currentHour < 10 ? currentTimeInMinutes + (24 * 60) : currentTimeInMinutes;
  }
  
  getCurrentTimeString() {
    const streamMinutes = this.getCurrentStreamMinutes();
    const displayHour = Math.floor(streamMinutes / 60) % 24;
    const displayMinute = streamMinutes % 60;
    return `${displayHour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')}`;
  }
  
  // === GESTION DU CENTRAGE AUTOMATIQUE ===
  
  startAutoCentering() {
    // Centrage périodique automatique
    this.autoCenterInterval = setInterval(() => {
      if (this.AUTO_CENTER_ENABLED && !this.isScrolling) {
        this.centerIndicatorNow(false); // Centrage discret
      }
    }, this.CENTER_INTERVAL);
    
    // Écouter les événements de scroll pour détecter l'interaction utilisateur
    this.setupScrollDetection();
  }
  
  setupScrollDetection() {
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    
    timeline.addEventListener('scroll', () => {
      this.isScrolling = true;
      
      // Réinitialiser le timeout de scroll
      if (this.scrollTimeout) {
        clearTimeout(this.scrollTimeout);
      }
      
      // Marquer la fin du scroll après 2 secondes d'inactivité
      this.scrollTimeout = setTimeout(() => {
        this.isScrolling = false;
      }, 2000);
    }, { passive: true });
  }
  
  stopAutoCentering() {
    if (this.autoCenterInterval) {
      clearInterval(this.autoCenterInterval);
      this.autoCenterInterval = null;
    }
  }
  
  // === CENTRAGE PRINCIPAL (VERSION SIMPLIFIÉE ET FIABLE) ===
  
  centerIndicatorNow(smooth = true) {
    const timeline = document.getElementById('timeline');
    const indicator = document.getElementById('current-time-indicator');
    
    if (!timeline || !indicator) {
      console.warn('⚠️ Éléments timeline ou indicateur manquants');
      return false;
    }
    
    // Attendre que le layout soit stable
    requestAnimationFrame(() => {
      try {
        // Obtenir les dimensions actuelles
        const timelineRect = timeline.getBoundingClientRect();
        const indicatorRect = indicator.getBoundingClientRect();
        
        // Calculer la position absolue de l'indicateur dans le contenu scrollable
        const indicatorOffsetTop = indicator.offsetTop;
        //console.log('📏 indicator:', indicator.style.top);
        
        // Position cible : centrer l'indicateur dans la vue
        const timelineCenter = timelineRect.height / 2;
        const targetScrollTop = indicatorOffsetTop - timelineCenter;

        console.log('# timelineCenter:', timelineCenter);
        console.log('# indicatorOffsetTop:', indicatorOffsetTop);
        console.log('# targetScrollTop:', targetScrollTop);
        
        // Limites de scroll
        const maxScrollTop = Math.max(0, timeline.scrollHeight - timeline.clientHeight);
        const finalScrollTop = Math.max(0, Math.min(targetScrollTop, maxScrollTop));
        
        // Vérifier si un scroll est nécessaire
        const currentScrollTop = timeline.scrollTop;
        console.log('#### timeline:', timeline) ;
        console.log('📜 Scroll actuel:', currentScrollTop);
        const scrollDifference = Math.abs(currentScrollTop - finalScrollTop);
        
        
        console.log('🎯 Centrage:', {
          indicatorOffsetTop,
          targetScrollTop: targetScrollTop.toFixed(2),
          finalScrollTop: finalScrollTop.toFixed(2),
          currentScrollTop: currentScrollTop.toFixed(2),
          scrollDifference: scrollDifference.toFixed(2),
          needsScroll: scrollDifference > 10
        });
        
        
        // Scroll uniquement si nécessaire (seuil de 10px)
        console.log('🔄 NTM...', scrollDifference);
        console.log('timeline scrollable?', timeline.scrollHeight, timeline.clientHeight);
        timeline.style.border = '1px solid red'; // voir visuellement la zone
        if (scrollDifference > 0) {
          timeline.scrollTo({
            top: finalScrollTop,
            behavior: smooth ? 'smooth' : 'instant'
          });
          
          console.log('📜 Scroll vers:', finalScrollTop.toFixed(2));
          return true;
        } else {
          console.log('✅ Déjà centré');
          return false;
        }
        
      } catch (error) {
        console.error('❌ Erreur de centrage:', error);
        return false;
      }
    });
  }
  
  // === MISE À JOUR DE L'INDICATEUR DE TEMPS ===
  
  updateTimeIndicator() {
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    const currentTimeStr = this.getCurrentTimeString();
    
    const timeIndicator = document.getElementById('current-time-indicator');
    const timeLabel = document.getElementById('current-time-label');
    const timeline = document.getElementById('timeline');
    
    if (!timeIndicator || !timeLabel || !timeline) return;
    
    // Récupérer les données de la timeline
    const minStreamMinutes = parseInt(timeline.dataset.minTime || '0');
    const totalDuration = parseInt(timeline.dataset.duration || (24 * 60));
    
    if (totalDuration <= 0) return;
    
    // Calculer la position en pourcentage
    const positionPercentage = ((currentStreamMinutes - minStreamMinutes) / totalDuration) * 100;
    
    // Vérifier que la position est valide
    if (positionPercentage < 0 || positionPercentage > 100) {
      console.warn('⚠️ Position indicateur hors limites:', positionPercentage);
      return;
    }
    
    // Mettre à jour la position de l'indicateur
    const newTop = `${positionPercentage}%`;
    
    // Appliquer les transitions seulement si la position change significativement
    const currentTop = parseFloat(timeIndicator.style.top) || 0;
    const newTopValue = positionPercentage;
    const topDifference = Math.abs(currentTop - newTopValue);
    
    if (topDifference > 0.1) { // Seuil de 0.1% pour éviter les micro-mouvements
      timeIndicator.style.transition = 'top 1s cubic-bezier(0.4, 0, 0.2, 1)';
      timeLabel.style.transition = 'top 1s cubic-bezier(0.4, 0, 0.2, 1)';
      
      timeIndicator.style.top = newTop;
      timeLabel.style.top = newTop;
      timeLabel.textContent = currentTimeStr;
      
      // Déclencher un centrage doux après mise à jour
      if (!this.isScrolling) {
        if (this.centeringTimeout) {
          clearTimeout(this.centeringTimeout);
        }
        
        this.centeringTimeout = setTimeout(() => {
          this.centerIndicatorNow(true);
        }, 1500); // Attendre la fin de la transition
      }
    } else {
      // Mise à jour du texte sans transition
      timeLabel.textContent = currentTimeStr;
    }
    
    // Vérifier et mettre à jour l'élément actuel
    this.checkAndUpdateCurrentItem();
  }
  
  // === CHARGEMENT DES DONNÉES ===
  
  loadPlanning() {
    return fetch('/api/planning')
      .then(response => {
        if (!response.ok) throw new Error(`Erreur HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        this.planningData = data.planning || [];
        this.render(true);
        return this.planningData;
      })
      .catch(error => {
        console.error('❌ Erreur chargement planning:', error);
        throw error;
      });
  }
  
  // === RENDU PRINCIPAL ===
  
  render(forceRender = false) {
    const now = Date.now();
    
    // Throttling des rendus
    if (!forceRender && now - this.lastRenderTime < this.RENDER_THROTTLE_MS) {
      this.updateTimeIndicator();
      this.updateStatus();
      return;
    }
    
    this.lastRenderTime = now;
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    
    // Nettoyer la timeline
    timeline.innerHTML = '<div class="timeline-line"></div>';
    
    // Gestion du cas vide
    if (this.planningData.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.innerHTML = '<i class="fas fa-calendar-times"></i><br>Aucun élément dans le planning';
      timeline.appendChild(empty);
      return;
    }
    
    // Convertir et trier les éléments par heure de stream
    const streamItems = this.planningData.map(item => {
      const itemMinutes = this.timeToStreamMinutes(item.time);
      const itemHour = parseInt(item.time.split(':')[0]);
      const isDay2 = itemHour < 10; // Jour 2 si l'heure est < 10h
      const streamMinutes = isDay2 ? itemMinutes + (24 * 60) : itemMinutes;
      
      return { 
        ...item, 
        streamMinutes, 
        displayTime: item.time, 
        isDay2,
        originalIndex: this.planningData.indexOf(item)
      };
    }).sort((a, b) => a.streamMinutes - b.streamMinutes);
    
    // Calculer les bornes temporelles avec marges
    const minStreamMinutes = Math.min(...streamItems.map(item => item.streamMinutes)) - 180; // 3h avant
    const maxStreamMinutes = Math.max(...streamItems.map(item => item.streamMinutes)) + 300; // 5h après
    const totalDuration = maxStreamMinutes - minStreamMinutes;
    
    // Créer les éléments de la timeline
    this.createHourMarkers(timeline, minStreamMinutes, maxStreamMinutes, totalDuration);
    this.createTimeIndicator(timeline, minStreamMinutes, totalDuration);
    
    // Déterminer l'élément actuel et suivant
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    const { currentIndex, nextIndex } = this.findCurrentAndNext(streamItems, currentStreamMinutes);
    
    // Créer les éléments du planning
    this.createTimelineItems(timeline, streamItems, minStreamMinutes, totalDuration, currentIndex, nextIndex);
    
    // Mettre à jour le statut
    this.updateStatus(streamItems, currentIndex, nextIndex);
    
    // Centrage initial après rendu
    setTimeout(() => {
      this.centerIndicatorNow(false); // Centrage immédiat sans animation
    }, 100);
  }
  
  // === CRÉATION DES ÉLÉMENTS DE LA TIMELINE ===
  
  createHourMarkers(timeline, minStreamMinutes, maxStreamMinutes, totalDuration) {
    const hourMarkers = document.createElement('div');
    hourMarkers.className = 'hour-markers';
    timeline.appendChild(hourMarkers);
    
    const startHour = Math.floor(minStreamMinutes / 60);
    const endHour = Math.ceil(maxStreamMinutes / 60);
    
    for (let hour = startHour; hour <= endHour; hour++) {
      const hourInStreamMinutes = hour * 60;
      if (hourInStreamMinutes < minStreamMinutes || hourInStreamMinutes > maxStreamMinutes) continue;
      
      const positionPercentage = ((hourInStreamMinutes - minStreamMinutes) / totalDuration) * 100;
      
      const hourMarker = document.createElement('div');
      hourMarker.className = 'hour-marker';
      hourMarker.style.top = `${positionPercentage}%`;
      
      const hourLabel = document.createElement('div');
      hourLabel.className = 'hour-marker-label';
      
      const displayHour = hour % 24;
      const dayLabel = hour >= 24 ? ' +1j' : '';
      hourLabel.textContent = `${displayHour.toString().padStart(2, '0')}:00${dayLabel}`;
      
      hourMarker.appendChild(hourLabel);
      hourMarkers.appendChild(hourMarker);
    }
  }
  
  createTimeIndicator(timeline, minStreamMinutes, totalDuration) {
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    
    // Vérifier que l'heure actuelle est dans la plage
    if (currentStreamMinutes >= minStreamMinutes && currentStreamMinutes <= minStreamMinutes + totalDuration) {
      const positionPercentage = ((currentStreamMinutes - minStreamMinutes) / totalDuration) * 100;
      
      // Créer l'indicateur de temps
      const timeIndicator = document.createElement('div');
      timeIndicator.className = 'current-time-indicator';
      timeIndicator.id = 'current-time-indicator';
      timeIndicator.style.top = `${positionPercentage}%`;
      
      // Créer le label de temps
      const timeLabel = document.createElement('div');
      timeLabel.className = 'current-time-label';
      timeLabel.id = 'current-time-label';
      timeLabel.textContent = this.getCurrentTimeString();
      timeLabel.style.top = `${positionPercentage}%`;
      
      timeline.appendChild(timeIndicator);
      timeline.appendChild(timeLabel);
    }
    
    // Stocker les données pour les calculs futurs
    timeline.dataset.minTime = minStreamMinutes.toString();
    timeline.dataset.duration = totalDuration.toString();
  }
  
  findCurrentAndNext(streamItems, currentStreamMinutes) {
    let currentIndex = -1;
    let nextIndex = -1;
    
    for (let i = 0; i < streamItems.length; i++) {
      const item = streamItems[i];
      
      if (item.streamMinutes <= currentStreamMinutes) {
        // Élément en cours = dernier élément non coché avant ou à l'heure actuelle
        if (!item.checked) {
          currentIndex = i;
        }
      } else if (nextIndex === -1) {
        // Premier élément après l'heure actuelle
        nextIndex = i;
        break;
      }
    }
    
    return { currentIndex, nextIndex };
  }
  
  createTimelineItems(timeline, streamItems, minStreamMinutes, totalDuration, currentIndex, nextIndex) {
    streamItems.forEach((item, index) => {
      const positionPercentage = ((item.streamMinutes - minStreamMinutes) / totalDuration) * 100;
      
      const timelineItem = document.createElement('div');
      timelineItem.className = 'timeline-item';
      timelineItem.dataset.index = index;
      timelineItem.dataset.originalIndex = item.originalIndex;
      
      // Alternance gauche/droite
      timelineItem.classList.add(index % 2 === 0 ? 'left' : 'right');
      
      // États des éléments
      if (item.checked) {
        timelineItem.classList.add('done');
      } else if (index === currentIndex) {
        timelineItem.classList.add('current');
      } else if (index === nextIndex) {
        timelineItem.classList.add('next');
      }
      
      // Position verticale
      timelineItem.style.top = `${positionPercentage}%`;
      
      // Contenu de l'élément
      const timelineContent = this.createTimelineContent(item, index, currentIndex, nextIndex);
      timelineItem.appendChild(timelineContent);
      timeline.appendChild(timelineItem);
    });
  }
  
  createTimelineContent(item, index, currentIndex, nextIndex) {
    const eventConfig = this.getEventConfig(item.label);
    
    const timelineContent = document.createElement('div');
    timelineContent.className = 'timeline-content';
    
    // Couleur de bordure selon l'état
    if (index === currentIndex) {
      timelineContent.style.borderLeftColor = '#ff3366';
    } else {
      timelineContent.style.borderLeftColor = eventConfig.color;
    }
    
    const contentHeader = document.createElement('div');
    contentHeader.className = 'timeline-content-header';
    
    // Temps avec icône
    const timeSpan = document.createElement('span');
    timeSpan.className = 'timeline-time';
    
    const icon = document.createElement('i');
    if (item.checked) {
      icon.className = 'fas fa-check-circle';
      icon.style.color = '#00cc66';
    } else if (index === currentIndex) {
      icon.className = 'fas fa-play-circle';
      icon.style.color = '#ff3366';
    } else {
      icon.className = eventConfig.icon;
      icon.style.color = eventConfig.color;
    }
    
    timeSpan.appendChild(icon);
    timeSpan.appendChild(document.createTextNode(` ${item.displayTime}`));
    
    // Titre avec badges
    const titleSpan = document.createElement('span');
    titleSpan.className = 'timeline-title';
    titleSpan.textContent = item.label;
    
    // Badges d'état
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
    
    contentHeader.appendChild(timeSpan);
    contentHeader.appendChild(titleSpan);
    timelineContent.appendChild(contentHeader);
    
    return timelineContent;
  }
  
  // === MISE À JOUR DYNAMIQUE ===
  
  checkAndUpdateCurrentItem() {
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    let hasChanged = false;
    
    const streamItems = this.planningData.map(item => {
      const itemMinutes = this.timeToStreamMinutes(item.time);
      const itemHour = parseInt(item.time.split(':')[0]);
      const isDay2 = itemHour < 10;
      const streamMinutes = isDay2 ? itemMinutes + (24 * 60) : itemMinutes;
      return { ...item, streamMinutes };
    }).sort((a, b) => a.streamMinutes - b.streamMinutes);
    
    const { currentIndex, nextIndex } = this.findCurrentAndNext(streamItems, currentStreamMinutes);
    
    // Mettre à jour les classes CSS des éléments
    document.querySelectorAll('.timeline-item').forEach((item, index) => {
      const wasCurrentOrNext = item.classList.contains('current') || item.classList.contains('next');
      
      item.classList.remove('current', 'next');
      
      if (index === currentIndex) {
        item.classList.add('current');
        if (!wasCurrentOrNext) hasChanged = true;
      } else if (index === nextIndex) {
        item.classList.add('next');
        if (!wasCurrentOrNext) hasChanged = true;
      }
    });
    
    // Mettre à jour le statut si changement
    if (hasChanged) {
      this.updateStatus(streamItems, currentIndex, nextIndex);
    }
  }
  
  updateStatus(streamItems = null, currentIndex = -1, nextIndex = -1) {
    // Recalculer si les données ne sont pas fournies
    if (!streamItems) {
      const currentStreamMinutes = this.getCurrentStreamMinutes();
      streamItems = this.planningData.map(item => {
        const itemMinutes = this.timeToStreamMinutes(item.time);
        const itemHour = parseInt(item.time.split(':')[0]);
        const isDay2 = itemHour < 10;
        const streamMinutes = isDay2 ? itemMinutes + (24 * 60) : itemMinutes;
        return { ...item, streamMinutes };
      }).sort((a, b) => a.streamMinutes - b.streamMinutes);
      
      const result = this.findCurrentAndNext(streamItems, currentStreamMinutes);
      currentIndex = result.currentIndex;
      nextIndex = result.nextIndex;
    }
    
    const statusLine = document.getElementById('status-line');
    if (!statusLine) return;
    
    statusLine.innerHTML = '';
    
    // Section "En cours"
    const statusCurrent = document.createElement('div');
    statusCurrent.className = 'status-current';
    
    if (currentIndex !== -1) {
      const item = streamItems[currentIndex];
      const eventConfig = this.getEventConfig(item.label);
      statusCurrent.innerHTML = `<i class="${eventConfig.icon}"></i><span>${item.label}</span>`;
    } else {
      statusCurrent.innerHTML = `<i class="fas fa-pause"></i><span>Pause</span>`;
    }
    
    // Séparateur
    const divider = document.createElement('div');
    divider.className = 'status-divider';
    
    // Section "À suivre"
    const statusNext = document.createElement('div');
    statusNext.className = 'status-next';
    
    if (nextIndex !== -1) {
      const item = streamItems[nextIndex];
      const eventConfig = this.getEventConfig(item.label);
      const shortLabel = item.label.length > 25 ? item.label.substring(0, 22) + '...' : item.label;
      statusNext.innerHTML = `<span>${shortLabel}</span><i class="${eventConfig.icon}"></i>`;
    } else {
      statusNext.innerHTML = `<span>Fin du stream</span><i class="fas fa-flag-checkered"></i>`;
    }
    
    statusLine.appendChild(statusCurrent);
    statusLine.appendChild(divider);
    statusLine.appendChild(statusNext);
  }
  
  // === MÉTHODES PUBLIQUES ===
  
  updatePlanning(planningData) {
    this.planningData = planningData;
    this.render(true);
  }
  
  forceRender() {
    this.render(true);
  }
  
  getCurrentItem() {
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    const streamItems = this.planningData.map(item => {
      const itemMinutes = this.timeToStreamMinutes(item.time);
      const itemHour = parseInt(item.time.split(':')[0]);
      const isDay2 = itemHour < 10;
      const streamMinutes = isDay2 ? itemMinutes + (24 * 60) : itemMinutes;
      return { ...item, streamMinutes };
    }).sort((a, b) => a.streamMinutes - b.streamMinutes);
    
    const { currentIndex } = this.findCurrentAndNext(streamItems, currentStreamMinutes);
    return currentIndex !== -1 ? streamItems[currentIndex] : null;
  }
  
  // Contrôle du centrage automatique
  enableAutoScroll() {
    this.AUTO_CENTER_ENABLED = true;
    console.log('🔄 Centrage automatique activé');
    this.centerIndicatorNow(true);
  }
  
  disableAutoScroll() {
    this.AUTO_CENTER_ENABLED = false;
    console.log('⏸️ Centrage automatique désactivé');
  }
  
  isAutoScrollEnabled() {
    return this.AUTO_CENTER_ENABLED;
  }
  
  // Méthodes de centrage manuel
  autoScrollToCurrentTime() {
    this.centerIndicatorNow(true);
  }
  
  autoScrollToCurrentItem() {
    this.centerIndicatorNow(true);
  }
  
  // Nettoyage
  destroy() {
    this.stopAutoCentering();
    
    if (this.scrollTimeout) {
      clearTimeout(this.scrollTimeout);
    }
    
    if (this.centeringTimeout) {
      clearTimeout(this.centeringTimeout);
    }
  }
}