/**
 * Unit Tests for Plugin UI Component System
 * Tests plugin UI components, menus, state management, and lifecycle
 */

import { PluginUIManager } from './plugin-ui';
import {
  PluginUIComponent,
  PluginMenuItem,
  PluginEvent,
  PluginEventBus,
  PluginError
} from './plugin-interface';

// Mock DOM elements
const createMockElement = (tag = 'div'): HTMLElement => {
  const element = document.createElement(tag);
  element.remove = jest.fn();
  element.appendChild = jest.fn();
  element.removeChild = jest.fn();
  element.addEventListener = jest.fn();
  element.removeEventListener = jest.fn();
  element.classList = {
    add: jest.fn(),
    remove: jest.fn(),
    contains: jest.fn(),
    toggle: jest.fn()
  } as any;
  return element;
};

// Mock event bus
class MockEventBus implements PluginEventBus {
  private handlers: Map<string, Function[]> = new Map();

  async emit(event: PluginEvent): Promise<void> {
    const eventHandlers = this.handlers.get(event.type) || [];
    await Promise.all(eventHandlers.map(handler => handler(event)));
  }

  on(eventType: string, handler: Function): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: Function): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }
}

// Mock UI component
const createMockComponent = (id: string): PluginUIComponent => ({
  id,
  type: 'panel',
  render: jest.fn(() => {
    const element = createMockElement();
    element.id = `component-${id}`;
    element.innerHTML = `<div>Component ${id}</div>`;
    return element;
  }),
  onMount: jest.fn(),
  onUnmount: jest.fn(),
  onUpdate: jest.fn(),
  position: 'sidebar',
  priority: 0
});

// Mock menu item
const createMockMenuItem = (id: string): PluginMenuItem => ({
  id,
  label: `Menu Item ${id}`,
  onClick: jest.fn(),
  icon: 'icon.png',
  tooltip: `Tooltip for ${id}`,
  position: 'tools',
  priority: 0,
  enabled: true,
  visible: true
});

describe('PluginUIManager', () => {
  let uiManager: PluginUIManager;
  let eventBus: MockEventBus;
  let mockContainer: HTMLElement;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = '';
    mockContainer = createMockElement();
    mockContainer.id = 'plugin-ui-container';
    document.body.appendChild(mockContainer);

    eventBus = new MockEventBus();
    uiManager = new PluginUIManager(eventBus);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.clearAllMocks();
  });

  describe('Component Registration', () => {
    test('should register UI component', () => {
      const component = createMockComponent('test-component');
      
      uiManager.registerComponent('test-plugin', component);
      
      const registered = uiManager.getComponent('test-plugin', 'test-component');
      expect(registered).toBe(component);
    });

    test('should prevent duplicate component registration', () => {
      const component = createMockComponent('test-component');
      
      uiManager.registerComponent('test-plugin', component);
      
      expect(() => {
        uiManager.registerComponent('test-plugin', component);
      }).toThrow(PluginError);
    });

    test('should unregister component', () => {
      const component = createMockComponent('test-component');
      
      uiManager.registerComponent('test-plugin', component);
      uiManager.unregisterComponent('test-plugin', 'test-component');
      
      const registered = uiManager.getComponent('test-plugin', 'test-component');
      expect(registered).toBeNull();
    });

    test('should unregister all plugin components', () => {
      const component1 = createMockComponent('component1');
      const component2 = createMockComponent('component2');
      
      uiManager.registerComponent('test-plugin', component1);
      uiManager.registerComponent('test-plugin', component2);
      
      uiManager.unregisterAllComponents('test-plugin');
      
      expect(uiManager.getComponent('test-plugin', 'component1')).toBeNull();
      expect(uiManager.getComponent('test-plugin', 'component2')).toBeNull();
    });
  });

  describe('Component Mounting', () => {
    test('should mount component', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      expect(component.render).toHaveBeenCalled();
      expect(component.onMount).toHaveBeenCalled();
      expect(mockContainer.appendChild).toHaveBeenCalled();
    });

    test('should handle mount errors', async () => {
      const component = createMockComponent('test-component');
      component.render = jest.fn(() => {
        throw new Error('Render failed');
      });
      
      uiManager.registerComponent('test-plugin', component);
      
      await expect(
        uiManager.mountComponent('test-plugin', 'test-component', mockContainer)
      ).rejects.toThrow('Render failed');
    });

    test('should prevent mounting already mounted component', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      await expect(
        uiManager.mountComponent('test-plugin', 'test-component', mockContainer)
      ).rejects.toThrow('Component already mounted');
    });

    test('should track component state', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      
      const state1 = uiManager.getComponentState('test-plugin', 'test-component');
      expect(state1).toBe('unmounted');
      
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      const state2 = uiManager.getComponentState('test-plugin', 'test-component');
      expect(state2).toBe('mounted');
    });
  });

  describe('Component Unmounting', () => {
    test('should unmount component', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      await uiManager.unmountComponent('test-plugin', 'test-component');
      
      expect(component.onUnmount).toHaveBeenCalled();
      const state = uiManager.getComponentState('test-plugin', 'test-component');
      expect(state).toBe('unmounted');
    });

    test('should remove component from DOM', async () => {
      const component = createMockComponent('test-component');
      const element = component.render();
      
      uiManager.registerComponent('test-plugin', component);
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      await uiManager.unmountComponent('test-plugin', 'test-component');
      
      expect(element.remove).toHaveBeenCalled();
    });

    test('should handle unmount errors gracefully', async () => {
      const component = createMockComponent('test-component');
      component.onUnmount = jest.fn(() => {
        throw new Error('Unmount failed');
      });
      
      uiManager.registerComponent('test-plugin', component);
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      // Should not throw
      await uiManager.unmountComponent('test-plugin', 'test-component');
      
      const state = uiManager.getComponentState('test-plugin', 'test-component');
      expect(state).toBe('unmounted');
    });
  });

  describe('Component Updates', () => {
    test('should update component', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      const props = { theme: 'dark' };
      await uiManager.updateComponent('test-plugin', 'test-component', props);
      
      expect(component.onUpdate).toHaveBeenCalledWith(props);
    });

    test('should track update metadata', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      await uiManager.updateComponent('test-plugin', 'test-component', {});
      
      const metadata = uiManager.getComponentMetadata('test-plugin', 'test-component');
      expect(metadata?.lastUpdate).toBeDefined();
      expect(metadata?.renderCount).toBeGreaterThan(1);
    });

    test('should handle update errors', async () => {
      const component = createMockComponent('test-component');
      component.onUpdate = jest.fn(() => {
        throw new Error('Update failed');
      });
      
      uiManager.registerComponent('test-plugin', component);
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      await expect(
        uiManager.updateComponent('test-plugin', 'test-component', {})
      ).rejects.toThrow('Update failed');
      
      const metadata = uiManager.getComponentMetadata('test-plugin', 'test-component');
      expect(metadata?.errorCount).toBe(1);
    });
  });

  describe('Menu Management', () => {
    test('should register menu item', () => {
      const menuItem = createMockMenuItem('test-menu');
      
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      const registered = uiManager.getMenuItem('test-plugin', 'test-menu');
      expect(registered).toBe(menuItem);
    });

    test('should create menu element', () => {
      const menuItem = createMockMenuItem('test-menu');
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      const element = uiManager.createMenuElement('test-plugin', 'test-menu');
      
      expect(element).toBeDefined();
      expect(element?.textContent).toContain('Menu Item test-menu');
    });

    test('should handle menu clicks', () => {
      const menuItem = createMockMenuItem('test-menu');
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      const element = uiManager.createMenuElement('test-plugin', 'test-menu');
      
      // Simulate click
      const clickEvent = new Event('click');
      element?.dispatchEvent(clickEvent);
      
      expect(menuItem.onClick).toHaveBeenCalled();
    });

    test('should track menu click metadata', () => {
      const menuItem = createMockMenuItem('test-menu');
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      const element = uiManager.createMenuElement('test-plugin', 'test-menu');
      element?.click();
      
      const metadata = uiManager.getMenuItemMetadata('test-plugin', 'test-menu');
      expect(metadata?.clickCount).toBe(1);
      expect(metadata?.lastClicked).toBeDefined();
    });

    test('should disable menu item', () => {
      const menuItem = createMockMenuItem('test-menu');
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      uiManager.setMenuItemEnabled('test-plugin', 'test-menu', false);
      
      const element = uiManager.createMenuElement('test-plugin', 'test-menu');
      expect(element?.classList.contains('disabled')).toBe(true);
    });

    test('should hide menu item', () => {
      const menuItem = createMockMenuItem('test-menu');
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      uiManager.setMenuItemVisible('test-plugin', 'test-menu', false);
      
      const element = uiManager.createMenuElement('test-plugin', 'test-menu');
      expect(element?.style.display).toBe('none');
    });
  });

  describe('Component Queries', () => {
    beforeEach(async () => {
      const component1 = createMockComponent('component1');
      component1.position = 'sidebar';
      const component2 = createMockComponent('component2');
      component2.position = 'toolbar';
      const component3 = createMockComponent('component3');
      component3.position = 'sidebar';
      
      uiManager.registerComponent('plugin1', component1);
      uiManager.registerComponent('plugin1', component2);
      uiManager.registerComponent('plugin2', component3);
      
      await uiManager.mountComponent('plugin1', 'component1', mockContainer);
      await uiManager.mountComponent('plugin1', 'component2', mockContainer);
    });

    test('should get components by position', () => {
      const sidebarComponents = uiManager.getComponentsByPosition('sidebar');
      
      expect(sidebarComponents).toHaveLength(2);
      expect(sidebarComponents.map(c => c.id)).toContain('component1');
      expect(sidebarComponents.map(c => c.id)).toContain('component3');
    });

    test('should get mounted components', () => {
      const mounted = uiManager.getMountedComponents();
      
      expect(mounted).toHaveLength(2);
      expect(mounted.map(c => c.id)).toContain('component1');
      expect(mounted.map(c => c.id)).toContain('component2');
    });

    test('should get components by plugin', () => {
      const pluginComponents = uiManager.getPluginComponents('plugin1');
      
      expect(pluginComponents).toHaveLength(2);
    });

    test('should get components by state', () => {
      const mountedComponents = uiManager.getComponentsByState('mounted');
      const unmountedComponents = uiManager.getComponentsByState('unmounted');
      
      expect(mountedComponents).toHaveLength(2);
      expect(unmountedComponents).toHaveLength(1);
    });
  });

  describe('Event Handling', () => {
    test('should emit component events', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      
      const eventHandler = jest.fn();
      eventBus.on('ui:component:mounted', eventHandler);
      
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ui:component:mounted',
          data: expect.objectContaining({
            pluginId: 'test-plugin',
            componentId: 'test-component'
          })
        })
      );
    });

    test('should emit menu events', () => {
      const menuItem = createMockMenuItem('test-menu');
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      const eventHandler = jest.fn();
      eventBus.on('ui:menu:clicked', eventHandler);
      
      const element = uiManager.createMenuElement('test-plugin', 'test-menu');
      element?.click();
      
      expect(eventHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ui:menu:clicked',
          data: expect.objectContaining({
            pluginId: 'test-plugin',
            menuItemId: 'test-menu'
          })
        })
      );
    });
  });

  describe('Layout Management', () => {
    test('should arrange components by priority', async () => {
      const component1 = createMockComponent('component1');
      component1.priority = 10;
      const component2 = createMockComponent('component2');
      component2.priority = 5;
      const component3 = createMockComponent('component3');
      component3.priority = 15;
      
      uiManager.registerComponent('plugin', component1);
      uiManager.registerComponent('plugin', component2);
      uiManager.registerComponent('plugin', component3);
      
      const sorted = uiManager.getComponentsByPriority();
      
      expect(sorted[0].id).toBe('component3');
      expect(sorted[1].id).toBe('component1');
      expect(sorted[2].id).toBe('component2');
    });

    test('should create layout containers', () => {
      const containers = uiManager.createLayoutContainers();
      
      expect(containers.sidebar).toBeDefined();
      expect(containers.toolbar).toBeDefined();
      expect(containers.panel).toBeDefined();
      expect(containers.overlay).toBeDefined();
    });

    test('should auto-mount components to positions', async () => {
      const component = createMockComponent('test-component');
      component.position = 'sidebar';
      
      uiManager.registerComponent('test-plugin', component);
      
      const containers = uiManager.createLayoutContainers();
      document.body.appendChild(containers.sidebar);
      
      await uiManager.autoMountComponents();
      
      expect(component.render).toHaveBeenCalled();
      expect(containers.sidebar.appendChild).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all plugin UI', async () => {
      const component1 = createMockComponent('component1');
      const component2 = createMockComponent('component2');
      const menuItem = createMockMenuItem('menu1');
      
      uiManager.registerComponent('test-plugin', component1);
      uiManager.registerComponent('test-plugin', component2);
      uiManager.registerMenuItem('test-plugin', menuItem);
      
      await uiManager.mountComponent('test-plugin', 'component1', mockContainer);
      await uiManager.mountComponent('test-plugin', 'component2', mockContainer);
      
      await uiManager.cleanupPlugin('test-plugin');
      
      expect(component1.onUnmount).toHaveBeenCalled();
      expect(component2.onUnmount).toHaveBeenCalled();
      expect(uiManager.getComponent('test-plugin', 'component1')).toBeNull();
      expect(uiManager.getMenuItem('test-plugin', 'menu1')).toBeNull();
    });

    test('should cleanup all UI on shutdown', async () => {
      const component = createMockComponent('test-component');
      uiManager.registerComponent('test-plugin', component);
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      await uiManager.shutdown();
      
      expect(component.onUnmount).toHaveBeenCalled();
      expect(uiManager.getMountedComponents()).toHaveLength(0);
    });
  });

  describe('Error Recovery', () => {
    test('should recover from component errors', async () => {
      const component = createMockComponent('test-component');
      let renderCount = 0;
      
      component.render = jest.fn(() => {
        renderCount++;
        if (renderCount === 1) {
          throw new Error('First render failed');
        }
        return createMockElement();
      });
      
      uiManager.registerComponent('test-plugin', component);
      
      // First mount should fail
      await expect(
        uiManager.mountComponent('test-plugin', 'test-component', mockContainer)
      ).rejects.toThrow();
      
      // Should be able to retry
      await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
      
      const state = uiManager.getComponentState('test-plugin', 'test-component');
      expect(state).toBe('mounted');
    });

    test('should limit error retries', async () => {
      const component = createMockComponent('test-component');
      component.render = jest.fn(() => {
        throw new Error('Always fails');
      });
      
      uiManager.registerComponent('test-plugin', component);
      
      // Try multiple times
      for (let i = 0; i < 5; i++) {
        try {
          await uiManager.mountComponent('test-plugin', 'test-component', mockContainer);
        } catch (e) {
          // Expected
        }
      }
      
      const metadata = uiManager.getComponentMetadata('test-plugin', 'test-component');
      expect(metadata?.errorCount).toBe(5);
      
      // Should prevent further attempts after max errors
      await expect(
        uiManager.mountComponent('test-plugin', 'test-component', mockContainer)
      ).rejects.toThrow('Component has too many errors');
    });
  });
});