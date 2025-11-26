import {
  setupFormControlProperty,
  setupFormControlPropertyFromInput,
  setupGlobalFormControlListener,
} from './form-utils';

// Define a type for the form with the control property to avoid using 'any'
interface FormWithControl extends HTMLFormElement {
  control?: Record<string, unknown> | string | null;
}

describe('form-utils', () => {
  let form: HTMLFormElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    form = document.createElement('form');
    document.body.appendChild(form);
  });

  describe('setupFormControlProperty', () => {
    it('should add a control property to the form', () => {
      setupFormControlProperty(form);
      expect('control' in form).toBe(true);
      expect((form as FormWithControl).control).toEqual({});
    });

    it('should allow writing to the control property (object)', () => {
      setupFormControlProperty(form);
      (form as FormWithControl).control = { foo: 'bar' };
      const control = (form as FormWithControl).control as Record<string, unknown>;
      expect(control.foo).toBe('bar');
    });

    it('should allow writing to the control property (primitive)', () => {
      setupFormControlProperty(form);
      (form as FormWithControl).control = 'some-value';
      const control = (form as FormWithControl).control as Record<string, unknown>;
      expect(control.value).toBe('some-value');
    });

    it('should not override existing getter/setter', () => {
      Object.defineProperty(form, 'control', {
        get: () => 'existing',
        configurable: true,
      });

      setupFormControlProperty(form);
      expect((form as FormWithControl).control).toBe('existing');
    });

    it('should override null/undefined control property', () => {
      (form as FormWithControl).control = null;
      setupFormControlProperty(form);
      expect((form as FormWithControl).control).toEqual({});
    });

    it('should handle null form element gracefully', () => {
      expect(() => setupFormControlProperty(null)).not.toThrow();
    });
  });

  describe('setupFormControlPropertyFromInput', () => {
    it('should setup form control from input', () => {
      const input = document.createElement('input');
      form.appendChild(input);

      setupFormControlPropertyFromInput(input);
      expect((form as FormWithControl).control).toEqual({});
    });

    it('should handle input without form', () => {
      const input = document.createElement('input');
      expect(() => setupFormControlPropertyFromInput(input)).not.toThrow();
    });

    it('should handle null input', () => {
      expect(() => setupFormControlPropertyFromInput(null)).not.toThrow();
    });
  });

  describe('setupGlobalFormControlListener', () => {
    it('should setup listeners and process existing forms', () => {
      // Ensure global flag is reset if possible, or just run it (it has a guard)
      // Since we can't easily reset the module-level variable 'globalFormControlListenerSetup',
      // we just verify it runs without error and effects the DOM.

      // Create a new form that hasn't been processed
      const newForm = document.createElement('form');
      document.body.appendChild(newForm);

      setupGlobalFormControlListener();

      // It should have processed existing forms
      expect((newForm as FormWithControl).control).toEqual({});
    });

    it('should handle dynamic form additions', async () => {
      setupGlobalFormControlListener();

      const dynamicForm = document.createElement('form');
      document.body.appendChild(dynamicForm);

      // MutationObserver is async, wait a bit
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect((dynamicForm as FormWithControl).control).toEqual({});
    });

    it('should handle focusin events', () => {
      setupGlobalFormControlListener();
      const input = document.createElement('input');
      form.appendChild(input);

      // Dispatch focusin event
      const event = new FocusEvent('focusin', { bubbles: true });
      input.dispatchEvent(event);

      expect((form as FormWithControl).control).toEqual({});
    });
  });
});
