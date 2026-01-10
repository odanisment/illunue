// src/modules/Preloader.js
export class Preloader {
  constructor() {
    this.container = null;
    this.progressBar = null;
    this.progressText = null;
    this.statusText = null;
    this.percentage = 0;
    this.isComplete = false;
    
    this.createPreloader();
  }

  createPreloader() {
    this.container = document.createElement('div');
    this.container.id = 'preloader';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #d16c4e;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      transition: opacity 0.8s ease;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const title = document.createElement('div');
    title.style.cssText = `
      color: #ffffff;
      margin-bottom: 60px;
      text-align: center;
      opacity: 0;
      animation: fadeIn 1.4s ease forwards;
    `;
    title.innerHTML = `
      <div style="
        font-size: 48px;
        font-weight: 500;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        margin-bottom: 12px;
      ">ILLUNUE</div>
      <div style="
        font-size: 12px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        opacity: 0.6;
      ">THERE IS MORE SPACE THAN YOU THINK</div>
    `;
    
    const progressContainer = document.createElement('div');
    progressContainer.style.cssText = `
      width: 400px;
      height: 2px;
      background: rgba(255, 255, 255, 0.2);
      position: relative;
      margin: 0 auto;
    `;

    this.progressBar = document.createElement('div');
    this.progressBar.style.cssText = `
      width: 0%;
      height: 100%;
      background: #ffffff;
      transition: width 0.3s ease;
    `;

    progressContainer.appendChild(this.progressBar);

    this.progressText = document.createElement('div');
    this.progressText.style.cssText = `
      margin-top: 24px;
      font-size: 28px;
      font-weight: 500;
      color: #ffffff;
      text-align: center;
      letter-spacing: 0.08em;
    `;
    this.progressText.textContent = '0%';

    this.statusText = document.createElement('div');
    this.statusText.style.cssText = `
      margin-top: 16px;
      font-size: 11px;
      color: rgba(255, 255, 255, 0.6);
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      min-height: 20px;
    `;
    this.statusText.textContent = 'INITIALIZING...';

    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
      }
    `;
    document.head.appendChild(style);

    this.container.appendChild(title);
    this.container.appendChild(progressContainer);
    this.container.appendChild(this.progressText);
    this.container.appendChild(this.statusText);
    document.body.appendChild(this.container);
  }

  updateProgress(loaded, total) {
    if (total === 0) return;
    
    const percentage = Math.floor((loaded / total) * 100);
    this.percentage = percentage;
    
    this.progressBar.style.width = `${percentage}%`;
    this.progressText.textContent = `${percentage}%`;
  }

  updateStatus(message) {
    if (this.statusText) {
      this.statusText.textContent = message;
    }
  }

  complete() {
    if (this.isComplete) return;
    this.isComplete = true;

    this.progressBar.style.width = '100%';
    this.progressText.textContent = '100%';
    this.statusText.textContent = 'READY TO EXPLORE';

    setTimeout(() => {
      this.container.style.opacity = '0';
      
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