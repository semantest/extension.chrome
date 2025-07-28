/**
 * Unit Tests for LoadingStates Component
 * Tests various loading states: skeleton, spinner, progress bar, dots, and pulse
 */

// Import after setting up DOM
const { LoadingStates, Loading } = require('./LoadingStates');

describe('LoadingStates', () => {
  let loadingStates;
  let container;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '<meta charset="UTF-8">';
    
    // Create test container
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    
    // Create new instance
    loadingStates = new LoadingStates();
  });

  afterEach(() => {
    // Cleanup
    const styles = document.getElementById('loading-states-styles');
    if (styles) {
      styles.remove();
    }
  });

  describe('Initialization', () => {
    test('should create instance with states map', () => {
      expect(loadingStates.states).toBeInstanceOf(Map);
      expect(loadingStates.states.size).toBe(0);
    });

    test('should inject styles on init', () => {
      const styles = document.getElementById('loading-states-styles');
      expect(styles).toBeTruthy();
    });

    test('should not duplicate styles', () => {
      const newInstance = new LoadingStates();
      const styles = document.querySelectorAll('#loading-states-styles');
      expect(styles.length).toBe(1);
    });

    test('should create global Loading instance', () => {
      expect(Loading).toBeInstanceOf(LoadingStates);
    });
  });

  describe('Skeleton Loader', () => {
    test('should create basic skeleton loader', () => {
      loadingStates.skeleton('test-container');
      
      const skeleton = container.querySelector('.skeleton-loader');
      expect(skeleton).toBeTruthy();
      
      const lines = container.querySelectorAll('.skeleton-line');
      expect(lines.length).toBe(3); // Default 3 lines
    });

    test('should create skeleton with custom options', () => {
      loadingStates.skeleton('test-container', {
        lines: 5,
        width: '80%',
        height: '16px',
        borderRadius: '8px',
        spacing: '8px',
        animated: false
      });
      
      const lines = container.querySelectorAll('.skeleton-line');
      expect(lines.length).toBe(5);
      expect(lines[0].style.width).toBe('80%');
      expect(lines[0].style.height).toBe('16px');
      expect(lines[0].style.borderRadius).toBe('8px');
      expect(lines[0].style.marginBottom).toBe('8px');
      expect(lines[0].classList.contains('skeleton-animated')).toBe(false);
    });

    test('should make last line 60% width', () => {
      loadingStates.skeleton('test-container', { lines: 3 });
      
      const lines = container.querySelectorAll('.skeleton-line');
      expect(lines[2].style.width).toBe('60%');
    });

    test('should track state', () => {
      loadingStates.skeleton('test-container');
      expect(loadingStates.states.get('test-container')).toBe('skeleton');
    });

    test('should handle missing container', () => {
      loadingStates.skeleton('non-existent');
      expect(loadingStates.states.has('non-existent')).toBe(false);
    });
  });

  describe('Card Skeleton', () => {
    test('should create card skeleton with all elements', () => {
      loadingStates.cardSkeleton('test-container');
      
      const card = container.querySelector('.skeleton-card');
      expect(card).toBeTruthy();
      expect(card.classList.contains('skeleton-animated')).toBe(true);
      
      expect(container.querySelector('.skeleton-avatar')).toBeTruthy();
      expect(container.querySelector('.skeleton-card-header')).toBeTruthy();
      expect(container.querySelector('.skeleton-card-body')).toBeTruthy();
      expect(container.querySelector('.skeleton-card-actions')).toBeTruthy();
    });

    test('should hide avatar when showAvatar is false', () => {
      loadingStates.cardSkeleton('test-container', { showAvatar: false });
      
      expect(container.querySelector('.skeleton-avatar')).toBeFalsy();
      expect(container.querySelector('.skeleton-card-header')).toBeFalsy();
    });

    test('should hide actions when showActions is false', () => {
      loadingStates.cardSkeleton('test-container', { showActions: false });
      
      expect(container.querySelector('.skeleton-card-actions')).toBeFalsy();
    });

    test('should disable animation', () => {
      loadingStates.cardSkeleton('test-container', { animated: false });
      
      const card = container.querySelector('.skeleton-card');
      expect(card.classList.contains('skeleton-animated')).toBe(false);
    });
  });

  describe('Spinner', () => {
    test('should create basic spinner', () => {
      loadingStates.spinner('test-container');
      
      const spinner = container.querySelector('.loading-spinner');
      expect(spinner).toBeTruthy();
      expect(spinner.classList.contains('spinner-medium')).toBe(true);
      
      const svg = container.querySelector('svg');
      expect(svg).toBeTruthy();
      expect(svg.getAttribute('viewBox')).toBe('0 0 50 50');
    });

    test('should create spinner with custom options', () => {
      loadingStates.spinner('test-container', {
        size: 'large',
        color: '#ff0000',
        text: 'Loading data...',
        overlay: true
      });
      
      const spinner = container.querySelector('.loading-spinner');
      expect(spinner.classList.contains('spinner-large')).toBe(true);
      
      const circle = container.querySelector('circle');
      expect(circle.getAttribute('stroke')).toBe('#ff0000');
      
      const text = container.querySelector('.spinner-text');
      expect(text.textContent).toBe('Loading data...');
      
      const overlay = container.querySelector('.spinner-overlay');
      expect(overlay).toBeTruthy();
    });

    test('should handle invalid size', () => {
      loadingStates.spinner('test-container', { size: 'invalid' });
      
      const spinner = container.querySelector('.loading-spinner');
      expect(spinner.classList.contains('spinner-medium')).toBe(true);
    });
  });

  describe('Progress Bar', () => {
    test('should create basic progress bar', () => {
      loadingStates.progressBar('test-container');
      
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar).toBeTruthy();
      
      const fill = container.querySelector('.progress-fill');
      expect(fill.style.width).toBe('0%');
      
      const label = container.querySelector('.progress-label');
      expect(label).toBeTruthy();
    });

    test('should create progress bar with custom options', () => {
      loadingStates.progressBar('test-container', {
        progress: 75,
        showLabel: false,
        animated: false,
        color: '#00ff00',
        height: '12px'
      });
      
      const progressBar = container.querySelector('.progress-bar');
      expect(progressBar.style.height).toBe('12px');
      
      const fill = container.querySelector('.progress-fill');
      expect(fill.style.width).toBe('75%');
      expect(fill.style.backgroundColor).toBe('#00ff00');
      expect(fill.classList.contains('progress-animated')).toBe(false);
      
      const label = container.querySelector('.progress-label');
      expect(label).toBeFalsy();
    });

    test('should track progress state', () => {
      loadingStates.progressBar('test-container', { progress: 50 });
      
      const state = loadingStates.states.get('test-container');
      expect(state).toEqual({ type: 'progress', value: 50 });
    });
  });

  describe('Progress Updates', () => {
    beforeEach(() => {
      loadingStates.progressBar('test-container', { progress: 0 });
    });

    test('should update progress value', () => {
      loadingStates.updateProgress('test-container', 50);
      
      const fill = container.querySelector('.progress-fill');
      const percentage = container.querySelector('.progress-percentage');
      
      expect(fill.style.width).toBe('50%');
      expect(percentage.textContent).toBe('50%');
    });

    test('should update progress text', () => {
      loadingStates.updateProgress('test-container', 30, 'Processing files...');
      
      const progressText = container.querySelector('.progress-text');
      expect(progressText.textContent).toBe('Processing files...');
    });

    test('should auto-hide on completion', (done) => {
      jest.spyOn(loadingStates, 'fadeOut');
      
      loadingStates.updateProgress('test-container', 100);
      
      setTimeout(() => {
        expect(loadingStates.fadeOut).toHaveBeenCalledWith('test-container');
        done();
      }, 600);
    });

    test('should handle missing container', () => {
      loadingStates.updateProgress('non-existent', 50);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Dots Loader', () => {
    test('should create basic dots loader', () => {
      loadingStates.dots('test-container');
      
      const dots = container.querySelector('.loading-dots');
      expect(dots).toBeTruthy();
      expect(dots.classList.contains('loading-dots-medium')).toBe(true);
      
      const spans = container.querySelectorAll('.loading-dots span');
      expect(spans.length).toBe(3);
    });

    test('should create dots with custom options', () => {
      loadingStates.dots('test-container', {
        color: '#0000ff',
        size: 'large',
        text: 'Please wait...'
      });
      
      const dots = container.querySelector('.loading-dots');
      expect(dots.classList.contains('loading-dots-large')).toBe(true);
      
      const spans = container.querySelectorAll('.loading-dots span');
      expect(spans[0].style.backgroundColor).toBe('#0000ff');
      
      const text = container.querySelector('.loading-dots-text');
      expect(text.textContent).toBe('Please wait...');
    });
  });

  describe('Pulse Loader', () => {
    test('should create basic pulse loader', () => {
      loadingStates.pulse('test-container');
      
      const pulse = container.querySelector('.pulse-loader');
      expect(pulse).toBeTruthy();
      
      const rings = container.querySelectorAll('.pulse-ring');
      expect(rings.length).toBe(3); // Default count
    });

    test('should create pulse with custom options', () => {
      loadingStates.pulse('test-container', {
        color: '#ff00ff',
        size: 'large',
        count: 5
      });
      
      const rings = container.querySelectorAll('.pulse-ring');
      expect(rings.length).toBe(5);
      expect(rings[0].classList.contains('pulse-ring-large')).toBe(true);
      expect(rings[0].style.borderColor).toBe('#ff00ff');
      expect(rings[0].style.animationDelay).toBe('0s');
      expect(rings[1].style.animationDelay).toBe('0.3s');
    });
  });

  describe('Clear and Fade', () => {
    test('should clear loading state', () => {
      loadingStates.spinner('test-container');
      expect(container.innerHTML).not.toBe('');
      expect(loadingStates.states.has('test-container')).toBe(true);
      
      loadingStates.clear('test-container');
      
      expect(container.innerHTML).toBe('');
      expect(loadingStates.states.has('test-container')).toBe(false);
    });

    test('should handle clearing non-existent container', () => {
      loadingStates.clear('non-existent');
      // Should not throw
      expect(true).toBe(true);
    });

    test('should fade out with transition', (done) => {
      loadingStates.spinner('test-container');
      
      const callback = jest.fn();
      loadingStates.fadeOut('test-container', callback);
      
      expect(container.style.transition).toBe('opacity 0.3s ease-out');
      expect(container.style.opacity).toBe('0');
      
      setTimeout(() => {
        expect(container.innerHTML).toBe('');
        expect(callback).toHaveBeenCalled();
        done();
      }, 350);
    });

    test('should handle fade out of non-existent container', () => {
      loadingStates.fadeOut('non-existent');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('State Management', () => {
    test('should track multiple loading states', () => {
      const container2 = document.createElement('div');
      container2.id = 'test-container-2';
      document.body.appendChild(container2);
      
      loadingStates.spinner('test-container');
      loadingStates.progressBar('test-container-2', { progress: 50 });
      
      expect(loadingStates.states.get('test-container')).toBe('spinner');
      expect(loadingStates.states.get('test-container-2')).toEqual({ type: 'progress', value: 50 });
    });

    test('should overwrite existing state', () => {
      loadingStates.spinner('test-container');
      expect(loadingStates.states.get('test-container')).toBe('spinner');
      
      loadingStates.dots('test-container');
      expect(loadingStates.states.get('test-container')).toBe('dots');
    });
  });

  describe('Style Injection', () => {
    test('should include all component styles', () => {
      const styles = document.getElementById('loading-states-styles');
      const styleContent = styles.textContent;
      
      // Check for key style definitions
      expect(styleContent).toContain('.skeleton-loader');
      expect(styleContent).toContain('.loading-spinner');
      expect(styleContent).toContain('.progress-bar');
      expect(styleContent).toContain('.loading-dots');
      expect(styleContent).toContain('.pulse-loader');
      
      // Check for animations
      expect(styleContent).toContain('@keyframes skeleton-shimmer');
      expect(styleContent).toContain('@keyframes spinner-rotate');
      expect(styleContent).toContain('@keyframes dots-pulse');
      expect(styleContent).toContain('@keyframes pulse-ring-animation');
      
      // Check for responsive styles
      expect(styleContent).toContain('@media (prefers-color-scheme: dark)');
      expect(styleContent).toContain('@media (prefers-reduced-motion: reduce)');
    });
  });

  describe('Module Export', () => {
    test('should export LoadingStates and Loading', () => {
      expect(LoadingStates).toBeDefined();
      expect(Loading).toBeDefined();
      expect(Loading).toBeInstanceOf(LoadingStates);
    });

    test('should attach to window in browser environment', () => {
      // Simulate browser environment
      delete require.cache[require.resolve('./LoadingStates')];
      const originalModule = global.module;
      global.module = undefined;
      
      // Re-require the module
      delete global.LoadingStates;
      delete global.Loading;
      require('./LoadingStates');
      
      expect(global.LoadingStates).toBeDefined();
      expect(global.Loading).toBeDefined();
      
      // Restore
      global.module = originalModule;
    });
  });
});