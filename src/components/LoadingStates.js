// LoadingStates.js - Beautiful loading states for v1.0.2
// Skeleton loaders, spinners, and progress indicators

class LoadingStates {
  constructor() {
    this.states = new Map();
    this.init();
  }

  init() {
    this.injectStyles();
  }

  // Create skeleton loader
  skeleton(elementId, options = {}) {
    const {
      lines = 3,
      width = '100%',
      height = '20px',
      borderRadius = '4px',
      spacing = '12px',
      animated = true
    } = options;

    const container = document.getElementById(elementId);
    if (!container) return;

    const skeletonHTML = Array(lines).fill(0).map((_, index) => `
      <div class="skeleton-line ${animated ? 'skeleton-animated' : ''}" 
           style="width: ${index === lines - 1 ? '60%' : width}; 
                  height: ${height}; 
                  border-radius: ${borderRadius};
                  margin-bottom: ${index < lines - 1 ? spacing : '0'};">
      </div>
    `).join('');

    container.innerHTML = `<div class="skeleton-loader">${skeletonHTML}</div>`;
    this.states.set(elementId, 'skeleton');
  }

  // Create card skeleton
  cardSkeleton(elementId, options = {}) {
    const {
      showAvatar = true,
      showActions = true,
      animated = true
    } = options;

    const container = document.getElementById(elementId);
    if (!container) return;

    container.innerHTML = `
      <div class="skeleton-card ${animated ? 'skeleton-animated' : ''}">
        ${showAvatar ? `
          <div class="skeleton-card-header">
            <div class="skeleton-avatar"></div>
            <div class="skeleton-header-content">
              <div class="skeleton-line" style="width: 150px; height: 16px;"></div>
              <div class="skeleton-line" style="width: 100px; height: 14px; opacity: 0.6;"></div>
            </div>
          </div>
        ` : ''}
        <div class="skeleton-card-body">
          <div class="skeleton-line" style="width: 100%; height: 14px;"></div>
          <div class="skeleton-line" style="width: 100%; height: 14px;"></div>
          <div class="skeleton-line" style="width: 70%; height: 14px;"></div>
        </div>
        ${showActions ? `
          <div class="skeleton-card-actions">
            <div class="skeleton-button" style="width: 80px; height: 32px;"></div>
            <div class="skeleton-button" style="width: 80px; height: 32px;"></div>
          </div>
        ` : ''}
      </div>
    `;
    this.states.set(elementId, 'card-skeleton');
  }

  // Create spinner
  spinner(elementId, options = {}) {
    const {
      size = 'medium',
      color = '#10a37f',
      text = '',
      overlay = false
    } = options;

    const container = document.getElementById(elementId);
    if (!container) return;

    const sizeClasses = {
      small: 'spinner-small',
      medium: 'spinner-medium',
      large: 'spinner-large'
    };

    container.innerHTML = `
      <div class="loading-spinner-container ${overlay ? 'spinner-overlay' : ''}">
        <div class="loading-spinner ${sizeClasses[size] || sizeClasses.medium}">
          <svg viewBox="0 0 50 50">
            <circle cx="25" cy="25" r="20" fill="none" stroke="${color}" stroke-width="3"></circle>
          </svg>
        </div>
        ${text ? `<div class="spinner-text">${text}</div>` : ''}
      </div>
    `;
    this.states.set(elementId, 'spinner');
  }

  // Create progress bar
  progressBar(elementId, options = {}) {
    const {
      progress = 0,
      showLabel = true,
      animated = true,
      color = '#10a37f',
      height = '8px'
    } = options;

    const container = document.getElementById(elementId);
    if (!container) return;

    container.innerHTML = `
      <div class="progress-bar-container">
        ${showLabel ? `
          <div class="progress-label">
            <span class="progress-text">Loading...</span>
            <span class="progress-percentage">${progress}%</span>
          </div>
        ` : ''}
        <div class="progress-bar" style="height: ${height};">
          <div class="progress-fill ${animated ? 'progress-animated' : ''}" 
               style="width: ${progress}%; background-color: ${color};">
          </div>
        </div>
      </div>
    `;
    this.states.set(elementId, { type: 'progress', value: progress });
  }

  // Update progress
  updateProgress(elementId, progress, text = null) {
    const container = document.getElementById(elementId);
    if (!container) return;

    const fill = container.querySelector('.progress-fill');
    const percentage = container.querySelector('.progress-percentage');
    const progressText = container.querySelector('.progress-text');

    if (fill) fill.style.width = `${progress}%`;
    if (percentage) percentage.textContent = `${progress}%`;
    if (progressText && text) progressText.textContent = text;

    this.states.set(elementId, { type: 'progress', value: progress });

    // Auto-hide when complete
    if (progress >= 100) {
      setTimeout(() => this.fadeOut(elementId), 500);
    }
  }

  // Create dots loader
  dots(elementId, options = {}) {
    const {
      color = '#10a37f',
      size = 'medium',
      text = ''
    } = options;

    const container = document.getElementById(elementId);
    if (!container) return;

    container.innerHTML = `
      <div class="loading-dots-container">
        <div class="loading-dots loading-dots-${size}">
          <span style="background-color: ${color};"></span>
          <span style="background-color: ${color};"></span>
          <span style="background-color: ${color};"></span>
        </div>
        ${text ? `<div class="loading-dots-text">${text}</div>` : ''}
      </div>
    `;
    this.states.set(elementId, 'dots');
  }

  // Create pulse loader
  pulse(elementId, options = {}) {
    const {
      color = '#10a37f',
      size = 'medium',
      count = 3
    } = options;

    const container = document.getElementById(elementId);
    if (!container) return;

    const pulses = Array(count).fill(0).map((_, index) => `
      <div class="pulse-ring pulse-ring-${size}" 
           style="animation-delay: ${index * 0.3}s; 
                  border-color: ${color};">
      </div>
    `).join('');

    container.innerHTML = `
      <div class="pulse-loader">
        ${pulses}
      </div>
    `;
    this.states.set(elementId, 'pulse');
  }

  // Clear loading state
  clear(elementId) {
    const container = document.getElementById(elementId);
    if (container) {
      container.innerHTML = '';
      this.states.delete(elementId);
    }
  }

  // Fade out effect
  fadeOut(elementId, callback = null) {
    const container = document.getElementById(elementId);
    if (!container) return;

    container.style.transition = 'opacity 0.3s ease-out';
    container.style.opacity = '0';

    setTimeout(() => {
      this.clear(elementId);
      if (callback) callback();
    }, 300);
  }

  // Inject styles
  injectStyles() {
    if (document.getElementById('loading-states-styles')) return;

    const styles = `
      <style id="loading-states-styles">
        /* Skeleton Loader Styles */
        .skeleton-loader {
          width: 100%;
        }

        .skeleton-line {
          background: #e5e7eb;
          border-radius: 4px;
          position: relative;
          overflow: hidden;
        }

        .skeleton-animated::after {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.4) 50%,
            transparent 100%
          );
          animation: skeleton-shimmer 1.5s infinite;
        }

        @keyframes skeleton-shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }

        /* Card Skeleton */
        .skeleton-card {
          background: white;
          border-radius: 8px;
          padding: 20px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .skeleton-card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
        }

        .skeleton-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #e5e7eb;
          flex-shrink: 0;
        }

        .skeleton-header-content {
          flex: 1;
        }

        .skeleton-header-content .skeleton-line {
          margin-bottom: 6px;
        }

        .skeleton-card-body .skeleton-line {
          margin-bottom: 12px;
        }

        .skeleton-card-actions {
          display: flex;
          gap: 12px;
          margin-top: 20px;
        }

        .skeleton-button {
          background: #e5e7eb;
          border-radius: 6px;
        }

        /* Spinner Styles */
        .loading-spinner-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .spinner-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(255, 255, 255, 0.9);
          z-index: 9999;
        }

        .loading-spinner {
          position: relative;
        }

        .loading-spinner svg {
          animation: spinner-rotate 2s linear infinite;
        }

        .loading-spinner circle {
          stroke-dasharray: 90 150;
          stroke-dashoffset: 0;
          transform-origin: center;
          animation: spinner-dash 1.5s ease-in-out infinite;
          stroke-linecap: round;
        }

        .spinner-small {
          width: 24px;
          height: 24px;
        }

        .spinner-medium {
          width: 40px;
          height: 40px;
        }

        .spinner-large {
          width: 64px;
          height: 64px;
        }

        @keyframes spinner-rotate {
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes spinner-dash {
          0% {
            stroke-dasharray: 1 150;
            stroke-dashoffset: 0;
          }
          50% {
            stroke-dasharray: 90 150;
            stroke-dashoffset: -35;
          }
          100% {
            stroke-dasharray: 90 150;
            stroke-dashoffset: -124;
          }
        }

        .spinner-text {
          font-size: 14px;
          color: #6b7280;
          font-weight: 500;
        }

        /* Progress Bar Styles */
        .progress-bar-container {
          width: 100%;
        }

        .progress-label {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          font-size: 14px;
        }

        .progress-text {
          color: #6b7280;
        }

        .progress-percentage {
          color: #1f2937;
          font-weight: 500;
        }

        .progress-bar {
          background: #e5e7eb;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          border-radius: 4px;
          transition: width 0.3s ease;
          position: relative;
          overflow: hidden;
        }

        .progress-animated::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(
            90deg,
            transparent 0%,
            rgba(255, 255, 255, 0.3) 50%,
            transparent 100%
          );
          animation: progress-shimmer 1s infinite;
        }

        @keyframes progress-shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        /* Loading Dots */
        .loading-dots-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
        }

        .loading-dots {
          display: flex;
          gap: 4px;
        }

        .loading-dots span {
          display: block;
          border-radius: 50%;
          animation: dots-pulse 1.4s infinite ease-in-out both;
        }

        .loading-dots span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .loading-dots span:nth-child(2) {
          animation-delay: -0.16s;
        }

        .loading-dots-small span {
          width: 6px;
          height: 6px;
        }

        .loading-dots-medium span {
          width: 10px;
          height: 10px;
        }

        .loading-dots-large span {
          width: 14px;
          height: 14px;
        }

        @keyframes dots-pulse {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        .loading-dots-text {
          font-size: 14px;
          color: #6b7280;
        }

        /* Pulse Loader */
        .pulse-loader {
          position: relative;
          display: inline-block;
        }

        .pulse-ring {
          position: absolute;
          border: 2px solid;
          border-radius: 50%;
          opacity: 0;
          animation: pulse-ring-animation 2s infinite;
        }

        .pulse-ring-small {
          width: 30px;
          height: 30px;
          top: -15px;
          left: -15px;
        }

        .pulse-ring-medium {
          width: 50px;
          height: 50px;
          top: -25px;
          left: -25px;
        }

        .pulse-ring-large {
          width: 70px;
          height: 70px;
          top: -35px;
          left: -35px;
        }

        @keyframes pulse-ring-animation {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }

        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          .skeleton-line,
          .skeleton-avatar,
          .skeleton-button {
            background: #374151;
          }

          .skeleton-card {
            background: #1f2937;
          }

          .spinner-overlay {
            background: rgba(17, 24, 39, 0.9);
          }

          .spinner-text,
          .progress-text,
          .loading-dots-text {
            color: #d1d5db;
          }

          .progress-percentage {
            color: #f9fafb;
          }

          .progress-bar {
            background: #374151;
          }
        }

        /* Reduced Motion */
        @media (prefers-reduced-motion: reduce) {
          .skeleton-animated::after,
          .loading-spinner svg,
          .loading-spinner circle,
          .progress-animated::after,
          .loading-dots span,
          .pulse-ring {
            animation: none !important;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }
}

// Create global instance
const Loading = new LoadingStates();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LoadingStates, Loading };
} else {
  window.LoadingStates = LoadingStates;
  window.Loading = Loading;
}