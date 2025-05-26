// public/js/timeline-manager.js - Gestion de la timeline 24h
class TimelineManager {
  constructor() {
    this.planningData = [];
    this.lastRenderTime = 0;
    this.RENDER_THROTTLE_MS = 2000;
    this.userScrollTimeout = null;
    this.isUserScrolling = false;
    this.dayOffset = 0; // 0 = jour 1, 1 = jour 2
    
    // Types d'événements et leurs couleurs modernes
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
    
    this.initScrollHandlers();
  }
  
  initScrollHandlers() {
    const timeline = document.getElementById('timeline');
    if (timeline) {
      timeline.addEventListener('scroll', () => {
        this.isUserScrolling = true;
        clearTimeout(this.userScrollTimeout);
        this.userScrollTimeout = setTimeout(() => {
          this.isUserScrolling = false;
          this.autoScrollToCurrentItem();
        }, 8000);
      });
    }
  }
  
  detectEventType(label) {
    const labelLower = label.toLowerCase();
    for (const [type, config] of Object.entries(this.EVENT_TYPES)) {
      if (labelLower.includes(type)) {
        return type;
      }
    }
    return 'default';
  }
  
  getEventConfig(label) {
    const type = this.detectEventType(label);
    return this.EVENT_TYPES[type] || this.EVENT_TYPES.default;
  }
  
  // Conversion de l'heure en minutes depuis le début du stream (24h continues)
  timeToStreamMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  // Obtenir l'heure actuelle en minutes depuis le début du stream
  getCurrentStreamMinutes() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    // Si on est après minuit et avant 10h, on considère qu'on est au jour 2
    if (currentHour < 10) {
      return currentTimeInMinutes + (24 * 60); // Ajouter 24h
    }
    return currentTimeInMinutes;
  }
  
  getCurrentTimeString() {
    const streamMinutes = this.getCurrentStreamMinutes();
    const displayHour = Math.floor(streamMinutes / 60) % 24;
    const displayMinute = streamMinutes % 60;
    return `${displayHour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')}`;
  }
  
  loadPlanning() {
    return fetch('/api/planning')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Erreur HTTP ${response.status}`);
        }
        return response.json();
      })
      .then(data => {
        this.planningData = data.planning || [];
        this.render(true);
        return this.planningData;
      })
      .catch(error => {
        console.error('Erreur lors du chargement du planning:', error);
        throw error;
      });
  }
  
  render(forceRender = false) {
    const now = Date.now();
    
    if (!forceRender && now - this.lastRenderTime < this.RENDER_THROTTLE_MS) {
      this.updateTimeIndicator();
      this.updateStatus();
      return;
    }
    
    this.lastRenderTime = now;
    
    const timeline = document.getElementById('timeline');
    if (!timeline) return;
    
    const currentScroll = timeline.scrollTop;
    timeline.innerHTML = '<div class="timeline-line"></div>';
    
    if (this.planningData.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.innerHTML = '<i class="fas fa-calendar-times"></i><br>Aucun élément dans le planning';
      timeline.appendChild(empty);
      return;
    }
    
    // Convertir tous les éléments en minutes de stream et les trier
    const streamItems = this.planningData.map(item => {
      const itemMinutes = this.timeToStreamMinutes(item.time);
      // Si l'heure est < 10h, on considère que c'est le jour 2
      const isDay2 = parseInt(item.time.split(':')[0]) < 10;
      const streamMinutes = isDay2 ? itemMinutes + (24 * 60) : itemMinutes;
      
      return {
        ...item,
        streamMinutes,
        displayTime: item.time,
        isDay2
      };
    }).sort((a, b) => a.streamMinutes - b.streamMinutes);
    
    // Déterminer les bornes (24h continues)
    const minStreamMinutes = Math.min(...streamItems.map(item => item.streamMinutes)) - 60;
    const maxStreamMinutes = Math.max(...streamItems.map(item => item.streamMinutes)) + 120;
    const totalDuration = maxStreamMinutes - minStreamMinutes;
    
    // Créer les marqueurs d'heures
    this.createHourMarkers(timeline, minStreamMinutes, maxStreamMinutes, totalDuration);
    
    // Créer l'indicateur de temps actuel
    this.createTimeIndicator(timeline, minStreamMinutes, totalDuration);
    
    // Déterminer l'élément actuel et suivant
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    const { currentIndex, nextIndex } = this.findCurrentAndNext(streamItems, currentStreamMinutes);
    
    // Créer les éléments de timeline
    this.createTimelineItems(timeline, streamItems, minStreamMinutes, totalDuration, currentIndex, nextIndex);
    
    // Mettre à jour le statut
    this.updateStatus(streamItems, currentIndex, nextIndex);
    
    // Gérer le scroll
    if (forceRender && !this.isUserScrolling) {
      setTimeout(() => this.autoScrollToCurrentItem(), 100);
    } else {
      timeline.scrollTop = currentScroll;
    }
  }
  
  createHourMarkers(timeline, minStreamMinutes, maxStreamMinutes, totalDuration) {
    const hourMarkers = document.createElement('div');
    hourMarkers.className = 'hour-markers';
    timeline.appendChild(hourMarkers);
    
    // Créer des marqueurs pour chaque heure de 10h à 10h+24h
    for (let hour = 10; hour <= 34; hour++) {
      const hourInStreamMinutes = hour * 60;
      
      if (hourInStreamMinutes < minStreamMinutes || hourInStreamMinutes > maxStreamMinutes) continue;
      
      const positionPercentage = ((hourInStreamMinutes - minStreamMinutes) / totalDuration) * 100;
      
      const hourMarker = document.createElement('div');
      hourMarker.className = 'hour-marker';
      hourMarker.style.top = `${positionPercentage}%`;
      
      const hourLabel = document.createElement('div');
      hourLabel.className = 'hour-marker-label';
      
      // Afficher l'heure réelle (modulo 24)
      const displayHour = hour % 24;
      const dayLabel = hour >= 24 ? ' +1j' : '';
      hourLabel.textContent = `${displayHour.toString().padStart(2, '0')}:00${dayLabel}`;
      
      hourMarker.appendChild(hourLabel);
      hourMarkers.appendChild(hourMarker);
    }
  }
  
  createTimeIndicator(timeline, minStreamMinutes, totalDuration) {
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    
    if (currentStreamMinutes >= minStreamMinutes && currentStreamMinutes <= minStreamMinutes + totalDuration) {
      const positionPercentage = ((currentStreamMinutes - minStreamMinutes) / totalDuration) * 100;
      
      const timeIndicator = document.createElement('div');
      timeIndicator.className = 'current-time-indicator';
      timeIndicator.id = 'current-time-indicator';
      timeIndicator.style.top = `${positionPercentage}%`;
      
      const timeLabel = document.createElement('div');
      timeLabel.className = 'current-time-label';
      timeLabel.id = 'current-time-label';
      timeLabel.textContent = this.getCurrentTimeString();
      timeLabel.style.top = `${positionPercentage}%`;
      
      timeline.appendChild(timeIndicator);
      timeline.appendChild(timeLabel);
    }
    
    // Stocker les données pour les mises à jour
    timeline.dataset.minTime = minStreamMinutes;
    timeline.dataset.duration = totalDuration;
  }
  
  findCurrentAndNext(streamItems, currentStreamMinutes) {
    let currentIndex = -1;
    let nextIndex = -1;
    
    for (let i = 0; i < streamItems.length; i++) {
      const item = streamItems[i];
      
      if (item.streamMinutes <= currentStreamMinutes) {
        if (!item.checked) {
          currentIndex = i;
        }
      } else if (nextIndex === -1) {
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
      
      // Alternance gauche/droite
      if (index % 2 === 0) {
        timelineItem.classList.add('left');
      } else {
        timelineItem.classList.add('right');
      }
      
      // États
      if (item.checked) {
        timelineItem.classList.add('done');
      } else if (index === currentIndex) {
        timelineItem.classList.add('current');
      } else if (index === nextIndex) {
        timelineItem.classList.add('next');
      }
      
      timelineItem.style.top = `${positionPercentage}%`;
      
      const timelineContent = this.createTimelineContent(item, index, currentIndex, nextIndex);
      timelineItem.appendChild(timelineContent);
      timeline.appendChild(timelineItem);
    });
  }
  
  createTimelineContent(item, index, currentIndex, nextIndex) {
    const eventConfig = this.getEventConfig(item.label);
    
    const timelineContent = document.createElement('div');
    timelineContent.className = 'timeline-content';
    
    // Couleur de bordure selon le type d'événement
    if (index === currentIndex) {
      timelineContent.style.borderLeftColor = '#ff3366';
    } else {
      timelineContent.style.borderLeftColor = eventConfig.color;
    }
    
    const contentHeader = document.createElement('div');
    contentHeader.className = 'timeline-content-header';
    
    // Heure avec icône
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
  
  updateTimeIndicator() {
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    const currentTimeStr = this.getCurrentTimeString();
    
    const timeIndicator = document.getElementById('current-time-indicator');
    const timeLabel = document.getElementById('current-time-label');
    const timeline = document.getElementById('timeline');
    
    if (timeIndicator && timeLabel && timeline) {
      const minStreamMinutes = parseInt(timeline.dataset.minTime || 0);
      const totalDuration = parseInt(timeline.dataset.duration || (24 * 60));
      
      if (totalDuration > 0) {
        const positionPercentage = ((currentStreamMinutes - minStreamMinutes) / totalDuration) * 100;
        
        if (positionPercentage >= 0 && positionPercentage <= 100) {
          timeIndicator.style.transition = 'top 1s linear';
          timeLabel.style.transition = 'top 1s linear';
          
          timeIndicator.style.top = `${positionPercentage}%`;
          timeLabel.style.top = `${positionPercentage}%`;
          timeLabel.textContent = currentTimeStr;
        }
      }
    }
    
    this.checkAndUpdateCurrentItem();
  }
  
  checkAndUpdateCurrentItem() {
    const currentStreamMinutes = this.getCurrentStreamMinutes();
    let hasChanged = false;
    
    // Convertir les données actuelles
    const streamItems = this.planningData.map(item => {
      const itemMinutes = this.timeToStreamMinutes(item.time);
      const isDay2 = parseInt(item.time.split(':')[0]) < 10;
      const streamMinutes = isDay2 ? itemMinutes + (24 * 60) : itemMinutes;
      return { ...item, streamMinutes };
    }).sort((a, b) => a.streamMinutes - b.streamMinutes);
    
    const { currentIndex, nextIndex } = this.findCurrentAndNext(streamItems, currentStreamMinutes);
    
    // Mettre à jour les classes des éléments DOM
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
    
    if (hasChanged) {
      setTimeout(() => this.autoScrollToCurrentItem(), 100);
      this.updateStatus(streamItems, currentIndex, nextIndex);
    }
  }
  
  updateStatus(streamItems = null, currentIndex = -1, nextIndex = -1) {
    if (!streamItems) {
      const currentStreamMinutes = this.getCurrentStreamMinutes();
      streamItems = this.planningData.map(item => {
        const itemMinutes = this.timeToStreamMinutes(item.time);
        const isDay2 = parseInt(item.time.split(':')[0]) < 10;
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
      statusCurrent.innerHTML = `
        <i class="${eventConfig.icon}"></i>
        <span>${item.label}</span>
      `;
    } else {
      statusCurrent.innerHTML = `
        <i class="fas fa-pause"></i>
        <span>Pause</span>
      `;
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
      const shortLabel = item.label.length > 20 ? item.label.substring(0, 17) + '...' : item.label;
      statusNext.innerHTML = `
        <span>${shortLabel}</span>
        <i class="${eventConfig.icon}"></i>
      `;
    } else {
      statusNext.innerHTML = `
        <span>Fin du stream</span>
        <i class="fas fa-flag-checkered"></i>
      `;
    }
    
    statusLine.appendChild(statusCurrent);
    statusLine.appendChild(divider);
    statusLine.appendChild(statusNext);
  }
  
  autoScrollToCurrentItem() {
    if (this.isUserScrolling) return;
    
    const timeline = document.getElementById('timeline');
    const currentItem = document.querySelector('.timeline-item.current');
    
    if (!timeline || !currentItem) return;
    
    const timelineHeight = timeline.clientHeight;
    const itemTop = currentItem.offsetTop;
    const targetPosition = itemTop - (timelineHeight * 0.3);
    
    const itemRect = currentItem.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const itemRelativeTop = itemRect.top - timelineRect.top;
    const isInOptimalZone = itemRelativeTop > (timelineHeight * 0.2) && 
                           itemRelativeTop < (timelineHeight * 0.4);
    
    if (!isInOptimalZone) {
      timeline.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  }
  
  // Méthodes publiques pour l'intégration
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
      const isDay2 = parseInt(item.time.split(':')[0]) < 10;
      const streamMinutes = isDay2 ? itemMinutes + (24 * 60) : itemMinutes;
      return { ...item, streamMinutes };
    }).sort((a, b) => a.streamMinutes - b.streamMinutes);
    
    const { currentIndex } = this.findCurrentAndNext(streamItems, currentStreamMinutes);
    return currentIndex !== -1 ? streamItems[currentIndex] : null;
  }
}