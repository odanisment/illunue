// src/modules/Preloader.js
// Countdown-themed preloader with SVG logo and balanced spacing

export class Preloader {
  constructor() {
    this.container = this.createPreloaderHTML();
    document.body.appendChild(this.container);
    
    // Fade in animation
    requestAnimationFrame(() => {
      this.container.style.opacity = '1';
    });
  }

  createPreloaderHTML() {
    const container = document.createElement('div');
    container.id = 'preloader';
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: #d16c4e;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.4s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    // ⭐ LOGO SVG
    const logo = document.createElement('img');
    logo.src = '/favicons/logo.svg';
    logo.alt = 'ILLUNUE';
    logo.style.cssText = `
      width: 280px;
      height: auto;
      margin-bottom: 40px;
      opacity: 0;
      animation: fadeInLogo 0.8s ease 0.2s forwards;
    `;

    // Motto text
    const motto = document.createElement('div');
    motto.textContent = 'THERE IS MORE SPACE THAN YOU THINK';
    motto.style.cssText = `
      font-size: 12px;
      font-weight: 400;
      letter-spacing: 0.22em;
      color: rgba(255, 255, 255, 0.6);
      text-transform: uppercase;
      margin-top: -30px;
      margin-bottom: 40px;
      opacity: 0;
      animation: fadeInMotto 0.8s ease 0.4s forwards;
    `;

    // Progress container
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 400px;
      height: 2px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 1px;
      overflow: hidden;
      margin-top: 16px;
      opacity: 0;
      animation: fadeInProgress 0.8s ease 0.6s forwards;
    `;

    // Progress bar
    const progressBar = document.createElement('div');
    progressBar.id = 'preloader-progress-bar';
    progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: #ffffff;
      transition: width 0.3s ease;
      border-radius: 1px;
    `;

    progressContainer.appendChild(progressBar);

    // Progress percentage
    const progressPercent = document.createElement('div');
    progressPercent.id = 'preloader-progress-percent';
    progressPercent.textContent = '0%';
    progressPercent.style.cssText = `
      font-size: 28px;
      font-weight: 500;
      letter-spacing: 0.08em;
      color: #ffffff;
      margin-top: 16px;
      opacity: 0;
      animation: fadeInPercent 0.8s ease 0.7s forwards;
    `;

    // Status text
    const status = document.createElement('div');
    status.id = 'preloader-status';
    status.textContent = 'INITIALIZING...';
    status.style.cssText = `
      font-size: 11px;
      font-weight: 400;
      letter-spacing: 0.18em;
      color: rgba(255, 255, 255, 0.5);
      margin-top: 12px;
      text-transform: uppercase;
      opacity: 0;
      animation: fadeInStatus 0.8s ease 0.8s forwards;
    `;

    // ⭐ CSS Animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeInLogo {
        from {
          opacity: 0;
          transform: translateY(-20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeInMotto {
        from {
          opacity: 0;
          transform: translateY(-10px);
        }
        to {
          opacity: 0.6;
          transform: translateY(0);
        }
      }

      @keyframes fadeInProgress {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      @keyframes fadeInPercent {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }

      @keyframes fadeInStatus {
        from {
          opacity: 0;
          transform: translateY(5px);
        }
        to {
          opacity: 0.5;
          transform: translateY(0);
        }
      }

      /* ⭐ Responsive - Logo boyutu ve spacing */
      @media (max-width: 768px) {
        #preloader img {
          width: 220px !important;
          margin-bottom: 32px !important;
        }
        
        #preloader > div:nth-child(2) {
          margin-bottom: 32px !important;
          margin-top: -24px !important;
        }
        
        #preloader-progress-percent {
          font-size: 24px !important;
        }
      }

      @media (max-width: 480px) {
        #preloader img {
          width: 180px !important;
          margin-bottom: 28px !important;
        }
        
        #preloader > div:nth-child(2) {
          margin-bottom: 28px !important;
          margin-top: -20px !important;
        }
        
        #preloader-progress-percent {
          font-size: 22px !important;
        }
      }
    `;

    document.head.appendChild(style);

    // Append all elements
    container.appendChild(logo);
    container.appendChild(motto);
    container.appendChild(progressContainer);
    container.appendChild(progressPercent);
    container.appendChild(status);

    return container;
  }

  updateProgress(loaded, total) {
    const percent = Math.round((loaded / total) * 100);
    
    const progressBar = document.getElementById('preloader-progress-bar');
    const progressPercent = document.getElementById('preloader-progress-percent');
    
    if (progressBar) {
      progressBar.style.width = `${percent}%`;
    }
    
    if (progressPercent) {
      progressPercent.textContent = `${percent}%`;
    }
  }

  updateStatus(message) {
    const status = document.getElementById('preloader-status');
    if (status) {
      status.textContent = message.toUpperCase();
    }
  }

  complete() {
    this.updateStatus('READY TO EXPLORE');
    
    // Wait a bit before fading out
    setTimeout(() => {
      this.container.style.opacity = '0';
      
      // Remove from DOM after fade out
      setTimeout(() => {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
      }, 800);
    }, 500);
  }

  dispose() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}